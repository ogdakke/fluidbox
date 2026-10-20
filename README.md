# @ogdakke/fluidbox

A lightbox for the web. The picture flies out of its thumbnail, follows your finger, zooms with a pinch or a double-tap, and flies back to the thumbnail it came from when it closes. One runtime handles the gestures, flights, zoom and the body-level viewer. The custom elements, the plain JavaScript API and the React, Solid, Vue and Angular bindings are thin layers over it.

The documentation lives in [`apps/docs/content`](apps/docs/content/index.md), and the docs site in `apps/docs` serves it.

## Custom elements

Import the elements and styles in a browser entry:

```ts
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
```

Add a gallery to the page:

```html
<fluidbox-gallery aria-label="Photos">
  <fluidbox-item item-id="mountain">
    <button slot="trigger" type="button">
      <img src="/photos/mountain-thumb.jpg" alt="A mountain at dusk" width="300" height="200" />
    </button>
    <template slot="content">
      <picture>
        <source
          type="image/avif"
          srcset="/photos/mountain-1200.avif 1200w, /photos/mountain-2400.avif 2400w"
        />
        <img src="/photos/mountain.jpg" width="2400" height="1600" alt="A mountain at dusk" />
      </picture>
    </template>
  </fluidbox-item>
  <fluidbox-filmstrip></fluidbox-filmstrip>
</fluidbox-gallery>
```

See [Custom elements](apps/docs/content/custom-elements.md).

## Plain JavaScript

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const fluidbox = createFluidbox({
  items: [
    {
      type: "img",
      src: "/photos/mountain.jpg",
      alt: "A mountain at dusk",
      width: 2400,
      height: 1600,
    },
  ],
  controls: true,
});
fluidbox.bind(document.querySelector("button")!, 0);
```

Items are plain objects whose fields are the attributes of the element the viewer draws. `items` can also be a lazy list, `{ count, get(index), indexOf?(id) }`, so a gallery can open items whose thumbnails aren't in the DOM, as in a virtualized grid. See [JavaScript](apps/docs/content/javascript.md) and [Items and origins](apps/docs/content/items-and-origins.md).

## Frameworks

The package exports framework bindings at `@ogdakke/fluidbox/react`, `/solid`, `/vue` and `/angular`. The framework packages are optional peers, so install `@ogdakke/fluidbox` alongside the one your app already uses. Every binding has the same parts (`Root`, `Trigger`, `Viewer`, `Controls`, `Filmstrip`, `Sheet`, ...) and the same patterns. See the [patterns](apps/docs/content/patterns/index.md).

The package root is safe to import on the server. `@ogdakke/fluidbox/elements` defines the elements on import, so it is browser only. In a server-rendered app, `await import("@ogdakke/fluidbox/elements")` after hydration.

## Development

This repository uses Bun. The package lives in `packages/fluidbox`. The examples and test fixtures in `apps/examples` use its built exports.

```sh
bun install
bun run build
bun run dev                 # builds the package, then watches package code and runs Vite
bun run build:examples
bun run build:docs
bun run test
bun run test:contract
bun run test:ssr
bun run test:bundle
bun run test:browser
bun run lint:all
bun run format:check
```

Run `bun run dev` (or `bun run dev:share` to expose it through portless as `fluidbox`) to open the example site in `apps/examples`. It has a page of the eleven patterns for each entry point, and an index of test fixtures at its root. See [browser testing](docs/TESTING.md) for device coverage and visual baselines.

The documentation site lives in `apps/docs`. Run `bun run docs`, or `bun run docs:share` to expose it through portless as `docs.fluidbox`. Both sites share the design tokens and chrome in `apps/design`.

The [public API contract](docs/PUBLIC_API.md) summarizes the API's shape and rules.

Portfolio declares `"@ogdakke/fluidbox": "file:../fluidbox/packages/fluidbox"`, so a fresh checkout works after building this package and running `bun install` in `portfolio-v4`. For a live directory link during development, run `bun link` in `packages/fluidbox`, then `bun link @ogdakke/fluidbox` in `portfolio-v4`. Reapply the consumer link after reinstalling dependencies.
