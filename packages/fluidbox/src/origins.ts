import type { FluidboxItem, FluidboxOriginAdapter } from "./public-api";

/**
 * An origins adapter that reads the newest adapter on every call, as a
 * framework prop changes. Without a `revealOrigin` of its own, the viewer
 * scrolls the trigger into view.
 */
export function latestOrigins<TItem extends FluidboxItem = FluidboxItem>(
  read: () => FluidboxOriginAdapter<TItem> | null | undefined,
): FluidboxOriginAdapter<TItem> {
  return {
    getOrigin: (id) => read()?.getOrigin(id) ?? null,
    get revealOrigin(): FluidboxOriginAdapter<TItem>["revealOrigin"] {
      const adapter = read();
      return adapter?.revealOrigin?.bind(adapter);
    },
  };
}
