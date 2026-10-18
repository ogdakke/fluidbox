import { afterRenderEffect } from "@angular/core";
import type { Signal } from "@angular/core";
import { bindGallerySource } from "./binding";
import type { FluidboxGalleryElement } from "./gallery";
import type { FluidboxItem, FluidboxSource } from "./public-api";

/** Call in an Angular component's injection context with a DOM lookup and source signal. */
export function useFluidboxGallery(
  element: () => FluidboxGalleryElement | null | undefined,
  source: Signal<FluidboxSource<FluidboxItem> | null>,
): void {
  afterRenderEffect({
    write(onCleanup) {
      const host = element();
      if (host) onCleanup(bindGallerySource(host, source()));
    },
  });
}
