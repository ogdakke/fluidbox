# Framework bindings

All bindings live in `@ogdakke/fluidbox`. Import `@ogdakke/fluidbox/styles.css` once in the client app. The root and framework entries can be imported during server rendering; they register elements after mount. The `./elements` entry runs in the browser only.

The current Solid, Vue, and Angular adapters accept the canonical `FluidboxSource` and write it to an `<fluidbox-gallery>` after the element upgrades. Call `gallery.open({ index })` from a thumbnail or button handler. React already uses `createFluidbox()` directly.

## React

```tsx
import { useRef } from "react";
import { FluidboxGallery } from "@ogdakke/fluidbox/react";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";

const gallery = useRef<FluidboxGalleryElement | null>(null);
<FluidboxGallery source={source} ref={gallery}>
  <button onClick={() => void gallery.current?.open({ index: 0 })}>Open</button>
</FluidboxGallery>;
```

Call `useFluidboxElements()` from `@ogdakke/fluidbox/react` when rendering standalone `<fluidbox-item>` markup without `FluidboxGallery`.

## Solid

```tsx
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";

let gallery: FluidboxGalleryElement | undefined;
const bind = useFluidboxGallery(() => source);
<fluidbox-gallery
  ref={(node) => {
    gallery = node as FluidboxGalleryElement;
    bind(gallery);
  }}
>
  <button onClick={() => void gallery?.open({ index: 0 })}>Open</button>
</fluidbox-gallery>;
```

Solid TypeScript apps need an `fluidbox-gallery` entry in `JSX.IntrinsicElements`; [the Solid example](../apps/examples/src/demos/solid.tsx) shows the declaration. `useFluidboxElements()` registers standalone markup.

## Vue

```ts
import { h } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";

h(FluidboxGallery, { source }, () => h("button", { onClick: open }, "Open"));
```

The wrapper renders `<fluidbox-gallery>` and forwards attributes and the default slot. `useFluidboxElements()` registers standalone markup from a component's setup function.

## Angular

Use `CUSTOM_ELEMENTS_SCHEMA` on the host component. Call `useFluidboxGallery()` in its constructor; the callback looks up the gallery after browser rendering.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, signal } from "@angular/core";
import { useFluidboxGallery } from "@ogdakke/fluidbox/angular";
import type { FluidboxGalleryElement, FluidboxItem, FluidboxSource } from "@ogdakke/fluidbox";

@Component({
  selector: "photo-page",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<fluidbox-gallery><button (click)="open()">Open</button></fluidbox-gallery>`,
})
export class PhotoPage {
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly source = signal<FluidboxSource<FluidboxItem> | null>(gallerySource);

  constructor() {
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  gallery(): FluidboxGalleryElement | null {
    return this.host.nativeElement.querySelector<FluidboxGalleryElement>("fluidbox-gallery");
  }

  open(): void {
    void this.gallery()?.open({ index: 0 });
  }
}
```

The Angular entry exports a function rather than a decorated directive. Its tsdown output needs no Angular library compilation step.

## Verify the examples

Run `bun run build`, then `bun run --cwd apps/examples dev`. Open `/react.html`, `/solid.html`, `/vue.html`, and `/angular.html`. Playwright opens each gallery, navigates to the second item, closes it, changes the indexed source, and opens it again in the configured browser projects.
