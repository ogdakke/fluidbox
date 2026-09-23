# Framework bindings

All bindings live in `@ogdakke/fluidbox`. Import `@ogdakke/fluidbox/styles.css` once in the client app. The root and framework entries can be imported during server rendering; they register elements after mount. The `./elements` entry runs in the browser only.

Each binding accepts a `LightboxGallerySource` and writes it to an `<app-gallery>` after the element upgrades. The source can cover items outside the host framework's rendered list. Call `gallery.open(index)` from a thumbnail or button handler.

## React

```tsx
import { useRef } from "react";
import { FluidboxGallery } from "@ogdakke/fluidbox/react";
import type { AppGallery } from "@ogdakke/fluidbox";

const gallery = useRef<AppGallery | null>(null);
<FluidboxGallery source={source} ref={gallery}>
  <button onClick={() => gallery.current?.open(0)}>Open</button>
</FluidboxGallery>;
```

Call `useFluidboxElements()` from `@ogdakke/fluidbox/react` when rendering standalone `<app-lightbox>` markup without `FluidboxGallery`.

## Solid

```tsx
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { AppGallery } from "@ogdakke/fluidbox";

let gallery: AppGallery | undefined;
const bind = useFluidboxGallery(() => source);
<app-gallery
  ref={(node) => {
    gallery = node as AppGallery;
    bind(gallery);
  }}
>
  <button onClick={() => gallery?.open(0)}>Open</button>
</app-gallery>;
```

Solid TypeScript apps need an `app-gallery` entry in `JSX.IntrinsicElements`; [the Solid example](../examples/frameworks/solid.tsx) shows the declaration. `useFluidboxElements()` registers standalone markup.

## Vue

```ts
import { h } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";

h(FluidboxGallery, { source }, () => h("button", { onClick: open }, "Open"));
```

The wrapper renders `<app-gallery>` and forwards attributes and the default slot. `useFluidboxElements()` registers standalone markup from a component's setup function.

## Angular

Use `CUSTOM_ELEMENTS_SCHEMA` on the host component. Call `useFluidboxGallery()` in its constructor; the callback looks up the gallery after browser rendering.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, signal } from "@angular/core";
import { useFluidboxGallery } from "@ogdakke/fluidbox/angular";
import type { AppGallery, LightboxGallerySource } from "@ogdakke/fluidbox";

@Component({
  selector: "photo-page",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<app-gallery><button (click)="open()">Open</button></app-gallery>`,
})
export class PhotoPage {
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly source = signal<LightboxGallerySource | null>(gallerySource);

  constructor() {
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  gallery(): AppGallery | null {
    return this.host.nativeElement.querySelector<AppGallery>("app-gallery");
  }

  open(): void {
    this.gallery()?.open(0);
  }
}
```

The Angular entry exports a function rather than a decorated directive. Its tsdown output needs no Angular library compilation step.

## Verify the examples

Run `bun run build:frameworks`, then `bun run --cwd examples/frameworks dev`. Open `/react.html`, `/solid.html`, `/vue.html`, and `/angular.html`. Playwright opens each gallery, navigates to the second item, closes it, changes the indexed source, and opens it again in the configured browser projects.
