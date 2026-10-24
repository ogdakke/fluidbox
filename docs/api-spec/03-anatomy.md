# 3. Anatomy

The parts, shown once in React with every prop, then the exact equivalents in Vue, Solid,
Angular and the custom elements.

## 3.1 The whole tree

```tsx
<Fluidbox.Root items value onValueChange>
  <Fluidbox.Trigger value>
    {" "}
    {/* a button on the page */}
    <Fluidbox.Overlay flight /> {/* a badge or caption on the trigger */}
  </Fluidbox.Trigger>

  <Fluidbox.Slides image video iframe embed model spin default />

  <Fluidbox.Viewer>
    {" "}
    {/* the viewer's layer */}
    <Fluidbox.Toolbar>
      <Fluidbox.Counter />
      <Fluidbox.ZoomControls>
        <Fluidbox.ZoomOut /> <Fluidbox.ZoomIn /> <Fluidbox.ZoomReset />
      </Fluidbox.ZoomControls>
      <Fluidbox.Close />
    </Fluidbox.Toolbar>
    <Fluidbox.Previous /> <Fluidbox.Next />
    <Fluidbox.Caption />
    <Fluidbox.Thumbnails />
    <Fluidbox.SheetSnap to={1} />
  </Fluidbox.Viewer>

  <Fluidbox.Sheet snapPoints>…</Fluidbox.Sheet>
</Fluidbox.Root>;

{
  /* Inside a slide (a Slides prop's content): */
}
<Fluidbox.Media zoom>
  {" "}
  {/* the box that flies and zooms */}
  <Fluidbox.Image /> {/* or Video, Iframe, Model, Embed, Spin */}
</Fluidbox.Media>;
```

Where each part may be:

| Part                                              | Must be inside                       | Renders into                                   |
| ------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `Root`                                            | —                                    | nothing of its own                             |
| `Trigger`                                         | `Root`                               | the page                                       |
| `Overlay`                                         | `Trigger`                            | the page, and the flight while it flies        |
| `Slides`                                          | `Root` (anywhere, `Viewer` included) | nothing; it registers slides                   |
| `Media`, `Image`, `Video`, `Iframe`, add-on parts | a slide                              | the slide's media box                          |
| anything else in a slide                          | a slide                              | the slide's layer                              |
| `Viewer`                                          | `Root`                               | the viewer's layer (`[data-fluidbox-portal]`)  |
| `Toolbar`, `ZoomControls`, controls, `Counter`    | `Root` (normally `Viewer`)           | where they are                                 |
| `Caption`                                         | `Root`, `Viewer` or a slide          | where it is                                    |
| `Thumbnails`                                      | `Root` (normally `Viewer`)           | the thumbnails dock (`[data-fluidbox-addons]`) |
| `Sheet`                                           | `Root`                               | the runtime's `<section data-fluidbox-sheet>`  |
| `SheetSnap`                                       | `Root`                               | where it is                                    |

`Slides`, `Thumbnails` and `Sheet` may sit outside `Viewer` because they don't render into the
layer; putting them inside reads better, and the examples do.

## 3.2 Root

| Prop                    | Type                                                        | Default               |                                                                                               |
| ----------------------- | ----------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `items`                 | `FluidboxItems<TItem>`                                      | required              | An array or a lazy list. A new array equal field by field to the current one changes nothing. |
| `value`                 | `string \| null`                                            | —                     | The open item's id, or `null`. Controlled when present.                                       |
| `defaultValue`          | `string \| null`                                            | `null`                | Uncontrolled start.                                                                           |
| `onValueChange`         | `(value, details) => void`                                  | —                     | Before every open, move and close. `details.cancel()` stops it.                               |
| `onValueChangeComplete` | `(value, details) => void`                                  | —                     | After the motion settles.                                                                     |
| `loop`                  | `boolean`                                                   | `false`               |                                                                                               |
| `labels`                | `Partial<FluidboxLabels>`                                   | —                     | Compared by value.                                                                            |
| `zoom`                  | `false \| { step?, max? }`                                  | `{ step: 2, max: 4 }` | Compared by value.                                                                            |
| `preload`               | `"intent" \| "press" \| "eager"`                            | `"intent"`            |                                                                                               |
| `findTrigger`           | `(item, index) => HTMLElement \| null`                      | —                     | For triggers the page doesn't render.                                                         |
| `revealTrigger`         | `(item, index, { signal, phase }) => void \| Promise<void>` | —                     |                                                                                               |
| `href`                  | `(value: string \| null) => string \| undefined`            | —                     | Links for the server-rendered open viewer's controls (§7.2).                                  |
| `onZoomChange`          | `(event: FluidboxZoomEvent) => void`                        | —                     |                                                                                               |
| `children`              | `ReactNode`                                                 | —                     |                                                                                               |

Behaviour:

- Creates the fluidbox on first render and touches nothing until a trigger is pressed or the
  viewer opens, as now.
- `value` is a request, not a lock. When it changes, the viewer opens, moves or closes to match.
  When the viewer changes on its own (a swipe, Escape), `onValueChange` reports it; if you don't
  update `value`, the viewer still changes. To refuse a change, call `details.cancel()`. §7.1 and
  §8.1 explain why.
- Renders the server copy of the open viewer when `value` names an image in an array (§7.2).

## 3.3 Trigger

| Prop                   | Type                                          | Default  |                                                                                                                                                   |
| ---------------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                | `FluidboxTarget \| readonly FluidboxTarget[]` | required | One item, or a list: the first opens, every one closes back onto this trigger.                                                                    |
| `asChild`              | `boolean`                                     | `false`  | Decorate the single child instead of rendering a `<button>`.                                                                                      |
| `children`             | `ReactNode \| ((preview) => ReactNode)`       | —        | A function gets `{ item, index, status }`: the item the trigger shows, which follows the viewer while it's open and stays on the last one viewed. |
| HTML button attributes |                                               |          |                                                                                                                                                   |

| Data attribute                                     | When                   |
| -------------------------------------------------- | ---------------------- |
| `data-fluidbox-trigger`                            | always                 |
| `data-fluidbox-status`, `data-open`, `data-closed` | while its item is open |

Accessibility: renders a `<button type="button">`; `aria-haspopup="dialog"` unless set. A
development warning fires if an `asChild` element isn't a button, a link, or an element with a role
and tabindex (`trigger.ts:120`). A plain click opens; a modified click on a link follows the link.

The children function replaces `onPreviewChange`: the runtime asks the trigger to show the landing
item before the closing flight measures it, and the binding re-renders synchronously
(`flushSync` in React, as now).

## 3.4 Viewer

| Prop       | Type        |                                                    |
| ---------- | ----------- | -------------------------------------------------- |
| `children` | `ReactNode` | Rendered into the viewer's layer through a portal. |

Default controls: without a `Viewer`, the viewer shows Previous, Next and Close. With one, it keeps
only the default Close, and that steps aside once the layer holds its own Close. This is the core's
rule today (`controls` default `["close"]` with a `viewer`); Vue and Solid currently drop every
default, and React doesn't, so the rule is made the same everywhere. A viewer always has a visible
way out.

## 3.5 Slides

| Prop                                                                              | Type                                    |                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| one per item type: `image`, `video`, `iframe`, `embed`, `model`, `spin`, your own | `(slide: { item, index }) => ReactNode` | The slide's content. `item` is narrowed to that type.       |
| `default`                                                                         | `(slide: { item, index }) => ReactNode` | Any type without its own prop and without a built-in slide. |

Behaviour:

- Renders nothing. It passes renderers to the core's `slides` option. Each renderer mounts the
  returned content through a portal into the slide's layer, inside a provider that
  `useFluidboxSlide()`, `Media` and the built-in parts read.
- Types it doesn't list render the built-in slide (image, video, iframe) or `default`.
- A new function each render is fine: renderers are looked up when a slide mounts, through the
  same `Proxy` the `renderers` prop uses now (`react/src/index.ts:294`).
- Only one `Slides` per `Root`. A second one throws in development.

```tsx
<Fluidbox.Slides
  product={({ item }) => (
    <>
      <Fluidbox.Media>
        <Fluidbox.Image item={item.image} />
      </Fluidbox.Media>
      <p className="price">€{item.price}</p>
    </>
  )}
/>
```

## 3.6 Media

| Prop            | Type                    | Default                                       |                                                                                                                  |
| --------------- | ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `zoom`          | `boolean`               | `true` when it holds an `Image`, else `false` | Whether pinch, double-tap, wheel and the zoom controls zoom the box. Ignored while the Root's `zoom` is `false`. |
| `render`        | `FluidboxSlideRenderer` | —                                             | Draw into the box with a plain-JS renderer. The add-on parts use this.                                           |
| `children`      | `ReactNode`             | —                                             | Portalled into the box.                                                                                          |
| HTML attributes |                         |                                               | Applied to the runtime's box element, as `Sheet` does to its section.                                            |

The box is the runtime's element, not one the part renders (§5.1). It is sized from the item's
`width` and `height`, so content should fill it (`width: 100%; height: 100%`).

| Data attribute              |                   |
| --------------------------- | ----------------- |
| `data-fluidbox-media`       | the box           |
| `data-zoomed` on the dialog | the box is zoomed |

Accessibility: for content of your own, the box gets `role="group"` and `aria-label` from the
item's `title`, as `data-fluidbox-item-content` does today (`viewer-strip.ts:528-531`).

## 3.7 Image, Video, Iframe

| Prop   | Type                   | Default          |                   |
| ------ | ---------------------- | ---------------- | ----------------- |
| `item` | the matching item type | the slide's item | The item to draw. |

They draw the runtime's built-in media into the box with `slide.drawImage` / `drawVideo` /
`drawIframe`, so they keep the decode staging, placeholders, sharper zoom candidates, error and
retry, video hand-off and iframe sandbox. They render nothing themselves. Outside a `Media`, each
renders its own. Outside a slide, they throw.

`Video` also takes `attach`, the `FluidboxVideoOptions.attach` of §2.8: a function that loads the
media into the runtime's `<video>` (hls.js, dash.js, or native HLS) and cleans up when its signal
aborts. With it the runtime sets no `src` or `<source>`. To stream every video item:

```tsx
<Fluidbox.Slides video={() => <Fluidbox.Video attach={attachHls} />} />
```

Vue `<Fluidbox.Video :attach>`, Solid `<Fluidbox.Video attach>`, Angular
`<fluidbox-video [attach]>`, elements `gallery.slides = { video: videoSlide({ attach }) }`. Pass a
stable function; a new `attach` reloads the video.

## 3.8 Toolbar, ZoomControls and the controls

**Toolbar** — `<div role="group" data-fluidbox-toolbar>`, HTML attributes passed through. With no
children it renders Previous, Next and Close, the same DOM the default controls have. The default
stylesheet gives it `display: contents`, so controls keep their default places until you style it.

It is `role="group"`, not `role="toolbar"`: a toolbar promises arrow-key movement between its
buttons, and the arrow keys belong to the slides.

**ZoomControls** — `<div role="group" aria-label={labels.zoomed} data-fluidbox-zoom-controls>`. With
no children it renders ZoomIn, ZoomOut and ZoomReset. This replaces `<Controls zoom />`.

**Close, Previous, Next, ZoomIn, ZoomOut, ZoomReset** — unchanged from today (`action`, `react/src/index.ts:685`):

|                |                                                                                     |
| -------------- | ----------------------------------------------------------------------------------- |
| Element        | `<button type="button">`                                                            |
| Props          | HTML button attributes; `children` replaces the default icon                        |
| `aria-label`   | from the labels when the button has no children                                     |
| Disabled       | native `disabled` from state: no previous, no next, not zoomable, at a zoom bound   |
| Data attribute | `data-fluidbox-close`, `-previous`, `-next`, `-zoom-in`, `-zoom-out`, `-zoom-reset` |
| Click          | your `onClick` first; `preventDefault()` there skips the command                    |

**Counter** — `<span data-fluidbox-counter aria-hidden="true">`. Text from `labels.counter(index,
count)`, or `children({ index, count })`. Hidden while closed. It is `aria-hidden` because the slide
names and the announcer already say the position; a counter read out as well would repeat it.

**Caption** — `<div data-fluidbox-caption data-fluidbox-description>`. Shows `item.caption`, or
`children({ item, index })`. Inside a slide it shows that slide's item; elsewhere the item on show.
`data-fluidbox-description` makes it the dialog's `aria-describedby`, as now. Renders nothing (and
is not a description) when there is no caption.

## 3.9 Overlay

| Prop                 | Type                                    | Default  |     |
| -------------------- | --------------------------------------- | -------- | --- |
| `flight`             | `"none" \| "copy" \| "live" \| "frame"` | `"none"` |     |
| `children`           | `ReactNode`                             |          |     |
| HTML span attributes |                                         |          |     |

| `flight`  | What happens                                                                                          | Today                                        |
| --------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `"none"`  | Stays on the card; gets `--fluidbox-closed` and `data-fluidbox-phase` as the viewer opens and closes. | `ThumbnailOverlay`                           |
| `"copy"`  | A still copy flies with the photo.                                                                    | `travel` (elements, plain JS `travel: true`) |
| `"live"`  | Its children render live in the flying frame.                                                         | `ThumbnailOverlay travel` in the bindings    |
| `"frame"` | The element itself moves into the flying frame and scales with it, as a scrim does.                   | `FrameLayer`                                 |

Renders `<span data-fluidbox-trigger-overlay="{flight}">`. Must be inside a `Trigger`; its items
are the trigger's. Several overlays may sit on one trigger: a scrim (`"frame"`) and a count
(`"live"`) side by side replace today's `ThumbnailOverlay` with a `FrameLayer` inside it.

Check before building: today a frame layer can only exist inside a travelling overlay
(`thumbnail-overlay-runtime.ts:193`, `frameLayer` is read only for `behavior === "travel"`). Two
sibling registrations on one trigger need the runtime to accept a frame layer as its own
registration. The change is local to `thumbnail-overlay-runtime.ts`; the plan lists it (§9.2).

## 3.10 Thumbnails

| Prop       | Type                                                |                                                                   |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `children` | `(thumbnail: { item, index, active }) => ReactNode` | Fills each thumbnail button. Leave it out for the default images. |

Being there turns the thumbnails on (needs `import "@ogdakke/fluidbox/thumbnails"`). Buttons have
`data-fluidbox-thumbnails-item`, `role="option"`, `aria-selected`, and `data-active` /
`data-fluidbox-selected` on the current one. `active` is new: the render function no longer needs
to read the state to style the current thumbnail.

## 3.11 Sheet and SheetSnap

`Sheet`: `snapPoints`, `dismiss`, `onSnapChange(event)`, `children({ item, index })`, HTML
attributes (applied to the runtime's `<section data-fluidbox-sheet>`). Unchanged apart from
`onSnapChange` moving here from the Root's `onSheetChange`.

`SheetSnap`: `<button type="button" data-fluidbox-sheet-snap={to}>`, prop `to: number`. Gets
`aria-expanded` from the sheet, as the stop buttons do now.

`useFluidboxSheet()` returns `{ snap, setSnap }`.

## 3.12 Hooks

```ts
function useFluidbox<TItem>(): FluidboxApi<TItem>;
function useFluidbox<TSelected, TItem>(select: (api: FluidboxApi<TItem>) => TSelected): TSelected;

function useFluidboxSheet(): {
  readonly snap: number;
  setSnap(snap: number, o?: { animate?: boolean }): void;
};

/** Inside a slide. Throws elsewhere. */
function useFluidboxSlide<TItem>(): {
  readonly item: TItem;
  readonly index: number;
  readonly active: boolean; // re-renders as it changes
  readonly opening: boolean; // true while an open waits for this slide (§5.3)
  readonly signal: AbortSignal;
  onActiveChange(listener: (active: boolean) => void): () => void;
  /** Make the opening flight also wait for this promise (§5.3). */
  waitUntil(promise: Promise<unknown>): void;
};
```

`FluidboxApi` is the state (`status, value, index, item, count, hasPrevious, hasNext, zoom`) and
the commands (`open, close, next, previous, zoomTo, zoomIn, zoomOut, zoomReset, setItems, preload,
load`).

Every open waits for the opened slide's images and videos without a call (§5.3). `waitUntil` is
for what the engine can't see, such as a canvas's first frame. Call it during render or in a
layout effect so it lands before the slide commits; StrictMode's second call adds the same
promise again, which is harmless.

Each binding reports the slide's commit to the core: React from a layout effect in the slide
host, Vue from `onMounted`, Solid from `onMount`, Angular after the mount's `detectChanges()`.
App code never does.

## 3.13 Vue

Vue takes the same parts from the same `Fluidbox` object. What changes is the Vue form:

| React                                                 | Vue                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `value` + `onValueChange`                             | `v-model` (`modelValue` + `update:modelValue(value, details)`)              |
| `defaultValue`                                        | `default-value`                                                             |
| `onValueChangeComplete`                               | `@value-change-complete`                                                    |
| `onZoomChange`                                        | `@zoom-change`                                                              |
| `Sheet onSnapChange`                                  | `<Fluidbox.Sheet @snap-change>`                                             |
| Slides props                                          | named slots on `<Fluidbox.Slides>`, by type; `#default` is the escape hatch |
| render-function children                              | scoped slots                                                                |
| `useFluidbox`, `useFluidboxSheet`, `useFluidboxSlide` | same names, returning reactive objects (as today)                           |
| `asChild`                                             | `as-child`                                                                  |

`update:modelValue` is emitted from the before-event, so `details.cancel()` works inside the
handler. `v-model` ignores the second argument; write `@update:model-value` when you need it.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { Model } from "@ogdakke/fluidbox/vue/model";
import { Embed } from "@ogdakke/fluidbox/vue/embed";
import { media, products } from "./data";

const photoId = ref<string | null>(null);
const loadModelViewer = () => import("@google/model-viewer");
</script>

<template>
  <Fluidbox.Root :items="media" v-model="photoId">
    <Fluidbox.Trigger v-for="p in products" :key="p.id" :value="p.mediaIds" v-slot="{ item }">
      <img :src="item.thumbnail.src" :alt="item.alt" />
    </Fluidbox.Trigger>
    <Fluidbox.Viewer>
      <Fluidbox.Slides>
        <template #model><Model :load="loadModelViewer" /></template>
        <template #embed><Embed /></template>
      </Fluidbox.Slides>
      <Fluidbox.Toolbar>
        <Fluidbox.Counter />
        <Fluidbox.ZoomOut /><Fluidbox.ZoomIn /><Fluidbox.ZoomReset />
        <Fluidbox.Close />
      </Fluidbox.Toolbar>
      <Fluidbox.Previous /><Fluidbox.Next />
      <Fluidbox.Caption />
      <Fluidbox.Thumbnails />
    </Fluidbox.Viewer>
  </Fluidbox.Root>
</template>
```

A slot's props are `{ item, index }`. Vue slots can't be typed per slot name from a merged
interface without a generic component; `Slides` is declared with `defineSlots` over
`FluidboxItemTypes`, so `#model="{ item }"` is a `FluidboxModelItem` (Vue 3.3+, which the peer
range already requires).

## 3.14 Solid

Same props as React. Solid's differences:

- Trigger children get an accessor: `{(preview) => <img src={preview().item?.src} />}`; `as` instead
  of `asChild`, as today.
- `useFluidboxSlide()` returns an object of getters (`slide.active` is reactive);
  `useFluidbox(select)` returns an `Accessor`; `useFluidboxSheet()` returns `{ snap: Accessor,
setSnap }`.
- Slides props are functions returning JSX, called once per slide under the Root's owner, so
  context reaches them (`solid/src/index.ts:233`).

```tsx
<Fluidbox.Root items={media} value={photoId()} onValueChange={setPhotoId}>
  <For each={products}>
    {(p) => (
      <Fluidbox.Trigger value={p.mediaIds}>
        {(preview) => <img src={preview().item?.thumbnail?.src} alt={preview().item?.alt} />}
      </Fluidbox.Trigger>
    )}
  </For>
  <Fluidbox.Viewer>
    <Fluidbox.Slides model={() => <Model load={loadModelViewer} />} embed={() => <Embed />} />
    <Fluidbox.Toolbar />
    <Fluidbox.Caption />
    <Fluidbox.Thumbnails />
  </Fluidbox.Viewer>
</Fluidbox.Root>
```

## 3.15 Angular

The Angular binding moves to signal APIs (`input()`, `model()`, `output()`), which needs Angular
17.3; the peer range today is `>=17`. Directives keep their attribute selectors on native elements,
as today.

| React                      | Angular                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Root`                     | `[fluidboxRoot]`, `exportAs: "fluidbox"`                                                                                         |
| `value` + `onValueChange`  | `[(value)]` (a `model()`)                                                                                                        |
| `details.cancel()`         | `(beforeValueChange)="$event.preventDefault()"`: the cancelable `FluidboxValueChangeEvent`                                       |
| `onValueChangeComplete`    | `(valueChangeComplete)`                                                                                                          |
| `Trigger`                  | `[fluidboxTrigger]="value"`, `exportAs: "fluidboxTrigger"`, signal `preview()`                                                   |
| `Overlay`                  | `[fluidboxOverlay] flight="live"`; live content in an `<ng-template>` child, as today                                            |
| `Viewer`                   | `<ng-template fluidboxViewer>`                                                                                                   |
| `Slides` prop `model`      | `<ng-template fluidboxSlide="model" let-item let-index="index">`                                                                 |
| `Slides` prop `default`    | `<ng-template fluidboxSlide>` (no value)                                                                                         |
| `Media`                    | `<ng-template fluidboxMedia [zoom]="true">` inside a slide template                                                              |
| `Image`, `Video`, `Iframe` | `<fluidbox-image />`, `<fluidbox-video />`, `<fluidbox-iframe />`                                                                |
| `Toolbar`                  | `<div fluidboxToolbar>` (empty: the defaults)                                                                                    |
| `ZoomControls`             | `<div fluidboxZoomControls>`                                                                                                     |
| controls                   | `button[fluidboxClose]`, `[fluidboxPrevious]`, `[fluidboxNext]`, `[fluidboxZoomIn]`, `[fluidboxZoomOut]`, `[fluidboxZoomReset]`  |
| `Counter`                  | `<span fluidboxCounter>`                                                                                                         |
| `Caption`                  | `<p fluidboxCaption>`; an `<ng-template>` child for custom content                                                               |
| `Thumbnails`               | `<ng-container fluidboxThumbnails />` or `<ng-template fluidboxThumbnails let-item let-active="active">`                         |
| `Sheet`                    | `<ng-template fluidboxSheet [snapPoints] (snapChange) let-item>`                                                                 |
| `SheetSnap`                | `button[fluidboxSheetSnap]="1"`                                                                                                  |
| `useFluidbox`              | `injectFluidbox()` → `Signal<FluidboxApi>`; `injectFluidbox(select)` → `Signal<T>`                                               |
| `useFluidboxSheet`         | `injectFluidboxSheet()` → `{ snap: Signal<number>, setSnap }`                                                                    |
| `useFluidboxSlide`         | `injectFluidboxSlide()` → `{ item: Signal, index: Signal, active: Signal<boolean>, opening, signal, onActiveChange, waitUntil }` |

Why `(beforeValueChange)` and not a `details` argument: a `model()`'s `valueChange` output carries
the value only, and Angular has no second output argument. The cancelable event is the Angular way
to veto, and it is the same event plain JS dispatches.

A slide template's context is `{ $implicit: item, item, index, active }`. A component inside it
calls `injectFluidboxSlide()`; the binding creates the template's view with an injector that
provides the slide, so components get `signal`, `onActiveChange` and `waitUntil` too. That closes the
gap the media example works around today (Angular slide components get only `item`, `index` and
`active`, `angular/src/mount.ts:97`).

```ts
import { Component, signal } from "@angular/core";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { FluidboxModel } from "@ogdakke/fluidbox/angular/model";
import { FluidboxEmbed } from "@ogdakke/fluidbox/angular/embed";
import { media, products } from "./data";

@Component({
  selector: "app-shop",
  standalone: true,
  imports: [FluidboxModule, FluidboxModel, FluidboxEmbed],
  template: `
    <div fluidboxRoot [items]="media" [(value)]="photoId">
      @for (p of products; track p.id) {
        <button [fluidboxTrigger]="p.mediaIds" #trigger="fluidboxTrigger">
          <img [src]="trigger.preview().item?.thumbnail?.src" [alt]="trigger.preview().item?.alt" />
        </button>
      }
      <ng-template fluidboxSlide="model"><fluidbox-model [load]="loadModelViewer" /></ng-template>
      <ng-template fluidboxSlide="embed"><fluidbox-embed /></ng-template>
      <ng-template fluidboxViewer>
        <div fluidboxToolbar>
          <span fluidboxCounter></span>
          <button fluidboxZoomOut></button><button fluidboxZoomIn></button
          ><button fluidboxZoomReset></button>
          <button fluidboxClose></button>
        </div>
        <button fluidboxPrevious></button><button fluidboxNext></button>
        <p fluidboxCaption></p>
        <ng-container fluidboxThumbnails />
      </ng-template>
    </div>
  `,
})
export class Shop {
  readonly media = media;
  readonly products = products;
  readonly photoId = signal<string | null>(null);
  readonly loadModelViewer = () => import("@google/model-viewer");
}
```

Typing: `let-item` is a `FluidboxItem`. Angular infers a directive's type parameter from a bound
expression, not from a static attribute, so `fluidboxSlide="model"` can't narrow `item` to a model
item. The add-on components read their own item through `injectFluidboxSlide()`, typed by the
component, so this only matters for templates that read item fields directly. Writing
`[fluidboxSlide]="'model'"` would narrow it; the docs show the static form and mention the bound one.

## 3.16 Custom elements

Markup reads as the same anatomy. Placeholders inside `<template slot="viewer">` are expanded by the
viewer's layer, as `<fluidbox-controls>` is today (`viewer-layer.ts:73`); they are not custom
elements, so they cost no registration.

| React                        | Custom elements                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`                       | `<fluidbox-gallery>`; attributes `value`, `loop`, `nozoom`, `zoom-step`, `zoom-max`, `preload`; properties `items`, `labels`, `zoom`, `slides`, `findTrigger`, `revealTrigger`, `viewer` |
| `onValueChange` + cancel     | `beforevaluechange` event, `preventDefault()`                                                                                                                                            |
| —                            | `valuechange`, `valuechangecomplete`, `zoomchange`, `sheetchange` events                                                                                                                 |
| `Trigger` (markup items)     | `<fluidbox-item value="a">` with a `slot="trigger"` child; `value="a b c"` for an album                                                                                                  |
| `Trigger` (with `items` set) | any element with `data-fluidbox-value="a"` (or `"a b c"`)                                                                                                                                |
| `Overlay`                    | `<span data-fluidbox-trigger-overlay="live">` inside a trigger                                                                                                                           |
| `Viewer`                     | `<template slot="viewer">`                                                                                                                                                               |
| `Toolbar`                    | `<fluidbox-toolbar>` (empty: the defaults)                                                                                                                                               |
| `ZoomControls`               | `<fluidbox-zoom-controls>`                                                                                                                                                               |
| controls                     | `<button data-fluidbox-close>` etc., as now                                                                                                                                              |
| `Counter`                    | `<fluidbox-counter>`                                                                                                                                                                     |
| `Caption`                    | `<fluidbox-caption>`                                                                                                                                                                     |
| `Thumbnails`                 | `<fluidbox-thumbnails>` (property `render`)                                                                                                                                              |
| `Sheet`                      | `<fluidbox-sheet snap-points dismiss>`                                                                                                                                                   |
| `SheetSnap`                  | `<button data-fluidbox-sheet-snap="1">`                                                                                                                                                  |
| `Slides` prop `product`      | `<template data-fluidbox-slide="product">`                                                                                                                                               |
| `Media`                      | `<fluidbox-media zoom>` inside a slide template                                                                                                                                          |
| `Image`                      | `<fluidbox-image>`; `field="image"` draws that field of the item                                                                                                                         |
| add-on parts                 | `import "@ogdakke/fluidbox/elements/model"` registers the `model` slide                                                                                                                  |
| zoom image                   | `<img data-zoom-src data-zoom-srcset>` in a `slot="content"` template                                                                                                                    |

### Slide templates

A `<template data-fluidbox-slide="type">` is cloned into each slide of that type. Inside it:

- `<fluidbox-media>`'s children go in the media box; everything else goes in the layer.
- `<fluidbox-image>` draws the built-in image (of the item, or of its `field`).
- `data-fluidbox-text="price"` sets an element's text to that item field.

That covers captions, badges and prices without a template language. Anything more is a
`gallery.slides = { product: renderer }` property with a plain-JS renderer.

Why `data-fluidbox-slide` and not `slot="type"`: the gallery already reads `slot="trigger"`,
`slot="content"`, `slot="sheet"` and `slot="viewer"` (`item.ts:107`, `gallery.ts:682`). An item type
called `content` or `viewer` would collide.

```html
<fluidbox-gallery>
  <fluidbox-item value="fjord">
    <button slot="trigger"><img src="/fjord-320.jpg" alt="A fjord at dusk" /></button>
    <template slot="content">
      <img
        src="/fjord-1280.jpg"
        alt="A fjord at dusk"
        width="1280"
        height="853"
        data-zoom-src="/fjord-4000.jpg"
      />
    </template>
  </fluidbox-item>
  <template slot="viewer">
    <fluidbox-toolbar></fluidbox-toolbar>
    <fluidbox-counter></fluidbox-counter>
    <fluidbox-caption></fluidbox-caption>
  </template>
  <fluidbox-thumbnails></fluidbox-thumbnails>
</fluidbox-gallery>
```

Markup items of an add-on type: with the add-on's elements entry imported, a content template whose
root is `<model-viewer>` reads as a model item, an `<iframe>` whose `src` parses as YouTube or
Vimeo reads as an embed item, and `<img data-spin-frames="/spin/{index}.webp" data-spin-count="36">`
reads as a spin item. Without the import they read as they do today.

## 3.17 Accessibility, by part

| Part                   | Role and name                                                                                                            | Keyboard                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Viewer root (runtime)  | `role="dialog"`, `aria-modal="true"`, named by the item's alt or title, else `labels.viewer`                             | Escape closes; arrows, Home, End, `+`, `-`, `0` when focus is on the dialog, a control or the slides |
| Slides strip (runtime) | `aria-roledescription={labels.carousel}`, `aria-label={labels.slides}`                                                   | native scroll                                                                                        |
| Slide (runtime)        | `role="group"`, `aria-roledescription={labels.slide}`, `aria-label={labels.position}`; `aria-hidden` off the current one |                                                                                                      |
| Media box, own content | `role="group"`, `aria-label={item.title}`                                                                                | content with `data-fluidbox-owns-input` keeps its keys                                               |
| Image                  | `<img alt>`                                                                                                              |                                                                                                      |
| Slide layer            | no role; content is in reading order after the box                                                                       |                                                                                                      |
| Trigger                | `<button>`, `aria-haspopup="dialog"`                                                                                     | Enter/Space                                                                                          |
| Controls               | `<button>`, `aria-label` from labels when empty                                                                          |                                                                                                      |
| Toolbar                | `role="group"`                                                                                                           | Tab                                                                                                  |
| ZoomControls           | `role="group"`, `aria-label={labels.zoomed}`                                                                             | Tab                                                                                                  |
| Counter                | `aria-hidden="true"`                                                                                                     |                                                                                                      |
| Caption                | the dialog's `aria-describedby`                                                                                          |                                                                                                      |
| Thumbnails             | `role="listbox"` with `role="option"` buttons, `aria-selected`                                                           | arrows within the list                                                                               |
| Sheet                  | `<section>` named `labels.sheet`                                                                                         |                                                                                                      |
| Announcer (runtime)    | live region                                                                                                              |                                                                                                      |

Unchanged from today apart from `Toolbar`, `ZoomControls`' new home, `Counter`, `Caption` and the
slide layer.
