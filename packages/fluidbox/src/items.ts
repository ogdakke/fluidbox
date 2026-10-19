import type { FluidboxItem, FluidboxItemList, FluidboxItems } from "./public-api";
import type { FluidboxSource } from "./runtime-types";

/** The id of an item: its own, else its src. */
export function idOf(item: FluidboxItem): string {
  const id = item.id ?? ("src" in item ? item.src : undefined);
  if (typeof id !== "string" || !id.trim())
    throw new TypeError("A fluidbox item needs an id or a src.");
  return id;
}

/** A list over arrays and lazy lists alike. Arrays are checked for unique ids. */
export function toList<TItem extends FluidboxItem>(
  items: FluidboxItems<TItem>,
): FluidboxItemList<TItem> {
  if (!Array.isArray(items)) {
    const list = items as FluidboxItemList<TItem>;
    if (!Number.isInteger(list.count) || list.count < 0) {
      throw new RangeError("A fluidbox item list's count must be a non-negative integer.");
    }
    return list;
  }
  const snapshot: readonly TItem[] = [...(items as readonly TItem[])];
  const indices = new Map<string, number>();
  for (const [index, item] of snapshot.entries()) {
    const id = idOf(item);
    if (indices.has(id)) throw new TypeError(`Duplicate fluidbox item id: ${id}`);
    indices.set(id, index);
  }
  return Object.freeze({
    count: snapshot.length,
    get(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) {
        throw new RangeError(`Fluidbox item index is out of range: ${index}`);
      }
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

/** The runtime's source over a list. */
export function toSource<TItem extends FluidboxItem>(
  list: FluidboxItemList<TItem>,
): FluidboxSource<TItem> {
  return Object.freeze({
    count: list.count,
    getItem: (index: number) => {
      if (!Number.isInteger(index) || index < 0 || index >= list.count) {
        throw new RangeError(`Fluidbox item index is out of range: ${index}`);
      }
      return list.get(index);
    },
    getIndex: (id: string) => indexIn(list, id),
  });
}
