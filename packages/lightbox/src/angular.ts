import { afterRenderEffect } from "@angular/core";
import type { Signal } from "@angular/core";
import { bindGallerySource } from "./binding";
import type { AppGallery } from "./gallery";
import type { LightboxGallerySource } from "./source";

/** Call in an Angular component's injection context with a DOM lookup and source signal. */
export function useFluidboxGallery(
  element: () => AppGallery | null | undefined,
  source: Signal<LightboxGallerySource | null>,
): void {
  afterRenderEffect({
    write(onCleanup) {
      const host = element();
      if (host) onCleanup(bindGallerySource(host, source()));
    },
  });
}
