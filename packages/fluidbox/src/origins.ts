import type { FluidboxOriginAdapter } from "./public-api";

/**
 * An origins adapter that reads the newest adapter on every call, as a
 * framework prop changes. Without a `revealOrigin` of its own, the viewer
 * scrolls the trigger into view.
 */
export function latestOrigins(
  read: () => FluidboxOriginAdapter | null | undefined,
): FluidboxOriginAdapter {
  return {
    getOrigin: (id) => read()?.getOrigin(id) ?? null,
    get revealOrigin(): FluidboxOriginAdapter["revealOrigin"] {
      const adapter = read();
      return adapter?.revealOrigin?.bind(adapter);
    },
  };
}
