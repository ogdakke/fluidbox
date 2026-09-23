# Lightbox

The viewer extracted from `portfolio-v4`. This repository is a Bun workspace with one installable package, `@dw/lightbox`. It is private and linked locally while the public API is being developed.

## Current usage

```ts
import "@dw/lightbox/elements";
import "@dw/lightbox/styles.css";
```

The `elements` entry registers `<app-lightbox>`, `<app-gallery>`, and `<app-filmstrip>`. The CSS entry is explicit. See [the styling and markup contract](docs/LIGHTBOX.md) for slots, state attributes, and styling hooks.

The root import is safe to evaluate during server rendering:

```ts
import { registerLightboxElements } from "@dw/lightbox";

// Run after hydration or in a client-only entry.
await registerLightboxElements();
```

The element implementation remains browser-only. Framework bindings are not exported yet. Bindings will use distinct `/react`, `/solid`, `/vue`, and `/angular` entries in this same package.

## Indexed galleries and virtual lists

A host list can render only its visible thumbnails and give `<app-gallery>` an indexed source. The gallery creates one persistent controller, so recycling a host thumbnail while the viewer is open does not close it.

```ts
import "@dw/lightbox/elements";
import type { AppGallery, LightboxGallerySource } from "@dw/lightbox";

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
// Call this from the host list's item click handler:
gallery.open(index);
```

`getOrigin` is optional. If the item has no mounted origin, opening and closing use a scale-and-fade transition. IDs, count, and indexed metadata should remain stable while the viewer is open. The source API is synchronous today; asynchronous pagination and mutation notifications are not implemented yet. The viewer and filmstrip each keep a bounded DOM window. [Browser testing and baseline](docs/TESTING.md) cover 100,000-item sources.

## Development

```sh
bun install
bun run dev                 # Standalone vanilla example (works when wrapped by Portless)
bun run dev:share           # Portless LAN URL for phone and browser testing
bun run build:example       # Build that example
bun run test
bun run lint:all
bun run format:check
bun run format
```

`dev:share` runs the example through Portless as `lightbox.local` on the local network. You can also run `portless lightbox --tailscale --force bun run dev`; the root `dev` script invokes Vite directly so it receives Portless's assigned port. Portless must be installed globally, as in the portfolio setup. Its startup output prints the actual URL; use that address on your phone while it is on the same network. The page includes a small DOM gallery and a 100,000-item indexed gallery.

The repository has one package under `packages/lightbox`. Workspace example apps can be added under `examples/` to exercise framework bindings and SSR without creating more installable packages.

`portfolio-v4` links the package with `file:../lightbox/packages/lightbox`. A checkout of both repositories as siblings is required for its local install and build.
