import { describe, expect, it, vi } from "vitest";
import { createItemList, toSource } from "../src/items";
import type { FluidboxImageItem } from "../src/public-api";

const photo = (index: number): FluidboxImageItem => ({
  type: "img",
  id: `photo-${index}`,
  src: `/photos/${index}.jpg`,
  alt: `Photo ${index + 1}`,
  width: 4,
  height: 3,
});

describe("createItemList", () => {
  it("makes each item once and gives back the same object", () => {
    const item = vi.fn(photo);
    const list = createItemList({ count: 10, item });
    expect(list.get(3)).toBe(list.get(3));
    expect(item).toHaveBeenCalledTimes(1);
  });

  it("checks the count and the index", () => {
    expect(() => createItemList({ count: -1, item: photo })).toThrow(RangeError);
    expect(() => createItemList({ count: 1.5, item: photo })).toThrow(RangeError);
    const list = createItemList({ count: 2, item: photo });
    expect(() => list.get(2)).toThrow(RangeError);
    expect(() => list.get(-1)).toThrow(RangeError);
  });

  it("takes a guessed index only when it is in range and holds the id", () => {
    const list = createItemList({
      count: 10,
      item: photo,
      index: (id) => Number(id.replace("photo-", "")),
    });
    expect(list.indexOf!("photo-4")).toBe(4);
    // Parses to 1, but item 1 is photo-1.
    expect(list.indexOf!("photo-01")).toBe(-1);
    expect(list.indexOf!("photo-10")).toBe(-1);
    expect(list.indexOf!("photo-x")).toBe(-1);
  });

  it("scans without an index, and keeps none of the items it passes", () => {
    const item = vi.fn(photo);
    const list = createItemList({ count: 5, item });
    expect(list.indexOf!("photo-3")).toBe(3);
    expect(list.indexOf!("missing")).toBe(-1);
    item.mockClear();
    list.get(2);
    expect(item).toHaveBeenCalledTimes(1);
  });

  it("finds an item it already made without asking", () => {
    const index = vi.fn(() => -1);
    const list = createItemList({ count: 5, item: photo, index });
    list.get(2);
    expect(list.indexOf!("photo-2")).toBe(2);
    expect(index).not.toHaveBeenCalled();
  });

  it("is a list the runtime reads like any other", () => {
    const source = toSource(createItemList({ count: 3, item: photo }));
    expect(source.count).toBe(3);
    expect(source.getIndex("photo-2")).toBe(2);
    expect(source.getItem(1)).toBe(source.getItem(1));
  });
});
