---
title: Angular
section: Frameworks
order: 4
---

# Angular

`useFluidboxGallery()` runs in a constructor and writes a signal's source to the gallery after each render. It is a plain function, so the package needs no Angular library build step, and it works zoneless.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, signal } from "@angular/core";
import { useFluidboxGallery } from "@ogdakke/fluidbox/angular";
import type { FluidboxGalleryElement, FluidboxItem, FluidboxSource } from "@ogdakke/fluidbox";

@Component({
  selector: "photo-page",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <fluidbox-gallery>
      @for (photo of photos; track photo.id; let index = $index) {
        <button type="button" [attr.data-origin-id]="photo.id" (click)="open(index)">
          <img [src]="photo.thumbnail?.src" alt="" />
        </button>
      }
    </fluidbox-gallery>
  `,
})
export class PhotoPage {
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly source = signal<FluidboxSource<FluidboxItem> | null>(photosSource);

  constructor() {
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  gallery(): FluidboxGalleryElement | null {
    return this.host.nativeElement.querySelector<FluidboxGalleryElement>("fluidbox-gallery");
  }

  open(index: number): void {
    void this.gallery()?.open({ index });
  }
}
```

Use `CUSTOM_ELEMENTS_SCHEMA` on the host component. Set the rendered gallery's `origins` in `ngAfterViewInit` to an [origin adapter](./sources-and-origins.md#origins) so flights start from your thumbnails.
