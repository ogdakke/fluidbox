import type { LightboxItem, LightboxItemId, LightboxSource } from "./public-api";

/** Creates an immutable source snapshot and validates stable item identity. */
export function arraySource<TItem extends LightboxItem>(
  items: readonly TItem[],
): LightboxSource<TItem> {
  const snapshot = [...items];
  const indices = new Map<LightboxItemId, number>();
  for (const [index, item] of snapshot.entries()) {
    if (!item.id.trim()) throw new TypeError(`Lightbox item at index ${index} has an empty id.`);
    if (indices.has(item.id)) throw new TypeError(`Duplicate lightbox item id: ${item.id}`);
    indices.set(item.id, index);
  }
  return Object.freeze({
    count: snapshot.length,
    getItem(index: number): TItem {
      if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) {
        throw new RangeError(`Lightbox index ${index} is out of range.`);
      }
      return snapshot[index]!;
    },
    getIndex(id: LightboxItemId): number | null {
      return indices.get(id) ?? null;
    },
  });
}
