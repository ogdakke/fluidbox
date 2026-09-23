import { describe, expect, it, vi } from "vitest";
import { ElementViewerDriver, type ElementViewerTarget } from "../src/element-viewer-driver";
import type { LightboxItem } from "../src/public-api";
import { completeViewerMotion } from "../src/viewer-motion-completion";

const item = {
  id: "one",
  media: { type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
} as const satisfies LightboxItem;

function target(): ElementViewerTarget & {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
} {
  const viewer = {
    open: vi.fn(() => completeViewerMotion(viewer, "open")),
    close: vi.fn(() => completeViewerMotion(viewer, "close")),
    select: vi.fn(() => completeViewerMotion(viewer, "selection")),
  };
  return viewer;
}

describe("ElementViewerDriver", () => {
  it("settles open only at the element's semantic completion boundary", async () => {
    const viewer = target();
    const driver = new ElementViewerDriver(viewer);
    const signal = new AbortController().signal;

    await driver.open({ item, index: 0, origin: null, signal, reason: "api" });

    expect(viewer.open).toHaveBeenCalledOnce();
  });

  it("forwards selection index and close through separate channels", async () => {
    const viewer = target();
    const driver = new ElementViewerDriver(viewer);
    const signal = new AbortController().signal;

    await driver.select({ item, index: 4, origin: null, signal, reason: "keyboard" });
    await driver.close({ origin: null, signal, reason: "api" });

    expect(viewer.select).toHaveBeenCalledWith(4);
    expect(viewer.close).toHaveBeenCalledOnce();
  });

  it("releases a pending element wait when the session aborts it", async () => {
    const viewer: ElementViewerTarget = {
      open: vi.fn(),
      close: vi.fn(),
      select: vi.fn(),
    };
    const driver = new ElementViewerDriver(viewer);
    const controller = new AbortController();

    const pending = driver.open({
      item,
      index: 0,
      origin: null,
      signal: controller.signal,
      reason: "api",
    });
    controller.abort();

    await expect(pending).resolves.toBeUndefined();
  });
});
