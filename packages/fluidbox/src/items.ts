import type {
  FluidboxItem,
  FluidboxItemList,
  FluidboxItemListOptions,
  FluidboxItems,
  FluidboxTarget,
} from "./public-api";
import { checkItemUrls } from "./media-url";
import type { FluidboxSource } from "./runtime-types";

/**
 * The ids an array gave items of its own that have no id and repeat an earlier
 * item's src, as product media that shows one photo twice: `src#2`, `src#3`.
 */
const derivedIds = new WeakMap<FluidboxItem, string>();

/**
 * The id of an item: its own, else its src, or the one its array derived when
 * that src repeats. Throws a TypeError when it has neither id nor src.
 */
export function idOf(item: FluidboxItem): string {
  const id = item.id ?? derivedIds.get(item) ?? ("src" in item ? item.src : undefined);
  if (typeof id !== "string" || !id.trim())
    throw new TypeError(
      process.env.NODE_ENV === "production" ? "fluidbox" : "A fluidbox item needs an id or a src.",
    );
  return id;
}

/** Values compared by their content: plain objects and arrays. */
function plain(value: object) {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null || Array.isArray(value);
}

/**
 * Whether two items are the same by their fields: plain objects and arrays, as
 * `thumbnail` and `sources`, compare by content, anything else by identity.
 */
export function sameItem(a: unknown, b: unknown, depth = 0): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  // A cycle, or data this deep, is not an item's; it counts as changed.
  if (depth > 8 || !plain(a) || !plain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameItem(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          depth + 1,
        ),
    )
  );
}

/** Whether two arrays hold the same items, in order. */
export function sameItems(a: readonly FluidboxItem[], b: readonly FluidboxItem[]) {
  return a.length === b.length && a.every((item, index) => sameItem(item, b[index]));
}

/** The text an item is named by: its alt text or title. */
export function itemLabel(item: FluidboxItem): string {
  return item.type === "image" ? item.alt : item.title;
}

/** A target as an index or an id. An item names itself by its id. */
export function targetKey(target: FluidboxTarget): number | string {
  return typeof target === "object" && target !== null ? idOf(target) : target;
}

/**
 * A trigger's value as indexes and ids, without repeats: one target, or a
 * list of them. An empty list is a TypeError.
 */
export function targetKeys(value: FluidboxTarget | readonly FluidboxTarget[]): (number | string)[] {
  const targets: readonly FluidboxTarget[] = Array.isArray(value)
    ? value
    : [value as FluidboxTarget];
  if (!targets.length)
    throw new TypeError(
      process.env.NODE_ENV === "production"
        ? "fluidbox"
        : "A fluidbox trigger needs at least one item.",
    );
  return [...new Set(targets.map(targetKey))];
}

function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(
      process.env.NODE_ENV === "production"
        ? "fluidbox"
        : "A fluidbox item list's count must be a non-negative integer.",
    );
  }
}

function checkIndex(index: number, count: number) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(
      process.env.NODE_ENV === "production"
        ? "fluidbox"
        : `Fluidbox item index is out of range: ${index}`,
    );
  }
}

/**
 * A lazy list that makes each item once and gives back the same object after,
 * and checks the index it is given for an id.
 */
export function createItemList<TItem extends FluidboxItem>(
  options: FluidboxItemListOptions<TItem>,
): FluidboxItemList<TItem> {
  const { count, item, index } = options;
  checkCount(count);
  const made = new Map<number, TItem>();
  const indices = new Map<string, number>();
  const get = (at: number) => {
    checkIndex(at, count);
    let found = made.get(at);
    if (!found) {
      found = item(at);
      checkItem(found);
      made.set(at, found);
      indices.set(idOf(found), at);
    }
    return found;
  };
  const holds = (at: number, id: string) =>
    Number.isInteger(at) && at >= 0 && at < count && idOf(get(at)) === id;
  return Object.freeze({
    count,
    get,
    indexOf(id: string) {
      const known = indices.get(id);
      if (known !== undefined) return known;
      if (index) {
        const guess = index(id);
        return holds(guess, id) ? guess : -1;
      }
      // A scan reads ids without keeping every item it passes.
      for (let at = 0; at < count; at++) {
        if (idOf(made.get(at) ?? item(at)) === id) return at;
      }
      return -1;
    },
  });
}

/** What an item's `data` names may be: lower case, digits and single dashes. */
const dataName = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Throw when an item's `data` names an attribute the viewer can't set, or one
 * it owns. In development only: a production build, and a page without a
 * bundler, skip it.
 */
export function checkItemData(item: FluidboxItem, id: string) {
  try {
    if (process.env.NODE_ENV === "production") return;
  } catch {
    return;
  }
  for (const [name, value] of Object.entries(item.data ?? {})) {
    if (!dataName.test(name) || name.startsWith("fluidbox-") || typeof value !== "string") {
      throw new TypeError(
        `Fluidbox item ${id} has data "${name}", which needs a lower-case name of letters, digits and single dashes, not starting "fluidbox-", and a string value.`,
      );
    }
  }
}

/** Whether an item's media box is the whole stage: `fit: "fill"`, which images ignore. */
export function fillsStage(item: FluidboxItem): boolean {
  return item.fit === "fill" && item.type !== "image";
}

/**
 * Throw a TypeError for an item the viewer can't show: a URL it refuses, or no
 * `width` and `height` to size its box by, which only a fill box goes without.
 */
function checkItem(item: FluidboxItem) {
  checkItemUrls(item);
  checkItemData(item, idOf(item));
  if (fillsStage(item)) return;
  const { width, height } = item;
  if (!(width! > 0 && height! > 0)) {
    throw new TypeError(
      process.env.NODE_ENV === "production"
        ? "fluidbox"
        : `Fluidbox item ${idOf(item)} needs a positive width and height, or fit: "fill".`,
    );
  }
}

/**
 * A list over arrays and lazy lists alike. An array's own ids must be unique;
 * an item without one whose src repeats gets the next free `src#n`, in order.
 */
export function toList<TItem extends FluidboxItem>(
  items: FluidboxItems<TItem>,
): FluidboxItemList<TItem> {
  if (!Array.isArray(items)) {
    const list = items as FluidboxItemList<TItem>;
    checkCount(list.count);
    return list;
  }
  const snapshot: TItem[] = [...(items as readonly TItem[])];
  const indices = new Map<string, number>();
  // Own ids first, so a derived one never takes an id an item named itself by.
  for (const [index, item] of snapshot.entries()) {
    checkItem(item);
    if (item.id === undefined) continue;
    const id = idOf(item);
    if (indices.has(id))
      throw new TypeError(
        process.env.NODE_ENV === "production" ? "fluidbox" : `Duplicate fluidbox item id: ${id}`,
      );
    indices.set(id, index);
  }
  const seen = new Set<TItem>();
  for (const [index, item] of snapshot.entries()) {
    if (item.id !== undefined) continue;
    // The same object twice in one array needs two ids, so the second is a copy.
    const again = seen.has(item);
    seen.add(item);
    if (!again) derivedIds.delete(item);
    const src = again && "src" in item ? item.src : idOf(item);
    let id = src;
    for (let count = 2; indices.has(id); count++) id = `${src}#${count}`;
    indices.set(id, index);
    if (again) snapshot[index] = { ...item, id };
    else if (id !== src) derivedIds.set(item, id);
  }
  return Object.freeze({
    count: snapshot.length,
    get(index: number) {
      checkIndex(index, snapshot.length);
      return snapshot[index]!;
    },
    indexOf: (id: string) => indices.get(id) ?? -1,
  });
}

/** The index of an id in a list, or null. */
export function indexIn(list: FluidboxItemList, id: string): number | null {
  if (list.indexOf) {
    const index = list.indexOf(id);
    return index >= 0 ? index : null;
  }
  for (let index = 0; index < list.count; index++) {
    if (idOf(list.get(index)) === id) return index;
  }
  return null;
}

/**
 * The ids targets name in a list now, without repeats. An index names whichever
 * item is there; an id counts once the list holds it.
 */
export function idsIn(list: FluidboxItemList, targets: readonly (number | string)[]): string[] {
  const ids = new Set<string>();
  for (const target of targets) {
    if (typeof target === "string") {
      if (indexIn(list, target) !== null) ids.add(target);
    } else if (Number.isInteger(target) && target >= 0 && target < list.count) {
      ids.add(idOf(list.get(target)));
    }
  }
  return [...ids];
}

/** The runtime's source over a list. */
export function toSource<TItem extends FluidboxItem>(
  list: FluidboxItemList<TItem>,
): FluidboxSource<TItem> {
  return Object.freeze({
    count: list.count,
    getItem: (index: number) => {
      checkIndex(index, list.count);
      return list.get(index);
    },
    getIndex: (id: string) => indexIn(list, id),
  });
}
