---
title: Hotspots
section: Guides
order: 4.7
description: Buttons pinned to points of a photo or video in the viewer, as a product page marks the parts of a room: slide.hotspot(), the Hotspot parts, coordinates in percentages or pixels, placement inside the media box, zoom, focus and the CSS API.
---

# Hotspots

A hotspot is a `<button>` on a point of the media in a slide, such as a pin on each product in a room. It sits on the painted image or video, `object-fit` and all, moves with the zoom and keeps its screen size, and hides during the flights. You fill it and name it: the package ships no icon and no label for it.

A hotspot is added from a slide, so the slide must be one you draw: a [type of your own](./media.md#types-of-your-own), or a built-in type drawn through `slides`. Its code is an on-demand chunk, which the viewer loads the first time a slide adds a hotspot; a gallery without hotspots never loads it.

## In plain JavaScript

`slide.hotspot(options)` returns the button, already in the media box. Give it a name with text or `aria-label`, and any content and class you like:

```ts
import {
  createFluidbox,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
} from "@ogdakke/fluidbox";

interface RoomItem extends FluidboxCustomItemBase<"room"> {
  readonly image: FluidboxImageItem;
  readonly parts: readonly { name: string; x: `${number}%` | number; y: `${number}%` | number }[];
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    room: RoomItem;
  }
}

declare const rooms: RoomItem[];

createFluidbox({
  items: rooms,
  slides: {
    room: (slide) => {
      const undraw = slide.drawImage(slide.item.image);
      for (const { name, x, y } of slide.item.parts) {
        const pin = slide.hotspot({ x, y });
        pin.className = "hotspot-pin";
        pin.setAttribute("aria-label", name);
        pin.addEventListener("click", () => console.log(name));
      }
      return undraw;
    },
  },
});
```

| Option          | Type                        | What it does                                                         |
| --------------- | --------------------------- | -------------------------------------------------------------------- |
| `x`             | `FluidboxHotspotCoordinate` | Across the painted media: `"42%"`, or pixels counted on its `width`. |
| `y`             | `FluidboxHotspotCoordinate` | Down the painted media: `"30%"`, or pixels counted on its `height`.  |
| `scaleWithZoom` | `boolean`                   | Grow with the zoom instead of keeping its screen size. Default off.  |

The options are `FluidboxHotspotOptions`, and a coordinate is a `FluidboxHotspotCoordinate`: a percentage string or a number. Both types are exported from `@ogdakke/fluidbox` and from every binding. Remove the button to take it out; the runtime empties the box after your slide's cleanup runs. The example pages `hotspots.html`, and `hotspots-react.html`, `hotspots-vue.html`, `hotspots-solid.html`, `hotspots-angular.html` and `hotspots-elements.html` in `apps/examples`, show them on a photo in a box of its own shape, letterboxed, in a box that fills the stage, and growing with the zoom.

## In a framework

Each binding has a hotspot part that you put inside the slide's `Media`, with your content as its children:

| Binding         | Part                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| React           | `Fluidbox.Hotspot` with `x`, `y`, `scaleWithZoom` and button props        |
| Vue             | `Fluidbox.Hotspot` with `x`, `y`, `scale-with-zoom` and button attributes |
| Solid           | `Fluidbox.Hotspot` with `x`, `y`, `scaleWithZoom` and button props        |
| Angular         | `<button fluidboxHotspot [x] [y] scaleWithZoom>` in `fluidboxMedia`       |
| Custom elements | `<fluidbox-hotspot x y scale-with-zoom>` in `<fluidbox-media>`            |

See [React](./react.md), [Vue](./vue.md), [Solid](./solid.md), [Angular](./angular.md) and [Custom elements](./custom-elements.md#hotspots) for the code. A binding of your own places a button it renders with `placeHotspot(slide, button, options)` from `@ogdakke/fluidbox/kit`, and calls it again as the options change.

## Coordinates

- A percentage is a share of the painted media. A number counts pixels of the drawn image or video as its `width` and `height` attributes declare them, else its natural size. A string without `%`, as an attribute gives, counts as pixels.
- They follow `object-fit` (`contain`, `cover`, `fill`, `none` and `scale-down`) and `object-position`, so a pin stays on its point in a letterboxed or cropped box.
- In a slide that draws no image or video, they are relative to the media box, and numbers count on the slide item's `width` and `height`.
- The hotspots lay out again as the box or its media resizes and as the media loads. A hotspot stays hidden until it is first placed.

## Placement

A hotspot must be inside the slide's media box, and nothing between it and the box may establish a containing block: no `position`, `transform`, `filter` or `will-change` on the elements in between. Development builds warn when a hotspot is outside the box, when an element between positions it, and when it has no accessible name.

## Behaviour

- Hotspots keep their screen size as the media zooms, unless `scaleWithZoom`.
- Focus from the keyboard on a hotspot of a zoomed image pans the image to it.
- A press on a hotspot doesn't zoom or close the viewer. A press that begins on one and ends beside it does nothing.
- Hotspots are hidden during the flights and a drag to dismiss, and fade in and out with the controls.

## CSS

Each hotspot has `data-fluidbox-hotspot`, and `data-scale-with-zoom` with `scaleWithZoom`. `styles.css` makes it absolute in the box, centres it on its point with `translate: -50% -50%`, and keeps its screen size with `scale: calc(1 / var(--fluidbox-zoom-scale))`. Your styles give it its look:

```css
.hotspot-pin {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid white;
  border-radius: 50%;
  background: color-mix(in srgb, #2563eb 85%, transparent);
}
```

A `scale` or `translate` of your own on the button replaces the runtime's; put effects on an element inside it instead. See the [CSS reference](./css-reference.md#parts).
