import { createEffect, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { bindGallerySource } from "./binding";
import { registerLightboxElements } from "./register";
import type { AppGallery } from "./gallery";
import type { LightboxGallerySource } from "./source";

/** Register custom elements on the client for standalone markup. */
export function useFluidboxElements(): void {
  onMount(() => {
    void registerLightboxElements();
  });
}

/** Returns a Solid ref callback for an indexed `<app-gallery>`. */
export function useFluidboxGallery(
  source: Accessor<LightboxGallerySource | null>,
): (element: AppGallery) => void {
  let element: AppGallery | undefined;

  onMount(() => {
    createEffect(() => {
      if (element) onCleanup(bindGallerySource(element, source()));
    });
  });

  return (node) => {
    element = node;
  };
}
