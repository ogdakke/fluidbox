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
});
