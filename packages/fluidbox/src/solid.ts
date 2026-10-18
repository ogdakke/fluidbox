import { createEffect, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { bindGallerySource } from "./binding";
import { registerFluidboxElements } from "./register";
import type { FluidboxGalleryElement } from "./gallery";
import type { FluidboxItem, FluidboxSource } from "./public-api";

/** Register custom elements on the client for standalone markup. */
export function useFluidboxElements(): void {
  onMount(() => {
    void registerFluidboxElements();
  });
}

/** Returns a Solid ref callback for an indexed `<fluidbox-gallery>`. */
export function useFluidboxGallery(
  source: Accessor<FluidboxSource<FluidboxItem> | null>,
): (element: FluidboxGalleryElement) => void {
  let element: FluidboxGalleryElement | undefined;

  onMount(() => {
    createEffect(() => {
      if (element) onCleanup(bindGallerySource(element, source()));
    });
  });

  return (node) => {
    element = node;
  };
}
