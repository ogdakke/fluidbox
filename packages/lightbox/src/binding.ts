import { registerLightboxElements } from "./register";
import type { AppGallery } from "./gallery";
import type { LightboxGallerySource } from "./source";

/** Attach an indexed source after the custom element has upgraded. Safe to call during hydration. */
export function bindGallerySource(
  host: HTMLElement,
  source: LightboxGallerySource | null,
): () => void {
  let active = true;
  const gallery = host as AppGallery;

  void registerLightboxElements().then(() => {
    if (active) gallery.source = source;
  });

  return () => {
    active = false;
    if (gallery.source === source) gallery.source = null;
  };
}
