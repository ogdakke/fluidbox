import { describe, expect, it, vi } from "vitest";
import { createItemList, idOf, toList, toSource } from "../src/items";
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

describe("an array of items", () => {
  const media = (src: string, id?: string): FluidboxImageItem => ({
    type: "img",
    ...(id === undefined ? {} : { id }),
    src,
    alt: src,
    width: 4,
    height: 3,
  });

  it("gives items without an id that repeat a src the next free src#n", () => {
    const items = [media("/a.jpg"), media("/b.jpg"), media("/a.jpg"), media("/a.jpg")];
    const list = toList(items);
    expect(items.map(idOf)).toEqual(["/a.jpg", "/b.jpg", "/a.jpg#2", "/a.jpg#3"]);
    expect(list.indexOf!("/a.jpg#3")).toBe(3);
    expect(list.get(2)).toBe(items[2]);
  });

  it("derives around the ids items name themselves by", () => {
    const items = [
      media("/a.jpg"),
      media("/b.jpg", "/a.jpg#2"),
      media("/a.jpg"),
      media("/c.jpg", "/a.jpg"),
    ];
    toList(items);
    expect(items.map(idOf)).toEqual(["/a.jpg#3", "/a.jpg#2", "/a.jpg#4", "/a.jpg"]);
  });

  it("gives the same object twice two ids", () => {
    const repeated = media("/a.jpg");
    const list = toList([repeated, repeated]);
    expect([0, 1].map((index) => idOf(list.get(index)))).toEqual(["/a.jpg", "/a.jpg#2"]);
    expect(list.get(0)).toBe(repeated);
  });

  it("derives again from each array, by position", () => {
    const first = media("/a.jpg");
    const second = media("/a.jpg");
    toList([first, second]);
    expect(idOf(second)).toBe("/a.jpg#2");
    toList([second, first]);
    expect([second, first].map(idOf)).toEqual(["/a.jpg", "/a.jpg#2"]);
  });

  it("still throws for a duplicate id of an item's own", () => {
    expect(() => toList([media("/a.jpg", "x"), media("/b.jpg", "x")])).toThrow(TypeError);
    expect(() => toList([media("/a.jpg", "")])).toThrow(TypeError);
  });
});
