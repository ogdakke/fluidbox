import { describe, expect, it } from "vitest";
import { OriginRegistry } from "../src/origin-registry";
import type { LightboxOrigin } from "../src/public-api";

function origin(name: string): LightboxOrigin {
  return {
    trigger: { id: `${name}-trigger` } as HTMLElement,
    visual: { id: `${name}-visual` } as HTMLElement,
  };
}

describe("OriginRegistry", () => {
  it("prefers a live registration and reveals the adapter after disposal", () => {
    const adapted = origin("adapter");
    const registered = origin("registered");
    const registry = new OriginRegistry({ getOrigin: () => adapted });

    const dispose = registry.register("photo-1", registered);
    expect(registry.get("photo-1")).toBe(registered);

    dispose();
    expect(registry.get("photo-1")).toBe(adapted);
  });

  it("does not let stale virtualizer cleanup remove a replacement", () => {
    const first = origin("first");
    const replacement = origin("replacement");
    const registry = new OriginRegistry();

    const disposeFirst = registry.register("photo-1", first);
    const disposeReplacement = registry.register("photo-1", replacement);
    disposeFirst();

    expect(registry.get("photo-1")).toBe(replacement);
    disposeReplacement();
    expect(registry.get("photo-1")).toBeNull();
  });

  it("uses idempotent disposers and contains adapter lookup failures", () => {
    const registry = new OriginRegistry({
      getOrigin() {
        throw new Error("host lookup failed");
      },
    });
    const dispose = registry.register("photo-1", origin("registered"));

    dispose();
    dispose();

    expect(registry.get("photo-1")).toBeNull();
  });

  it("clears every live registration", () => {
    const registry = new OriginRegistry();
    registry.register("photo-1", origin("one"));
    registry.register("photo-2", origin("two"));

    registry.clear();

    expect(registry.get("photo-1")).toBeNull();
    expect(registry.get("photo-2")).toBeNull();
  });

  it("uses a specific origin before a shared gallery card, then falls back to the card", () => {
    const registry = new OriginRegistry();
    const card = origin("card");
    const thumbnail = origin("thumbnail");
    const disposeCard = registry.register("photo-2", card, true);
    const disposeThumbnail = registry.register("photo-2", thumbnail);

    expect(registry.get("photo-2")).toBe(thumbnail);
    disposeThumbnail();
    expect(registry.get("photo-2")).toBe(card);
    disposeCard();
    expect(registry.get("photo-2")).toBeNull();
  });

  it("restores an earlier shared card when the newer one unmounts", () => {
    const registry = new OriginRegistry();
    const first = origin("first-card");
    const second = origin("second-card");
    const disposeFirst = registry.register("photo-2", first, true);
    const disposeSecond = registry.register("photo-2", second, true);

    expect(registry.get("photo-2")).toBe(second);
    disposeSecond();
    expect(registry.get("photo-2")).toBe(first);
    disposeFirst();
    expect(registry.get("photo-2")).toBeNull();
  });
});
