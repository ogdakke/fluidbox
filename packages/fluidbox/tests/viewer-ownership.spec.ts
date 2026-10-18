import { describe, expect, it } from "vitest";
import { ViewerOwnership } from "../src/viewer-ownership";

describe("ViewerOwnership", () => {
  it("returns the previous owner when a new viewer claims the portal", () => {
    const ownership = new ViewerOwnership<object>();
    const first = {};
    const second = {};

    expect(ownership.claim(first)).toBeNull();
    expect(ownership.claim(second)).toBe(first);
    expect(ownership.active).toBe(second);
  });

  it("does not let stale release clear the replacement owner", () => {
    const ownership = new ViewerOwnership<object>();
    const first = {};
    const second = {};
    ownership.claim(first);
    ownership.claim(second);

    expect(ownership.release(first)).toBe(false);
    expect(ownership.active).toBe(second);
    expect(ownership.release(second)).toBe(true);
    expect(ownership.active).toBeNull();
  });

  it("treats a repeated claim as an idempotent no-op", () => {
    const ownership = new ViewerOwnership<object>();
    const viewer = {};

    ownership.claim(viewer);
    expect(ownership.claim(viewer)).toBeNull();
    expect(ownership.active).toBe(viewer);
  });
});
