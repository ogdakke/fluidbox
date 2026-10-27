---
title: Angular
section: Frameworks
order: 5
description: The Angular binding for fluidbox, with every directive, component, input, output and inject function, and the Angular-specific behaviour.
---

# Angular

`@ogdakke/fluidbox/angular` builds a gallery from standalone directives and components on your own elements: `fluidboxRoot` owns one viewer for its items, `fluidboxTrigger` opens it, and an `<ng-template fluidboxViewer>` renders your own controls into it. It uses signal inputs, `model()` and `output()`, so it needs Angular 17.3 or later. It works with and without zone.js.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import {
  FluidboxModule,
  injectFluidbox,
  injectFluidboxSheet,
  injectFluidboxSlide,
} from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/baseline.css"; // optional: the default look
```

Add `@ogdakke/fluidbox/styles.css` once, in the `styles` of `angular.json` or by an import. It holds what makes the viewer work, and draws no look of its own: the controls are buttons with their labels as text. `baseline.css` is the default look, round controls with glyphs; leave it out to style the viewer yourself. See [Styling](./styling.md).

`FluidboxModule` imports and exports every part. Each part is also a standalone class of its own, such as `FluidboxRootDirective` and `FluidboxTriggerDirective`, for a component that imports only what it uses. The thumbnails and the sheet are parts of the binding: using `fluidboxThumbnails` or `fluidboxSheet` turns it on. They also need their stylesheets, `@ogdakke/fluidbox/thumbnails.css` and `@ogdakke/fluidbox/sheet.css`.

## A gallery

```ts
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "./data";

@Component({
  selector: "app-photos",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Photos {
  readonly photos = photos;
  readonly label = itemLabel;
}
```

Without a `fluidboxViewer` template, the viewer has the default Previous, Next and Close buttons. With one, it keeps only Close, until your template has a Close of its own. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

```html
<div fluidboxRoot [items]="items" [(value)]="photo">
  <button [fluidboxTrigger]="albumIds" #trigger="fluidboxTrigger">
    <img [src]="trigger.preview().item?.src" alt="" />
    <span fluidboxOverlay flight="live"><ng-template>+3</ng-template></span>
  </button>

  <ng-template fluidboxSlide="note" let-item>
    <ng-template fluidboxMedia><article>{{ item.title }}</article></ng-template>
  </ng-template>

  <ng-template fluidboxViewer>
    <div fluidboxToolbar>
      <span fluidboxCounter></span>
      <div fluidboxZoomControls></div>
      <button fluidboxSlideshow></button>
      <button fluidboxClose></button>
    </div>
    <button fluidboxPrevious></button>
    <button fluidboxNext></button>
    <p fluidboxCaption></p>
    <ng-template fluidboxLoading>Loading…</ng-template>
    <ng-container fluidboxThumbnails />
  </ng-template>

  <ng-template fluidboxSheet [snapPoints]="['40%', '90%']" let-item>…</ng-template>
</div>
```

| Part                                                                                  | Class                                                                          | Role                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `[fluidboxRoot]`                                                                      | `FluidboxRootDirective`                                                        | Owns one viewer for its items. Every other part must be inside it.                          |
| `[fluidboxTrigger]`                                                                   | `FluidboxTriggerDirective`                                                     | Opens an item. Registers its element as the item's origin.                                  |
| `[fluidboxOverlay]`                                                                   | `FluidboxOverlayComponent`                                                     | A badge, caption or scrim on a trigger that fades or flies with the photo.                  |
| `ng-template[fluidboxSlide]`                                                          | `FluidboxSlideDirective`                                                       | The content of an item type's slide.                                                        |
| `ng-template[fluidboxMedia]`                                                          | `FluidboxMediaDirective`                                                       | The box that flies and zooms: its content, or what a plain-JS slide draws.                  |
| `<fluidbox-image>`, `<fluidbox-video>`, `<fluidbox-iframe>`                           | `FluidboxImageComponent`, `FluidboxVideoComponent`, `FluidboxIframeComponent`  | The viewer's own image, video and iframe, with their loading, zoom and error handling.      |
| `button[fluidboxHotspot]`                                                             | `FluidboxHotspotDirective`                                                     | A pin at a point of the picture, which follows pan and zoom.                                |
| `ng-template[fluidboxViewer]`                                                         | `FluidboxViewerDirective`                                                      | Your controls and captions, in the viewer's layer.                                          |
| `[fluidboxToolbar]`, `[fluidboxZoomControls]`                                         | `FluidboxToolbarComponent`, `FluidboxZoomControlsComponent`                    | Groups of controls. Empty, they hold Previous, Next and Close, or the three zoom controls.  |
| `button[fluidboxPrevious]`, `[fluidboxNext]`, `[fluidboxClose]`                       | `FluidboxPreviousDirective`, ...                                               | Run the command, and disable themselves when they can't.                                    |
| `button[fluidboxZoomIn]`, `[fluidboxZoomOut]`, `[fluidboxZoomReset]`                  | `FluidboxZoomInDirective`, ...                                                 | Zoom the image on show. See [Zoom](./patterns/zoom.md#zoom-controls).                       |
| `button[fluidboxFullscreen]`, `button[fluidboxShare]`                                 | `FluidboxFullscreenDirective`, `FluidboxShareDirective`                        | Full screen, and the share sheet or the clipboard. Hidden where they can't work.            |
| `a[fluidboxDownload]`                                                                 | `FluidboxDownloadDirective`                                                    | Saves the item's file. Hidden when the item has none.                                       |
| `button[fluidboxSlideshow]`                                                           | `FluidboxSlideshowDirective`                                                   | Plays and pauses the slideshow.                                                             |
| `[fluidboxCounter]`, `[fluidboxCaption]`                                              | `FluidboxCounterComponent`, `FluidboxCaptionComponent`                         | Where the viewer is, and the item's caption.                                                |
| `ng-template[fluidboxLoading]`, `ng-template[fluidboxError]`, `button[fluidboxRetry]` | `FluidboxLoadingDirective`, `FluidboxErrorDirective`, `FluidboxRetryDirective` | Your loading and error states for the item on show.                                         |
| `[fluidboxThumbnails]`                                                                | `FluidboxThumbnailsDirective`                                                  | Turns the thumbnails on. On an `ng-template`, draws your own thumbnails.                    |
| `ng-template[fluidboxSheet]`, `button[fluidboxSheetSnap]`                             | `FluidboxSheetDirective`, `FluidboxSheetSnapDirective`                         | Turns the sheet on and renders its content for the item on show; moves the sheet to a snap. |

### `fluidboxRoot`

| Input               | Type                                                        | Default                                               | Purpose                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`             | `readonly TItem[] \| FluidboxItemList<TItem>`               | `[]`                                                  | The items, or a list read on demand. See [Items and origins](./items-and-origins.md).                                                                       |
| `[(value)]`         | `string \| null`                                            |                                                       | The open item's id, or `null`, when your signal or field owns it. A `model()`. A change opens, moves or closes the viewer to match.                         |
| `defaultValue`      | `string \| null`                                            |                                                       | The item to open with, when the viewer owns its value.                                                                                                      |
| `labels`            | `Partial<FluidboxLabels>`                                   | English                                               | Every string the viewer shows or announces. See [Labels](./api.md#labels).                                                                                  |
| `zoom`              | `false \| { step?, max?, click?, tap? }`                    | `{ step: 2, max: 4, click: "single", tap: "double" }` | Zoom steps, what a click (`"single"`, `"double"`, `false`) and a tap (`"double"`, `false`) on the photo do, or `false` to turn zoom off. Compared by value. |
| `loop`              | `boolean`                                                   | `false`                                               | Go round: past the last item comes the first, by swipe, key, button and thumbnails. A single item never loops. A bare `loop` attribute is true.             |
| `dismiss`           | `{ drag?: boolean; backdrop?: boolean }`                    | both on                                               | Which gestures close the viewer. Escape and Close always do.                                                                                                |
| `wheel`             | `"dismiss" \| "zoom" \| "navigate" \| "none"`               | `"dismiss"`                                           | What a vertical wheel does on an unzoomed slide.                                                                                                            |
| `slideshow`         | `FluidboxSlideshowOptions`                                  |                                                       | `{ interval, loop, autoplay }`: advance on a timer once something plays it. See [Slideshow](#slideshow).                                                    |
| `reachEndThreshold` | `number`                                                    | `2`                                                   | How near the end `(reachEnd)` fires. A static attribute's string is read as a number.                                                                       |
| `href`              | `(value: string \| null) => string \| undefined`            |                                                       | Where the server-rendered viewer's controls lead before JavaScript runs.                                                                                    |
| `shareUrl`          | `(item) => string \| undefined`                             | `href` of the id                                      | The link Share shares. Without either, Share hides.                                                                                                         |
| `findTrigger`       | `(item, index) => Element \| null`                          |                                                       | Finds the trigger of an item without a bound one, as in a virtualized grid. See [Finding triggers](./items-and-origins.md#the-origin-adapter).              |
| `revealTrigger`     | `(item, index, { signal, phase }) => void \| Promise<void>` |                                                       | Brings an item's trigger into view before the viewer flies back to it.                                                                                      |
| `preload`           | `"intent" \| "press" \| "eager"`                            | `"intent"`                                            | When the viewer's code loads. See [Loading the viewer](./getting-started.md#loading-the-viewer).                                                            |

`value` is a request, not a lock. When the viewer changes on its own, by a swipe or Escape, `(valueChange)` reports it; leave `value` alone and the viewer still changes. To refuse a change, cancel it in `(beforeValueChange)`. The outputs are under [Events](#events).

The root is exported as `fluidbox`: `#fb="fluidbox"` gives the template its `state()` signal and the commands, as `fb.open(2)`.

### `fluidboxTrigger`

`[fluidboxTrigger]="value"` takes the item to open: the item, its id or its index. A list opens its first, and every one closes back onto it. Put it on any element: a `<button>`, an `<a href>`, or an element with a role and a `tabindex`. An item's id is its `id`, else its `src`.

It is exported as `fluidboxTrigger`. Its `preview()` signal is `{ item, index, status }` (`FluidboxTriggerPreview`), the item the trigger shows. While the viewer is open, that is the item it is on. After it closes, it is the last one it showed, so an album cover reopens on it. `item` is `null` when the trigger's items have left the list. Read it in the template; it renders synchronously before the closing flight measures the trigger.

The trigger adds `data-fluidbox-trigger` and `aria-haspopup="dialog"`, and starts loading the item on pointer down. A `(click)` on the same element runs first, and `$event.preventDefault()` in it stops the open. [A link as the trigger](./getting-started.md#a-link-as-the-trigger) covers a trigger that is a link.

### `fluidboxOverlay`

| Input    | Type                                    | Default  | Purpose                              |
| -------- | --------------------------------------- | -------- | ------------------------------------ |
| `flight` | `"none" \| "copy" \| "live" \| "frame"` | `"none"` | How it goes with the photo's flight. |

`"none"` stays on the card, `"copy"` flies a still copy with the photo, `"live"` renders an `<ng-template>` child live in the flying frame, and `"frame"` moves the element itself into the frame, scaling with it, as a scrim does. It gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes, for the enclosing trigger's items. Put it inside a trigger. From the [overlay pattern](./patterns/overlay.md):

```html
<button [fluidboxTrigger]="albumIds" #trigger="fluidboxTrigger">
  @let shown = trigger.preview().item ?? album[0];
  <img [src]="shown.src" [alt]="label(shown)" />
  <span fluidboxOverlay flight="live" class="count">
    <ng-template>+{{ album.length - 1 }}</ng-template>
  </span>
</button>
```

### `fluidboxSlide` and `fluidboxMedia`

`<ng-template fluidboxSlide="note">` is the content of every slide of type `note`, your own or the built-in `image`, `video` and `iframe`. With no value, it is the slide for any type without its own and without a built-in slide. Its context is `let-item`, `let-index="index"` and `let-active="active"`. It renders into the slide's layer, as a view of the root, so the components in it inject from the tree around the root.

`<ng-template fluidboxMedia>` inside it is the slide's box, the element that flies, follows a drag to dismiss and zooms. Its content goes into the box, which the viewer sizes from the item's `width` and `height`, so fill it. `[zoom]` lets it zoom: on by default with a `<fluidbox-image>` in it, off otherwise. `[render]` draws into it with a plain-JS slide renderer. `[class]` and `[attributes]` set the box's classes and attributes: an `ng-template` passes no static attributes, so bind them. Anything in the slide outside `fluidboxMedia` sits in the slide's layer, over the slide, and doesn't fly or zoom.

```html
<ng-template fluidboxSlide="product" let-item>
  <ng-template fluidboxMedia [class]="'product-box'">
    <fluidbox-image [item]="item.image" />
  </ng-template>
  <p class="price">€{{ item.price }}</p>
</ng-template>
```

`let-item` is a `FluidboxItem`: Angular doesn't narrow a template's context from a static attribute, so `fluidboxSlide="product"` can't type `item` as your product. Read your fields through `$any(item)`, or move the content into a component that calls `injectFluidboxSlide<Product>()`.

`<fluidbox-image>`, `<fluidbox-video>` and `<fluidbox-iframe>` draw the viewer's own media into the box, for the slide's item or the `[item]` you give. They keep the built-in media's loading, placeholders, sharper zoom images, error and Retry. `<fluidbox-video>` takes `[attach]`, to load the media yourself, as hls.js does. Pass a stable function: a new one loads the video again.

The open waits for the slide: its first change detection, `@defer` blocks in its `fluidboxMedia` content that are loading, then the images and videos in its box and any `waitUntil`, for at most three seconds in all. A `@defer` block that waits on an interaction, a timer or a condition doesn't hold it, nor does one in the layer around the media.

### `fluidboxHotspot`

| Input           | Type                        | Default | Purpose                                                          |
| --------------- | --------------------------- | ------- | ---------------------------------------------------------------- |
| `x`, `y`        | `FluidboxHotspotCoordinate` |         | Required. Where on the picture: `"42%"`, or pixels of the media. |
| `scaleWithZoom` | `boolean`                   | `false` | Grow with the zoom instead of keeping its screen size.           |

`<button fluidboxHotspot [x] [y]>` is a pin placed on the media of its `fluidboxMedia`, and it must be inside one. Its content names it: the package ships no icon, so give it text, or an icon and an `aria-label`. From the hotspots fixture (`apps/examples/fixtures/hotspots-angular.ts`):

```html
<ng-template fluidboxSlide="room" let-item>
  <ng-template fluidboxMedia>
    <fluidbox-image [item]="item.image" />
    @for (part of parts(); track part.id) {
    <button fluidboxHotspot [x]="part.x" [y]="part.y" [attr.aria-label]="part.name">
      <span aria-hidden="true">+</span>
    </button>
    }
  </ng-template>
</ng-template>
```

- **Coordinates.** A percentage of the picture, as `"42%"`, or a number of pixels of the media's declared `width` and `height`, else of its natural size. The types take a number or `"N%"`; only the custom elements' attributes and untyped JavaScript read a bare string as pixels. They follow `object-fit` and `object-position`. Without an image or video in the box, they are relative to the box.
- **Zoom.** A hotspot keeps its screen size as the photo zooms, unless `scaleWithZoom`; a bare `scaleWithZoom` attribute is true. Keyboard focus on one pans a zoomed photo to it.
- **Presses.** A press on a hotspot doesn't zoom or close the viewer.
- **Motion.** Hotspots hide during flights and a drag to dismiss, and fade in with the controls.
- **Placement.** Nothing between the hotspot and the media box may make a containing block (`position`, `transform`, `filter`, `will-change`). Development builds warn about it, and about a hotspot outside `fluidboxMedia`.
- **Size.** The hotspot code is a chunk of its own, loaded with the first hotspot.

`[data-fluidbox-hotspot]` and `[data-scale-with-zoom]` style them; `baseline.css` draws a round pin.

### `fluidboxViewer`, `fluidboxToolbar` and the controls

`<ng-template fluidboxViewer>` has no inputs. Its view is created when the viewer is, inside the root, and its nodes move into the viewer's layer. Everything in it hides during the opening flight and fades as a close or a drag starts.

`<div fluidboxToolbar>` is a `role="group"` with `data-fluidbox-toolbar`; empty, it holds Previous, Next and Close. The stylesheet gives it `display: contents`, so the controls keep their places until you style it. `<div fluidboxZoomControls>` is the zoom group, named like the zoomed image; empty, it holds Zoom in, Zoom out and Fit.

The controls are directives on your own `<button>`, or an `<a>` for `fluidboxDownload`. With no content a control shows its label from `labels` as text, marked `data-fluidbox-default`. With content, the label becomes its `aria-label`. `[label]` overrides the label for this control; `[label]="false"` names it by its content, for content with visible text. `disabled` follows the viewer's state; bind `[disabled]` to override it. A control that can't work on this device or item gets `hidden`. A `(click)` on it runs first, and `$event.preventDefault()` stops the command. They work anywhere inside the root, in the viewer or on the page.

```html
<button fluidboxClose></button>
<!-- "Close", as text -->
<button fluidboxClose><svg aria-hidden="true">…</svg></button>
<!-- named "Close" by aria-label -->
<button fluidboxClose [label]="false">Done</button>
```

`<span fluidboxCounter>` shows `labels.counter`, as `1 / 4`, or an `<ng-template let-index="index" let-count="count">` child. It is hidden from screen readers, which hear the slide's name. `<p fluidboxCaption>` shows the item's `caption`, or an `<ng-template let-item let-index="index">` child, and describes the dialog. In a slide it is that slide's item; elsewhere the item on show.

`fluidboxFullscreen` gets `data-active` while the viewer is full screen, and `fluidboxSlideshow` while it plays.

### `fluidboxLoading`, `fluidboxError` and `fluidboxRetry`

`<ng-template fluidboxLoading>` renders while the item on show is loading, and `<ng-template fluidboxError let-item let-error="error">` while it failed, in place of the default error message. In a slide they follow that slide. `error` is the cause of the last `mediaerror`. `button[fluidboxRetry]` loads the failed media again. The viewer still announces the error, so your error content needn't be a live region.

```html
<ng-template fluidboxError let-item>
  <p>{{ item.alt }} didn't load.</p>
  <button fluidboxRetry></button>
</ng-template>
```

### `fluidboxThumbnails`

`<ng-container fluidboxThumbnails />` turns the thumbnails on, with each item's `thumbnail`, else its image. On an `<ng-template>`, the template fills each thumbnail button, with the context `let-item`, `let-index="index"` and `let-active="active"` (`FluidboxThumbnailContext`). The strip marks the selected button `data-active` and `data-fluidbox-selected`.

```html
<ng-template fluidboxThumbnails let-index="index" let-active="active">
  <span class="thumb" [class.current]="active">{{ index + 1 }}</span>
</ng-template>
```

### `fluidboxSheet` and `fluidboxSheetSnap`

| Input / output  | Type                                | Default              | Purpose                                                                              |
| --------------- | ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `snapPoints`    | `readonly FluidboxSheetSnapPoint[]` | `["60%", "content"]` | The snaps above the resting one, lowest first: pixels, a percentage, or `"content"`. |
| `dismissMotion` | `"flight" \| "scroll"`              | `"flight"`           | How a swipe down on the photo closes the viewer with the sheet down.                 |
| `(snapChange)`  | `FluidboxSheetEvent`                |                      | The sheet comes to rest at another snap: `$event.snap`, 0 at rest.                   |

The template renders into the sheet, the viewer's `<section data-fluidbox-sheet>` named by `labels.sheet`, for the item on show, with the context `let-item let-index="index"`. It renders again when the item changes. An `ng-template` has no attributes to pass on, so style the sheet through `[data-fluidbox-sheet]`, or put your class on an element in the template. `<button fluidboxSheetSnap="1">`, in the viewer or in the sheet, moves the sheet to snap 1, and back to 0 when it is there. [Thumbnails and sheet](./thumbnails-and-sheet.md) has the details of both.

### The add-on parts

`@ogdakke/fluidbox/angular/embed`, `/angular/model` and `/angular/spin` export the components `FluidboxEmbed` (`<fluidbox-embed [providers] [label]>`, with the Play button's content projected), `FluidboxModel` (`<fluidbox-model [load]>`) and `FluidboxSpin` (`<fluidbox-spin [label] [keep] [turns]>`). Each draws the add-on's slide in the slide's box. From the [product media pattern](./product-media.md):

```html
<ng-template fluidboxSlide="embed"><fluidbox-embed /></ng-template>
<ng-template fluidboxSlide="spin"><fluidbox-spin /></ng-template>
<ng-template fluidboxSlide="model"><fluidbox-model [load]="loadModelViewer" /></ng-template>
```

The add-ons load with their entry, so a page without them pays nothing. `<model-viewer>` itself is about 290 kB gzipped and loads through `load`, when a model first opens or comes on show. Pass a stable `load`.

## Inject functions

Call them in an injection context of a component or directive inside the root, including the content of the slide, viewer, sheet and thumbnails templates.

| Function                 | Returns               | Purpose                                                                                                                                                                                                                                                                                           |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `injectFluidbox()`       | `Signal<FluidboxApi>` | The state (`status`, `value`, `index`, `item`, `count`, `hasPrevious`, `hasNext`, `zoom`, `fullscreen`, `playing`) with `open`, `close`, `next`, `previous`, `zoomTo`, `zoomIn`, `zoomOut`, `zoomReset`, `setFullscreen`, `download`, `share`, `play`, `pause`, `setItems`, `preload` and `load`. |
| `injectFluidbox(select)` | `Signal<T>`           | A computed of what `select` picks from it.                                                                                                                                                                                                                                                        |
| `injectFluidboxSheet()`  | `FluidboxSheetApi`    | `{ snap, setSnap }`: `snap()` is the snap the sheet rests at, 0 without a sheet, and `setSnap(snap, { animate? })` moves it.                                                                                                                                                                      |
| `injectFluidboxSlide()`  | `FluidboxSlideApi`    | Inside a slide: its item and activity, and its hooks into the open. It throws elsewhere.                                                                                                                                                                                                          |

Commands resolve `true` once they happen, and `false` when they were prevented or superseded. A command called before the viewer exists waits for it, then runs. `open` takes the item, its id or its index; without one, it opens the current item, or the first. `preload(target)` starts loading an item a press is likely to open, and returns a function that lets go. `load()` loads the viewer's code now.

```ts
import { Component } from "@angular/core";
import { injectFluidbox } from "@ogdakke/fluidbox/angular";

@Component({
  selector: "app-position",
  standalone: true,
  template: `
    <button type="button" (click)="fluidbox().open(0)">
      {{ fluidbox().index === null ? "Open" : fluidbox().index! + 1 + " / " + fluidbox().count }}
    </button>
  `,
})
export class Position {
  readonly fluidbox = injectFluidbox();
}
```

### `injectFluidboxSlide()`

In a component inside a slide template, it returns:

| Member                     | Purpose                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item()`, `index()`        | Signals of the slide's item and its index. `index` follows new items, which keep a slide whose item moved.                                                                                |
| `active()`                 | A signal of whether the slide is the one on show.                                                                                                                                         |
| `opening`                  | True while an open waits for this slide. Read live.                                                                                                                                       |
| `signal`                   | Aborted when the slide unloads.                                                                                                                                                           |
| `onActiveChange(listener)` | Calls back as the slide comes on show and leaves it. See [Slides that play and pause](./product-media.md#slides-that-play-and-pause).                                                     |
| `waitUntil(promise)`       | Makes the opening flight also wait for what the viewer can't see, such as a canvas's first frame. Call it in the constructor or `ngOnInit`.                                               |
| `origin`                   | What the trigger showed, on the slide an open started from: `origin.video` reads the trigger's `<video>` live, and `origin.model` is its live `<model-viewer>`. Null on the other slides. |
| `onClose(listener)`        | Calls back once as a close from this slide starts, with the origin of the trigger it lands on. Returns a function that stops listening; call it in `ngOnDestroy`.                         |
| `returnPlayback(source)`   | Hands a player's time back to the trigger's video as the viewer closes from this slide. Returns a function that unregisters it; call it in `ngOnDestroy`.                                 |
| `fail(error?)`             | Puts the slide in its error state, with `error` as the `mediaerror`'s cause.                                                                                                              |
| `onZoom(listener)`         | Follows the box's zoom pose. Returns a function that stops listening.                                                                                                                     |

A player of your own continues the trigger's video through `origin` and `returnPlayback`, as in [A player of your own continues the trigger's video](./product-media.md#a-player-of-your-own-continues-the-triggers-video). As the slides fixture's player does (`apps/examples/fixtures/angular-slides.ts`), register it once it exists. Here a `<video>` of the page's own plays every video item, in `<ng-template fluidboxSlide="video"><app-reel /></ng-template>`:

```ts
import {
  Component,
  ElementRef,
  ViewChild,
  type AfterViewInit,
  type OnDestroy,
} from "@angular/core";
import type { FluidboxVideoItem } from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidboxSlide } from "@ogdakke/fluidbox/angular";

@Component({
  selector: "app-reel",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <ng-template fluidboxMedia>
      <video
        #player
        [src]="slide.item().src"
        [currentTime]="from?.currentTime ?? 0"
        [autoplay]="from ? !from.paused : false"
        [muted]="from?.muted ?? false"
        playsinline
      ></video>
    </ng-template>
  `,
})
export class Reel implements AfterViewInit, OnDestroy {
  readonly slide = injectFluidboxSlide<FluidboxVideoItem>();
  readonly from = this.slide.origin?.video;
  @ViewChild("player") player?: ElementRef<HTMLVideoElement>;
  #release?: () => void;

  ngAfterViewInit(): void {
    const player = this.player;
    if (player) this.#release = this.slide.returnPlayback(player.nativeElement);
  }

  ngOnDestroy(): void {
    this.#release?.();
  }
}
```

`onClose` is for content that hands state back other than a video's time. The model slide uses it to turn the card's live model to the view the viewer closes on.

## Events

The root's outputs are the fluidbox's events. `$event.item` is your own object, of the type of `items`.

| Output                  | `$event`                   | When                                                                                                 |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `(valueChange)`         | `string \| null`           | Once an open, move or close goes through. The half of `[(value)]` that writes your signal.           |
| `(beforeValueChange)`   | `FluidboxValueChangeEvent` | Before every open, move and close, from any input. `$event.preventDefault()` stops it.               |
| `(valueChangeComplete)` | `FluidboxValueChangeEvent` | Once the motion of a value change settled: the flight landed, a move came to rest, a close finished. |
| `(zoomChange)`          | `FluidboxZoomEvent`        | The image on show comes to rest at another zoom: `scale`, 1 at fit, and `reason`.                    |
| `(mediaError)`          | `FluidboxMediaErrorEvent`  | A slide's media fails to load, as it shows its error: `kind` and `cause`.                            |
| `(reachEnd)`            | `FluidboxReachEndEvent`    | The open item comes within `reachEndThreshold` of the last: `value`, `index` and `count`.            |

A `model()`'s change carries only the value, so the veto is its own output, the cancelable event plain JS dispatches. It has the `action` (`"open"`, `"move"` or `"close"`), the `reason` and the `item`:

```html
<div
  fluidboxRoot
  [items]="photos"
  [(value)]="photo"
  (beforeValueChange)="unsaved() && $event.action === 'close' && $event.preventDefault()"
>
  …
</div>
```

See [Events](./javascript.md#events) for the reasons and the rest of each event's fields.

### Lazy lists and `(reachEnd)`

`(reachEnd)` asks for more items. It fires once a move settles within `reachEndThreshold` (2 by default) of the last item, once per item count, and never with `loop`. A close and reopen at the same count doesn't fire it again. Any change of the count arms it again, and it fires at once if the open item is already near the new end.

To append, hand the root a longer list. With an array, a new array keeps the slides of the items that stayed. With a list from `createItemList`, call `withCount` on it: the longer list keeps the items already made, the open item and its slides.

```ts
import { Component, signal } from "@angular/core";
import {
  createItemList,
  type FluidboxImageItem,
  type FluidboxReachEndEvent,
} from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";

const photoAt = (index: number): FluidboxImageItem => ({
  type: "image",
  id: `photo-${index}`,
  src: `/photos/${index}.jpg`,
  alt: `Photo ${index + 1}`,
  width: 1600,
  height: 1200,
});

@Component({
  selector: "app-feed",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="list()" reachEndThreshold="4" (reachEnd)="more($event)">
      <button [fluidboxTrigger]="0">Open the feed</button>
    </div>
  `,
})
export class Feed {
  readonly list = signal(createItemList({ count: 20, item: photoAt }));

  more({ count }: FluidboxReachEndEvent): void {
    this.list.update((list) => list.withCount(count + 20));
  }
}
```

`createItemList` returns a `FluidboxLazyItemList`. See [Lazy lists](./items-and-origins.md#lazy-lists).

## Slideshow

The `slideshow` input, `{ interval = 5000, loop, autoplay = false }`, lets the viewer advance on a timer. `loop` defaults to the root's `loop`; without it the slideshow stops on the last slide. `autoplay` plays it once per open. `button[fluidboxSlideshow]` plays and pauses it, and `injectFluidbox()` has `play()`, `pause()` and `playing`. `play()` works without the input, with the defaults; the Slideshow control hides without the input, unless it is playing. Its labels are `playSlideshow` and `pauseSlideshow`. From the slides fixture:

```html
<div fluidboxRoot [items]="photos" [slideshow]="{ interval: 4000 }">
  <!-- the triggers -->
  <ng-template fluidboxViewer>
    <button fluidboxSlideshow></button>
    <button fluidboxClose></button>
  </ng-template>
</div>
```

A hidden tab or a video playing in the slide holds the timer, with `playing` still true, and the interval starts again when the hold ends. A pointer, a key, a wheel or a zoom pauses it until something plays it again. Each move has the reason `"slideshow"`. While it plays, the viewer's live region is quiet, and under reduced motion each move is instant.

## The photo in the URL

The [photo in the address](./patterns/url.md) pattern keeps `?photo=` in step with the viewer through the History API. With the Angular Router, read the query as a signal and navigate from `(valueChange)`. The id is the item's own, so the link survives a reordering:

```ts
import { Component, inject } from "@angular/core";
import { Location } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "./data";

@Component({
  selector: "app-photos",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" [value]="photo()" (valueChange)="follow($event)">
      @for (each of photos; track each.id) {
        <button [fluidboxTrigger]="each.id">
          <img [src]="each.src" [alt]="label(each)" />
        </button>
      }
    </div>
  `,
})
export class Photos {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #location = inject(Location);
  readonly photos = photos;
  readonly label = itemLabel;

  // `?photo=photo-fjord` opens that photo.
  readonly photo = toSignal(
    this.#route.queryParamMap.pipe(
      map((params) => photos.find(({ id }) => id === params.get("photo"))?.id ?? null),
    ),
    { initialValue: null },
  );

  follow(id: string | null | undefined): void {
    const shown = this.photo();
    if (id === undefined || id === shown) return;
    // Back past the entry the open added, or drop the photo from a link you came in on.
    if (id === null && history.state?.photo) return this.#location.back();
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { photo: id },
      queryParamsHandling: "merge",
      // Opening adds an entry, so Back closes the viewer; a move or a close replaces it.
      replaceUrl: shown !== null || id === null,
      state: id === null ? {} : { photo: true },
    });
  }
}
```

Back and Forward change the query, and `[value]` opens, moves or closes the viewer to match. `queryParams: { photo: null }` with `"merge"` drops the parameter and keeps the others.

## Server rendering

The parts render on the server and in the browser alike, and the root makes nothing of the viewer outside a browser. A root whose `value` or `defaultValue` names an image renders the open viewer's copy on the server and on the first render in the browser, and the viewer takes it over as the root starts, with no motion. `href` gives the copy's controls their links, so they work before JavaScript runs. Other item types open after hydration. The repo checks this through `@angular/platform-server`, without zone.js. See [Server rendering](./getting-started.md#server-rendering).

## Patterns

| Pattern                                            | In Angular                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [Gallery](./patterns/basic.md)                     | `fluidboxRoot [items]`, a `[fluidboxTrigger]` per item, the controls in `fluidboxViewer`.                                                  |
| [One trigger for an album](./patterns/overlay.md)  | `[fluidboxTrigger]="albumIds" #trigger="fluidboxTrigger"`, `trigger.preview()`, and `fluidboxOverlay flight="live"` with an `ng-template`. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the trigger.                                                                                   |
| [Custom content](./patterns/renderers.md)          | `<ng-template fluidboxSlide="note">` with a `fluidboxMedia` template.                                                                      |
| [Programmatic control](./patterns/programmatic.md) | `#fb="fluidbox"` or `injectFluidbox()`, and `(beforeValueChange)` with `$event.preventDefault()`.                                          |
| [Zoom](./patterns/zoom.md)                         | `[zoom]="{ step, max }"` or `[zoom]="false"`, `fluidboxToolbar` and `fluidboxZoomControls`.                                                |
| [Hover zoom](./patterns/zoom.md#hover-zoom)        | `hoverZoom` from `@ogdakke/fluidbox/hover-zoom`, in a small directive.                                                                     |
| [Thumbnails](./patterns/thumbnails.md)             | `<ng-container fluidboxThumbnails />`, or an `ng-template` for your own thumbnails.                                                        |
| [Sheet](./patterns/sheet.md)                       | `<ng-template fluidboxSheet [snapPoints]>`, `injectFluidboxSheet()` and `fluidboxSheetSnap`.                                               |
| [Headless controls](./patterns/headless.md)        | Your own buttons in `fluidboxViewer`, using `injectFluidbox()`.                                                                            |
| [Right to left](./patterns/rtl.md)                 | `[labels]`, inside a `dir="rtl"` element.                                                                                                  |
| [Photo in the address](./patterns/url.md)          | `[value]` and `(valueChange)` from a signal that follows `?photo=`; [with the Angular Router](#the-photo-in-the-url), `toSignal`.          |
| [Product media](./product-media.md)                | `<fluidbox-embed>`, `<fluidbox-spin>` and `<fluidbox-model>` in slide templates.                                                           |

## Angular notes

**Inputs change the open viewer in place.** The root passes new `labels`, `zoom`, `loop`, `dismiss`, `wheel`, `slideshow` or `reachEndThreshold` to the viewer through `update()`, so an open viewer stays open. The same goes for a `fluidboxViewer`, `fluidboxThumbnails` or `fluidboxSheet` that comes, goes or changes its inputs. Each part hands over a renderer that stays the same for its life, so only what changed is drawn again. The root reads the slide templates, `findTrigger`, `revealTrigger`, `shareUrl` and the outputs when it uses them. New `items` go through `setItems`: changed items keep the slides of the ones that stayed, and an open viewer stays on the same item id if the new list still has it.

**DI reaches custom content.** Slide, viewer, thumbnails and sheet templates render as views of the root, with the injector where they are declared, so their components inject from the surrounding tree, as the [Custom content](./patterns/renderers.md) example does with a theme token. Components in a slide also inject the slide, through `injectFluidboxSlide()`.

**Zones.** The viewer's listeners and animation frames run outside Angular's zone, and the root brings state changes back in, so a zone app runs change detection only when something it shows changes. Zoneless apps (`provideZonelessChangeDetection()`) need nothing more.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, `preview()` changes and the trigger's view is checked synchronously, so the flight lands on the right picture. The trigger finds its image when it binds, so keep the `<img>` and change its `[src]` instead of swapping in a new element.

**Motion speed.** `--fluidbox-motion-speed` divides the open, close, zoom and slide moves: `2` is twice as fast. Set it on the viewer, or anywhere around the triggers, as the viewer copies `--fluidbox-*` properties from there as it opens. See the [CSS reference](./css-reference.md#inputs).

**Bundle.** The page loads the triggers, the items and the viewer's state. The viewer itself, with its gestures, transitions and slides, loads as `preload` says, by default when a pointer rests on a trigger. See [Loading the viewer](./getting-started.md#loading-the-viewer). The thumbnails, the sheet and the hotspots load when a `fluidboxThumbnails`, a `fluidboxSheet` or the first `fluidboxHotspot` is used, so they cost nothing until then. The package is plain ES modules with no Angular compilation step of its own, and the directives compile in your app.

### Types

The entry exports every part's class, `FluidboxModule`, `FluidboxApi`, `FluidboxCommands`, `FluidboxSheetApi`, `FluidboxSlideApi`, `FluidboxItemContext`, `FluidboxThumbnailContext`, `FluidboxCounterContext`, `FluidboxErrorContext`, `FluidboxMediaAttributes` and `FluidboxTriggerPreview`, the event classes (`FluidboxValueChangeEvent`, `FluidboxZoomEvent`, `FluidboxMediaErrorEvent`, `FluidboxReachEndEvent`, `FluidboxSheetEvent`) and the core types you use with them: the item types, the lists, `FluidboxTarget`, `FluidboxState`, `FluidboxLabels`, `FluidboxHotspotCoordinate` and `FluidboxSlide`.
