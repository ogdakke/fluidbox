import { describe, expect, test } from "vitest";
import { arraySource } from "../src/array-source";
import type { FluidboxItem } from "../src/public-api";

const item = (id: string): FluidboxItem => ({
  id,
  media: { type: "image", src: `/${id}.jpg`, alt: id, width: 1200, height: 800 },
});

describe("arraySource", () => {
  test("copies its input and resolves stable identity", () => {
    const input = [item("one"), item("two")];
    const source = arraySource(input);
    input.reverse();
    expect(source.count).toBe(2);
    expect(source.getItem(0).id).toBe("one");
    expect(source.getIndex("two")).toBe(1);
    expect(source.getIndex("missing")).toBeNull();
  });

  test("rejects invalid identity and indices", () => {
    expect(() => arraySource([item("same"), item("same")])).toThrow(/Duplicate/);
    expect(() => arraySource([item("")])).toThrow(/empty id/);
    expect(() => arraySource([item("   ")])).toThrow(/empty id/);
    const source = arraySource([item("one")]);
    expect(() => source.getItem(-1)).toThrow(RangeError);
    expect(() => source.getItem(1)).toThrow(RangeError);
    expect(() => source.getItem(0.5)).toThrow(RangeError);
  });
});
