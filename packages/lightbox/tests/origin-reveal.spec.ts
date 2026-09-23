import { describe, expect, it, vi } from "vitest";
import { OriginRevealCoordinator } from "../src/origin-reveal";
import type { LightboxGallerySource } from "../src/source";

function source(overrides: Partial<LightboxGallerySource>): LightboxGallerySource {
  return {
    count: 1,
    getItem: () => ({ id: "photo-1", src: "/photo-1.jpg" }),
    ...overrides,
  };
}

describe("OriginRevealCoordinator", () => {
  it("aborts the previous host reveal before starting the next one", () => {
    const signals: AbortSignal[] = [];
    const coordinator = new OriginRevealCoordinator();
    const gallerySource = source({
      revealOrigin: (_id, _index, context) => {
        signals.push(context.signal);
      },
    });

    coordinator.request(gallerySource, "photo-1", 0, "open");
    coordinator.request(gallerySource, "photo-1", 0, "selection");

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    coordinator.abort();
    expect(signals[1]?.aborted).toBe(true);
  });

  it("scrolls a connected origin when the host has no reveal hook", () => {
    const scrollIntoView = vi.fn();
    const origin = { isConnected: true, scrollIntoView } as unknown as HTMLElement;
    const coordinator = new OriginRevealCoordinator();

    coordinator.request(source({ getOrigin: () => origin }), "photo-1", 0, "selection");

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
  });

  it("contains synchronous and asynchronous host failures", async () => {
    const coordinator = new OriginRevealCoordinator();

    expect(() =>
      coordinator.request(
        source({
          revealOrigin: () => {
            throw new Error("sync failure");
          },
        }),
        "photo-1",
        0,
        "open",
      ),
    ).not.toThrow();

    coordinator.request(
      source({ revealOrigin: () => Promise.reject(new Error("async failure")) }),
      "photo-1",
      0,
      "open",
    );
    await Promise.resolve();
  });
});
