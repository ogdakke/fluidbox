import type { FluidboxItem, FluidboxItemId, FluidboxSource } from "./public-api";

/** Creates an immutable source snapshot and validates stable item identity. */
export function arraySource<TItem extends FluidboxItem>(
  items: readonly TItem[],
): FluidboxSource<TItem> {
  const snapshot = [...items];
  const indices = new Map<FluidboxItemId, number>();
  for (const [index, item] of snapshot.entries()) {
    if (!item.id.trim()) throw new TypeError(`Fluidbox item at index ${index} has an empty id.`);
    if (indices.has(item.id)) throw new TypeError(`Duplicate lightbox item id: ${item.id}`);
    indices.set(item.id, index);
  }
  return Object.freeze({
    count: snapshot.length,
    getItem(index: number): TItem {
      if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) {
        throw new RangeError(`Fluidbox index ${index} is out of range.`);
      }
      return snapshot[index]!;
    },
    getIndex(id: FluidboxItemId): number | null {
      return indices.get(id) ?? null;
    },
  });
}
