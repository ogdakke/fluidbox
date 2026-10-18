---
title: Getting started
section: Start
order: 2
---

# Getting started

Install one package, import its styles once, and register the elements or pick a binding.

## Install

```bash
bun add @ogdakke/fluidbox
```

Framework packages are optional peers. Install only `@ogdakke/fluidbox` next to the framework your app already uses.

## Import the styles

The viewer's layout, geometry, and default appearance live in one stylesheet. Import it once in a client entry, before your own overrides.

```ts
import "@ogdakke/fluidbox/styles.css";
```

## Your first gallery

Register the custom elements and write markup. Each `<app-lightbox>` needs a stable `item-id`, a trigger, and an inert content template.

```ts
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
```

```html
<app-gallery aria-label="Photos">
  <app-lightbox item-id="mountain">
    <button slot="trigger" type="button">
      <img src="/photos/mountain-thumb.jpg" alt="A mountain at dusk" width="300" height="200" />
    </button>
    <template slot="content">
      <img src="/photos/mountain.jpg" alt="A mountain at dusk" width="2400" height="1600" />
    </template>
  </app-lightbox>
  <app-filmstrip></app-filmstrip>
</app-gallery>
```

The template is inert, so the full-size image does not load until the viewer opens.

<div data-demo="gallery" data-scenes="meadow,lagoon,ridge" aria-label="First gallery"></div>

## Server rendering

The package root never touches `window` or `document` on import. Register the elements after hydration instead of importing `./elements` on the server:

```ts
import { registerLightboxElements } from "@ogdakke/fluidbox";

await registerLightboxElements();
```

## Entry points

| Import                                        | What it provides                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@ogdakke/fluidbox`                           | `createLightbox()`, `arraySource()`, element registration, and types. Safe to import on the server. |
| `@ogdakke/fluidbox/elements`                  | Registers `<app-gallery>`, `<app-lightbox>`, and `<app-filmstrip>` on import. Browser only.         |
| `@ogdakke/fluidbox/react`                     | The composed `Lightbox` parts and hooks.                                                            |
| `@ogdakke/fluidbox/solid`, `/vue`, `/angular` | Gallery bindings that keep an `<app-gallery>` in sync with a source.                                |
| `@ogdakke/fluidbox/styles.css`                | The viewer stylesheet.                                                                              |

Next, read [Custom elements](./custom-elements.md) or jump to your framework.
