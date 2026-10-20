---
title: Getting started
section: Start
order: 2
description: How to install fluidbox, import its styles, describe items, build a first gallery, and set it up for your framework and for server rendering.
---

# Getting started

## Install

```bash
npm install @ogdakke/fluidbox
```

The framework bindings are in the same package. React, Vue, Solid and Angular are optional peer dependencies, so install only the one your app already uses.

## Import the styles

The viewer's layout and default look are in one stylesheet. Import it once, in a client entry, before your own CSS:

```ts
import "@ogdakke/fluidbox/styles.css";
```

The filmstrip and sheet add-ons have their own stylesheets, `@ogdakke/fluidbox/filmstrip.css` and `@ogdakke/fluidbox/sheet.css`. Import each only if you use that add-on.

## Describe your items

An item is a plain object whose fields are the attributes of the element the viewer draws: `src`, `srcset`, `sizes` and `alt` for an image, as on `<img>`. It needs `width` and `height`, so the viewer can size the slide before the file loads. A `thumbnail` gives the viewer a picture to show while the full image loads.

```ts
import type { FluidboxItem } from "@ogdakke/fluidbox";

export const photos: FluidboxItem[] = [
  {
    type: "img",
    src: "/photos/aurora.jpg",
    alt: "Aurora over the tundra",
    width: 2200,
    height: 3300,
    thumbnail: { src: "/photos/aurora-thumb.jpg", width: 440, height: 660 },
  },
];
```

Each item is known by its `id`, which defaults to its `src`. Give items an `id` of your own when two share a `src`, or when you want to open one by a name. See [Media types](./media.md) for video, iframes and custom content.

## A first gallery

One viewer for the whole list, and a trigger for each thumbnail. Pick your framework in the tabs:

<!-- pattern: basic -->

The examples import `photos` from a local `./data` module, described in [the example data](./patterns/index.md#the-example-data). They import `itemLabel` from `@ogdakke/fluidbox`, which returns an item's `alt` or `title`. Every API shows the default Previous, Next and Close buttons until you give the viewer content of your own. After that, the `controls` option, the `Controls` part or `<fluidbox-controls>` keeps them.

## Framework setup

| Framework        | Import                       | Peer dependency                     |
| ---------------- | ---------------------------- | ----------------------------------- |
| React            | `@ogdakke/fluidbox/react`    | `react` and `react-dom` 18 or later |
| Vue              | `@ogdakke/fluidbox/vue`      | `vue` 3.3 or later                  |
| Solid            | `@ogdakke/fluidbox/solid`    | `solid-js` 1.8 or later             |
| Angular          | `@ogdakke/fluidbox/angular`  | `@angular/core` 17 or later         |
| Custom elements  | `@ogdakke/fluidbox/elements` | none                                |
| Plain JavaScript | `@ogdakke/fluidbox`          | none                                |

Every binding has the same parts with the same names: `Root` holds the items and owns the viewer, `Trigger` opens an item, `Viewer` renders into the viewer's layer, and `Filmstrip` and `Sheet` turn those add-ons on by being there. `useFluidbox()` (`injectFluidbox()` in Angular) reads the state and returns the commands. Each framework page shows them in its own idiom: [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md).

- **Custom elements.** `<fluidbox-gallery>` with `<fluidbox-item>` children. See [Custom elements](./custom-elements.md).
- **Plain JavaScript.** `createFluidbox()`, and `fluidbox.bind()` for each trigger. See [JavaScript](./javascript.md).

## Add-ons

The filmstrip and the sheet are add-ons with their own entries, so their code loads only when you use them. Turn one on, with an option, a framework part or a `<fluidbox-filmstrip>` or `<fluidbox-sheet>` child, and the fluidbox loads its entry. An open waits for it. To bundle an entry up front, import it once in the browser bundle:

```ts
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/filmstrip.css";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";
```

Each needs its stylesheet, `filmstrip.css` or `sheet.css`, whichever way you turn it on. See [Filmstrip and sheet](./filmstrip-and-sheet.md).

## Server rendering

The package root, `@ogdakke/fluidbox`, is safe to import on the server. It has no side effects and touches no browser globals until you call `createFluidbox()`. The add-on entries are safe there too. The framework bindings create the viewer only in the browser, after mount, so they render on the server as plain markup.

Importing `@ogdakke/fluidbox/elements` defines the custom elements, so that entry is browser only. In a server-rendered app, import it after hydration:

```ts
if (typeof customElements !== "undefined") await import("@ogdakke/fluidbox/elements");
```

## Next

- The [patterns](./patterns/index.md) show nine common setups in every framework.
- [Items and origins](./items-and-origins.md) covers large or virtualized lists, and where the flight lands.
- [Styling](./styling.md) shows how to theme the viewer and add your own controls.
