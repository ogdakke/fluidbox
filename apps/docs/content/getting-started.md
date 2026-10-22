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

Every binding has the same parts with the same names: `Root` holds the items and owns the viewer, `Trigger` opens an item, `Viewer` renders into the viewer's layer, and `Filmstrip` and `Sheet` turn those add-ons on by being there. `useFluidbox()` (`injectFluidbox()` in Angular) reads the state and returns the commands. Each framework page shows them in its own idiom: [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md). [Next.js](./nextjs.md) covers the React binding with server components and `next/image`.

- **Custom elements.** `<fluidbox-gallery>` with `<fluidbox-item>` children. See [Custom elements](./custom-elements.md).
- **Plain JavaScript.** `createFluidbox()`, and `fluidbox.bind()` for each trigger. See [JavaScript](./javascript.md).

## Loading the viewer

The page loads the triggers, the items and the viewer's state. The viewer itself, with its gestures, transitions and slides, is a chunk of its own. By default it loads when a mouse rests on a trigger for 100 ms, a finger or pen touches one, or one takes focus, so it has usually arrived by the time the click does. An open loads it if it hasn't.

The `loading` option picks the moment:

| `loading`           | The viewer's code loads                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `"hover"` (default) | When a mouse rests on a trigger for 100 ms, a finger or pen touches one, or one takes focus. |
| `"press"`           | When a trigger is pressed. Nothing loads for a pointer that only passes over.                |
| `"eager"`           | Once the page is idle, whether or not anyone opens a viewer.                                 |

For a signal of your own, call `load()`. A route that's about to show the gallery, or a menu that leads to it, can start the download early:

```ts
menu.addEventListener("toggle", () => void fluidbox.load(), { once: true });
```

`load()` resolves `true` once the code has loaded and `false` if it failed, as when offline. A failed load tries again on the next call or open. The bindings take `loading` on Root and put `load` next to the commands, and `<fluidbox-gallery>` has a `loading` attribute and a `load()` method.

## Add-ons

The filmstrip and the sheet are add-ons with their own entries, so their code loads only when you use them. Turn one on, with an option, a framework part or a `<fluidbox-filmstrip>` or `<fluidbox-sheet>` child, and the fluidbox loads its entry. An open waits for it. To bundle an entry up front, import it once in the browser bundle:

```ts
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/filmstrip.css";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";
```

Each needs its stylesheet, `filmstrip.css` or `sheet.css`, whichever way you turn it on. See [Filmstrip and sheet](./filmstrip-and-sheet.md).

## A link as the trigger

Make each trigger a link to its full image, and the gallery works before its JavaScript has loaded, or without it:

```html
<a href="/photos/canyon-2400.jpg" class="thumb">
  <img src="/photos/canyon-480.jpg" alt="Canyon walls at dusk" width="480" height="320" />
</a>
```

Once the viewer binds the link, a click opens the viewer and the page stays where it is. A click with Cmd, Ctrl, Shift or Alt held, or with the middle button, still opens the image in a new tab or window, as links do. A `click` listener that calls `preventDefault()` before the trigger's own stops the open, and the link with it. If the viewer can't open, as when its code fails to load offline, the link is followed after all. This works the same in every binding and in `<fluidbox-item>`.

A `<button>` is the other good trigger. A `<div>` or a bare `<img>` can't take focus or say what it does, so a keyboard or a screen reader can't use it; in development the trigger warns about one that has no `role` and `tabindex`.

## Server rendering

The package root, `@ogdakke/fluidbox`, is safe to import on the server. It has no side effects and touches no browser globals until you call `createFluidbox()`. The add-on entries are safe there too. The framework bindings create the viewer only in the browser, after mount, so they render on the server as plain markup. [Next.js](./nextjs.md) walks through one server-rendered setup end to end.

Importing `@ogdakke/fluidbox/elements` defines the custom elements, so that entry is browser only. In a server-rendered app, import it after hydration:

```ts
if (typeof customElements !== "undefined") await import("@ogdakke/fluidbox/elements");
```

### Content Security Policy

The viewer runs under a strict policy such as `default-src 'self'; style-src 'self'; script-src 'self'; require-trusted-types-for 'script'`. It builds its DOM node by node, never from HTML strings, so Trusted Types has nothing to refuse, and it sets styles through the CSSOM, which `style-src` allows. Serve the stylesheets as files, with `<link>`.

A React `Root` that renders open draws the open viewer on the server, for the viewer to take over once it loads. That copy has no inline styles either: the stylesheet places it, and its image's `width` and `height` carry the photo's shape. Until the viewer takes over, the copy is a labelled region rather than a dialog, since nothing holds focus in it yet. Its controls are links where `href` gives them an address, and inert where it doesn't.

## Next

- The [patterns](./patterns/index.md) show nine common setups in every framework.
- [Items and origins](./items-and-origins.md) covers large or virtualized lists, and where the flight lands.
- [Styling](./styling.md) shows how to theme the viewer and add your own controls.
