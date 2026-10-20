import { afterEach, describe, expect, it } from "vitest";
import { activeViewer } from "../src/viewer-ownership";

const owner = () => ({ closeImmediately: () => true });

describe("activeViewer", () => {
  afterEach(() => {
    activeViewer.active = null;
  });

  it("returns the previous owner when a new viewer claims the portal", () => {
    const first = owner();
    const second = owner();

    expect(activeViewer.claim(first)).toBeNull();
    expect(activeViewer.claim(second)).toBe(first);
    expect(activeViewer.active).toBe(second);
  });

  it("does not let stale release clear the replacement owner", () => {
    const first = owner();
    const second = owner();
    activeViewer.claim(first);
    activeViewer.claim(second);

    activeViewer.release(first);
    expect(activeViewer.active).toBe(second);
    activeViewer.release(second);
    expect(activeViewer.active).toBeNull();
  });

  it("treats a repeated claim as an idempotent no-op", () => {
    const viewer = owner();

    activeViewer.claim(viewer);
    expect(activeViewer.claim(viewer)).toBeNull();
    expect(activeViewer.active).toBe(viewer);
  });
});
