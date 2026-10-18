---
title: Solid
section: Frameworks
order: 2
---

# Solid

`useFluidboxGallery(source)` returns a ref callback that keeps an `<app-gallery>` in sync with a signal. The binding registers the custom elements on mount.

```tsx
/** @jsxImportSource solid-js */
import { createSignal, For } from "solid-js";
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { AppGallery } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "app-gallery": JSX.HTMLAttributes<AppGallery>;
    }
  }
}

function Photos() {
  let gallery: AppGallery | undefined;
  const [source, setSource] = createSignal(photosSource);
  const bind = useFluidboxGallery(source);
  return (
    <app-gallery
      ref={(node) => {
        gallery = node as AppGallery;
        bind(gallery);
      }}
    >
      <For each={photos}>
        {(photo, index) => (
          <button
            type="button"
            data-origin-id={photo.id}
            onClick={() => gallery?.open({ index: index() })}
          >
            <img src={photo.thumbnail?.src} alt="" />
          </button>
        )}
      </For>
    </app-gallery>
  );
}
```

Set `gallery.origins` to an [origin adapter](./sources-and-origins.md#origins) so flights start from your thumbnails. Changing the signal rebinds the gallery; the next open uses the new collection.

Solid TypeScript apps need the `app-gallery` entry in `JSX.IntrinsicElements`, as above. `useFluidboxElements()` registers elements for standalone `<app-lightbox>` markup.
