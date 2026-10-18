import { registerFluidboxElements } from "./register";
import type { FluidboxGalleryElement } from "./gallery";
import type { FluidboxItem, FluidboxSource } from "./public-api";

/** Attach an indexed source after the custom element has upgraded. Safe to call during hydration. */
export function bindGallerySource(
  host: HTMLElement,
  source: FluidboxSource<FluidboxItem> | null,
): () => void {
  let active = true;
  const gallery = host as FluidboxGalleryElement;

  void registerFluidboxElements().then(() => {
    if (active) gallery.source = source;
  });

  return () => {
    active = false;
    if (gallery.source === source) gallery.source = null;
  };
}
