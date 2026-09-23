# @ogdakke/fluidbox

A lightbox for image galleries. Use the custom elements with plain HTML, or attach an indexed source when the page renders only some of its thumbnails. The viewer supports keyboard navigation, swiping, zooming, and a filmstrip.

## Getting started

Import the elements and styles in a browser entry:

```ts
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
```

Add a gallery to the page:

```html
<app-gallery aria-label="Photos">
  <app-lightbox src="/photos/first.jpg" alt="A mountain at dusk" close-button>
    <img src="/photos/first-thumb.jpg" alt="A mountain at dusk" width="300" height="200" />
  </app-lightbox>
  <app-lightbox src="/photos/second.jpg" alt="A lake in the morning" close-button>
    <img src="/photos/second-thumb.jpg" alt="A lake in the morning" width="300" height="200" />
  </app-lightbox>
  <app-filmstrip></app-filmstrip>
</app-gallery>
```

The `elements` import registers the custom elements. Import the CSS separately to style the viewer. See the [markup and styling guide](docs/LIGHTBOX.md) for slots, state attributes, and CSS hooks.

For server rendering, import the package root and register the elements after hydration:

```ts
import { registerLightboxElements } from "@ogdakke/fluidbox";

await registerLightboxElements();
```

The package also exports framework bindings at `@ogdakke/fluidbox/react`, `/solid`, `/vue`, and `/angular`.

## Indexed galleries

An indexed source lets a gallery open items whose thumbnails are not currently in the DOM. This is useful with virtual lists. The viewer and filmstrip keep a bounded number of elements mounted.

```ts
import type { AppGallery, LightboxGallerySource } from "@ogdakke/fluidbox";

const gallery = document.querySelector<AppGallery>("app-gallery")!;
const source: LightboxGallerySource = {
  count: photos.length,
  getItem(index) {
    const photo = photos[index]!;
    return {
      id: photo.id,
      src: photo.full,
      thumbnailSrc: photo.thumb,
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
    };
  },
  getOrigin(id) {
    return document.querySelector(`[data-photo-id="${CSS.escape(id)}"]`);
  },
};

gallery.source = source;
gallery.open(0);
```

`getOrigin` is optional. When an item has no mounted thumbnail, the viewer uses a scale and fade transition. Keep IDs, item count, and item metadata stable while the viewer is open. The source API is synchronous; it does not currently handle asynchronous pagination or mutation notifications.

## Development

This repository uses Bun. The package lives in `packages/lightbox`, and `examples/vanilla` is a local playground.

```sh
bun install
bun run dev
bun run build:example
bun run test
bun run lint:all
bun run format:check
```

The playground includes a small gallery and an indexed gallery with 100,000 items. See [browser testing](docs/TESTING.md) for test commands and visual baselines.
