# 4. Add-ons

Each media add-on ships three ways: a plain-JS slide (`@ogdakke/fluidbox/<addon>`), a part per
framework (`@ogdakke/fluidbox/<framework>/<addon>`), and a custom-elements registration
(`@ogdakke/fluidbox/elements/<addon>`). The parts are thin: each renders a `Media` whose `render`
is the plain-JS slide. The plain-JS slide is the only implementation.

## 4.1 How a part is built

```tsx
// @ogdakke/fluidbox/react/model (the whole entry, give or take types)
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { createModelSlide, type FluidboxModelSlideOptions } from "@ogdakke/fluidbox/model";

export function Model(props: FluidboxModelSlideOptions) {
  const render = useMemo(() => createModelSlide(props), [props.load]);
  return <Fluidbox.Media render={render} />;
}
```

`Media render` calls the renderer with the slide (its `media` box, `signal`, `active`, `opening`,
`onActiveChange`, `waitUntil`) when the part mounts, and calls its disposer on unmount. It calls
the renderer in its own layout effect (or `onMounted`, `onMount`, the Angular mount), which runs
before the slide host reports its commit. So the add-on's `waitUntil` calls always count (§5.3). That is today's
`AddonSlide` adapter (`apps/examples/src/patterns/react/media.tsx:18`), moved into the binding once
instead of being written in every app. In Angular it removes the abstract directive and the three
classes of `angular/media.ts:32-83`.

The same shape in each framework:

| Framework | Part                                                                                                                                            | Built on                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| React     | `<Model load />`, `<Embed label? />`, `<Spin label? keep? turns? />`                                                                            | `<Fluidbox.Media render>`              |
| Vue       | `<Model :load />`, `<Embed />`, `<Spin />`                                                                                                      | `<Fluidbox.Media :render>`             |
| Solid     | `<Model load />`, `<Embed />`, `<Spin />`                                                                                                       | `<Fluidbox.Media render>`              |
| Angular   | `<fluidbox-model [load] />`, `<fluidbox-embed />`, `<fluidbox-spin />` (standalone components `FluidboxModel`, `FluidboxEmbed`, `FluidboxSpin`) | `<ng-template fluidboxMedia [render]>` |
| Elements  | registered for the type on import                                                                                                               | `gallery.slides` default               |

The parts take the add-on's renderer options as props. They read the item from the slide.

## 4.2 Embed (`@ogdakke/fluidbox/embed`)

Video-site facades: a poster and a Play button, then the provider's player in a sandboxed iframe.
A provider is a public object, so an app can add any site. YouTube and Vimeo are two providers
built with the same function the app uses.

```ts
/** What a provider's parse finds in a URL or id. */
export interface FluidboxEmbedVideo {
  readonly video: string;
  readonly hash?: string;
  readonly start?: number;
  /** This video's width / height, when the URL says (a YouTube Short is 9 / 16). */
  readonly aspect?: number;
}

export interface FluidboxEmbedProviderOptions {
  /** Stored on items, so items stay serialisable. Lower case, digits and "-". */
  readonly name: string;
  /** The player's https origin: the postMessage target, checked against url(), preconnected. */
  readonly origin: string;
  /** A URL or id → the video, or null when it isn't this provider's. */
  readonly parse: (source: string) => FluidboxEmbedVideo | null;
  /** The player's URL. Must pass the media URL check and be on `origin`. */
  readonly url: (item: FluidboxEmbedItem, options: { readonly autoplay: boolean }) => string;
  /** A default poster when the item has none (YouTube: i.ytimg.com). */
  readonly poster?: (item: FluidboxEmbedItem) => string | undefined;
  /** Pause the player. Without it, leaving the slide unloads the player back to its poster. */
  readonly pause?: (frame: HTMLIFrameElement) => void;
  /** @default EMBED_ALLOW */
  readonly allow?: string;
  /** @default IFRAME_SANDBOX_DEFAULT */
  readonly sandbox?: string;
  /** @default "strict-origin-when-cross-origin" */
  readonly referrerPolicy?: ReferrerPolicy;
  /** Width / height when neither the item nor parse gives one. @default 16 / 9 */
  readonly aspect?: number;
}

export interface FluidboxEmbedProvider extends FluidboxEmbedProviderOptions {
  /** url() with its result checked. Throws a TypeError for a URL off `origin`. */
  readonly url: (item: FluidboxEmbedItem, options?: { readonly autoplay?: boolean }) => string;
}
export function createEmbedProvider(options: FluidboxEmbedProviderOptions): FluidboxEmbedProvider;
export const youtube: FluidboxEmbedProvider;
export const vimeo: FluidboxEmbedProvider;

export interface FluidboxEmbedItem extends FluidboxCustomItemBase<"embed"> {
  /** The provider's name. */
  readonly provider: string;
  readonly video: string;
  readonly hash?: string;
  readonly start?: number;
  readonly poster?: string;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    embed: FluidboxEmbedItem;
  }
}

/** An item from a provider and a URL or id. Throws a TypeError when parse finds nothing. */
export function embedItem(
  provider: FluidboxEmbedProvider,
  source: string,
  options: FluidboxEmbedItemOptions,
): FluidboxEmbedItem;
/** embedItem(youtube, …) and embedItem(vimeo, …). */
export function youtubeItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem;
export function vimeoItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem;
export const EMBED_ALLOW: string;

export interface FluidboxEmbedSlideOptions {
  /** The providers this slide plays. @default [youtube, vimeo] */
  readonly providers?: readonly FluidboxEmbedProvider[];
  /** The Play button's name. @default (item) => `Play ${item.title}` */
  readonly label?: (item: FluidboxEmbedItem) => string;
}
export function createEmbedSlide(
  options?: FluidboxEmbedSlideOptions,
): FluidboxSlideRenderer<FluidboxEmbedItem>;
export const embedSlide: FluidboxSlideRenderer<FluidboxEmbedItem>;
```

An app's own provider:

```ts
import { createEmbedProvider, embedItem, youtube, vimeo } from "@ogdakke/fluidbox/embed";

const wistia = createEmbedProvider({
  name: "wistia",
  origin: "https://fast.wistia.net",
  parse: (source) => {
    const video = /(?:medias|iframe)\/(\w+)/.exec(source)?.[1] ?? (/^\w{10}$/.test(source) ? source : null);
    return video ? { video } : null;
  },
  url: (item, { autoplay }) =>
    `https://fast.wistia.net/embed/iframe/${item.video}?autoPlay=${autoplay}`,
  pause: (frame) =>
    frame.contentWindow?.postMessage(JSON.stringify({ method: "pause" }), "https://fast.wistia.net"),
});

const demo = embedItem(wistia, "https://fast.wistia.net/medias/abc123defg", { title: "Demo" });
// { type: "embed", provider: "wistia", video: "abc123defg", id: "wistia:abc123defg", … }

createFluidbox({ items, slides: { embed: createEmbedSlide({ providers: [youtube, vimeo, wistia] }) } });
<Embed providers={[youtube, vimeo, wistia]} />; // in the bindings
```

Rules:

- **Items hold the provider's name, not the object**, so items can come from JSON or a server
  component. The slide looks the name up in its `providers`. An item whose provider isn't
  registered shows the error slide (`labels.error`), and development builds warn and name the
  missing provider. Two providers with the same name in one list throw.
- **`url()` is checked.** `createEmbedProvider` wraps it. The result must pass `isSafeMediaUrl`
  for iframes (http(s) or relative; the check in `media-url.ts:9` is http(s), not https only) and
  its origin must equal `origin`. Otherwise it throws, and the slide shows its error state rather
  than loading a page off the provider's origin. `origin` itself must be `https:`.
- **The iframe** gets the provider's `allow`, `sandbox` and `referrerPolicy`, set before `src`
  as now (`embeds.ts:334-339`).
- **Pausing.** With `pause`, a slide that leaves while playing is paused and keeps its place, as
  YouTube and Vimeo are today. Without it, leaving puts the slide back to its poster and unloads
  the player, which always stops it.
- **Preconnect.** When an embed slide mounts (the strip's neighbours, or `prepare` on pointerdown),
  it adds one `<link rel="preconnect">` per origin per document. The overseer's note asked for "on
  intent". The core has no add-on hook on hover, and the player only loads when Play is pressed,
  so a slide mount is early enough.
- **Size.** `width` and `height` from the options, else from `parse`'s `aspect`, else the
  provider's `aspect`, at 1280 wide. A YouTube Short is 720 × 1280, as today.
- **Today's per-provider code moves into the two providers:** `parseYouTube`/`parseVimeo` become
  `youtube.parse`/`vimeo.parse`, `embedUrl` becomes `youtube.url`/`vimeo.url`, the `origins` map
  becomes each `origin`, `pause()` becomes each `pause`, and the YouTube poster and its
  referrer rule become `youtube.poster` and `youtube.referrerPolicy`. Their behaviour and the
  tests in `embeds.spec.ts` carry over unchanged.

`FluidboxEmbedItemOptions` loses `render`; the rest is unchanged (`title`, `id`, `width`,
`height`, `thumbnail`, `poster`, `start`). The slide's DOM and styles are unchanged
(`createEmbedRenderer`, `embeds.ts:292`), except that `data-fluidbox-embed` holds any provider's name.

Elements: `@ogdakke/fluidbox/elements/embed` registers `createEmbedSlide()` with the two built-in
providers. A page with its own calls
`defineSlide("embed", createEmbedSlide({ providers: [youtube, vimeo, wistia] }))`.

Opening waits for the poster: the slide calls `slide.waitUntil(poster.decode())` while it mounts
(§5.3). The thumbnail layer is the trigger's own decoded picture, so this only waits when a
sharper `poster` is given, and only up to the cap. The player iframe is never waited on.

The `label` option stays an option rather than a key in `FluidboxLabels`. It's the add-on's only
string, and putting it in the core labels would add bytes to every page that never shows a video.
Pass it per Root through the part: `<Embed label={(item) => t("play", { title: item.title })} />`.

## 4.3 Spin (`@ogdakke/fluidbox/spin`)

```ts
export interface FluidboxSpinItem extends FluidboxCustomItemBase<"spin"> {
  readonly frames: readonly string[];
  readonly autoplay?: boolean | number;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    spin: FluidboxSpinItem;
  }
}

export function spinItem(options: FluidboxSpinItemOptions): FluidboxSpinItem;
export function spinFrames(frames: FluidboxSpinFrameTemplate): string[];

export interface FluidboxSpinSlideOptions {
  /** @default (frame, count) => `Frame ${frame} of ${count}` */
  readonly label?: (frame: number, count: number) => string;
  /** Frames held decoded. @default 48, at least 2 */
  readonly keep?: number;
  /** Turns per full-width drag. @default 1 */
  readonly turns?: number;
}
export function createSpinSlide(
  options?: FluidboxSpinSlideOptions,
): FluidboxSlideRenderer<FluidboxSpinItem>;
```

Unchanged behaviour (`spin.ts:129`): a `role="slider"` with `data-fluidbox-owns-input`, drag with
inertia, arrow keys, Home, End, `data-frame`, `data-grabbing`, `data-fluidbox-spin-loaded`. The
media box is not zoomable (the spin owns its pointer input).

Opening waits for the first frame: the slide calls `slide.waitUntil(first.decode())` while it
mounts, so the flight lands on a frame, not an empty slider (§5.3). The other frames keep
loading after the flight, as now.

## 4.4 Model (`@ogdakke/fluidbox/model`)

```ts
export interface FluidboxModelItem extends FluidboxCustomItemBase<"model"> {
  readonly src: string;
  readonly poster?: string;
  readonly ar?: boolean;
  readonly arModes?: string;
  readonly iosSrc?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    model: FluidboxModelItem;
  }
}

export function modelItem(options: FluidboxModelItemOptions): FluidboxModelItem;

export interface FluidboxModelSlideOptions {
  /**
   * Loads <model-viewer>. Called when a model is first opened or comes on
   * show; the slide then waits for customElements.whenDefined("model-viewer").
   * @default waits for the element without loading anything
   */
  readonly load?: () => Promise<unknown>;
}
export function createModelSlide(
  options?: FluidboxModelSlideOptions,
): FluidboxSlideRenderer<FluidboxModelItem>;
```

`modelItem()` sets `fit: "fill"` unless its options say otherwise, so a model fills the stage
instead of an 800 × 800 box (§5.4). Its `width` and `height` become optional and only shape the
poster. The core doesn't know the model type, and the flight is planned before the slide renders,
so the default lives in `modelItem()`. A hand-written `{ type: "model" }` item without `fit`
gets `"contain"`, and the docs show `modelItem()` or an explicit `fit: "fill"`.

The `model: true` marker goes: `type: "model"` says the same thing. `load` becomes optional so the
custom elements entry can register a model slide for pages that load `<model-viewer>` with their own
`<script>`. Never bundles `@google/model-viewer`, as now.

Opening waits for the model's first rendered frame (§5.3). When the slide mounts with
`slide.opening` true, it starts `load()` and the model at once, instead of when the slide first
becomes active as today (`model.ts:162`). It calls `slide.waitUntil()` with a promise for
`<model-viewer>`'s `load` event followed by one animation frame. If the trigger itself holds a
live `<model-viewer>` (a 3D thumbnail), the slide first copies the thumbnail's camera orbit,
target and field of view to its own, so the flight lands on the view the card showed. Neighbouring
model slides still wait until they become active, so a gallery of models doesn't load every
model at once.

A cold open needs the `<model-viewer>` script, the model file and a frame. On a slow connection
that reaches the 3 s cap, and the open then flies on the poster, as it does today. The pointerdown
preparation starts the load before the click (§5.3, Cost).

### Live 3D thumbnail

Built by session L and merged (`feat/api-redesign`, 7991561). A card can show a live `<model-viewer>` that the user orbits, and the
viewer continues from that view and hands it back.

- **`slide.origin.model?: HTMLElement`** (§2.22) is the card's model element itself, set only on
  the opened slide. It isn't a reading, as `origin.video` is: the camera is live WebGL state, so a
  copy would go stale. The slide reads the camera from it and must never move or reattach it.
- **`slide.onClose(listener: (landing: FluidboxSlideOrigin | null) => void)`** (§2.8) returns an
  unsubscribe function.
  - It runs once as a close starts, before the closing flight measures. `landing` is the origin
    of the trigger the close will land on, worked out from the item on show, so the slide can set
    `landing.model`'s camera to its own.
  - It runs on every close path: Escape, the backdrop, the close button, a drag or wheel dismiss,
    `close()`, `value` set to null, and a close interrupted by a reopen (still once). It runs
    whether or not the close flies. `returnPlayback` (§2.22) is its video counterpart. The
    runtime reads it just after the `onClose` listeners, and only on a close that flies.
  - Errors thrown by a listener go to `reportError` and don't stop the close.
- **Cold open.** If the slide's model isn't ready, the card's canvas (`toDataURL()`) is painted
  under it as a poster. The open waits on `slide.waitUntil`, within the 3 s cap (§5.3), so it
  flies on the card's view, not the item's poster.
- **The trigger treats a model like an image or video.** Inside a trigger, a drag past a 6 px
  slop on `model-viewer, [data-fluidbox-owns-input]` orbits and doesn't open: the click is
  swallowed and the open's preload discarded. A keydown resets the slop state.
  `data-fluidbox-owns-input` lets any element claim its own drags the same way.
- **The add-on quiets a live model in a trigger,** through an internal hook, not public API:
  - It sets `aria-hidden` on the host if the app hasn't.
  - It sets the shadow root's `tabindex` to -1 and makes its buttons and links inert, so the card
    is one tab stop.
  - If the element lacks `.userInput` (an older model-viewer), it removes the `aria-hidden` it
    added and logs a development warning naming model-viewer 4.0.0.
- **Field of view.** After a close, an unzoomed card view goes back to `"auto"`, or to the
  field of view the page set.
- **The origin is read when the viewer asks,** not fixed when the trigger binds. That covers the
  visual, the thumbnail and the model. So a card whose model is replaced or remounted gives the
  connected one, and a disconnected model is ignored.
- **The quieting is undone** when the trigger unbinds, the Root is destroyed, or the model leaves
  the trigger.
- **The close snapshot.** A model slide's snapshot is a synchronous canvas copy of the canvas
  model-viewer shows (`canvas.show` in its shadow root), cropped to the content box at the
  renderer's scale. It keeps the model's transparent background. Without a shown canvas it falls
  back to a PNG from `toDataURL()`. A shadow root with no canvas at all warns once in
  development, naming model-viewer 4.0.0. While the snapshot is in the box, the posters under it
  are hidden. With the canvas copy, a close starts in 8–14 ms, down from 30–187 ms.

Docs (step 6):

- Pin model-viewer 4.0.0.
- Give the card's anatomy as a `<button aria-label>` around `<model-viewer camera-controls
touch-action="pan-y" interaction-prompt="none">`.
- Advise against `auto-rotate` on cards.

Name: the part is `Model`, not `ModelViewer` (§8.4). In Angular it is `<fluidbox-model>`, because
`<model-viewer>` is Google's element and `fluidbox-model-viewer` would read as a wrapper of it.

## 4.5 Hover zoom (`@ogdakke/fluidbox/hover-zoom`)

Not a slide: it magnifies a photo on the page.

```ts
export function hoverZoom(
  element: HTMLElement,
  item: FluidboxImageItem,
  options?: { scale?: number; image?: HTMLElement; signal?: AbortSignal },
): () => void;
```

Only the item fields it reads change: `zoom.srcset` and `zoom.src` instead of `zoomSrcset` and
`zoomSrc`. No framework part. The examples call it in an effect (React, Solid), `onMounted`
(Vue) or a small directive (Angular), which is one line in each and needs nothing from the Root.
A `<Fluidbox.HoverZoom>` part would have to sit inside a `Trigger` and would couple a page-level
effect to the viewer; it isn't worth an entry. If wanted later, it fits as
`@ogdakke/fluidbox/react/hover-zoom` without touching anything else.

## 4.6 Elements registration

```ts
// @ogdakke/fluidbox/elements/model
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { defineSlide, defineMarkup } from "../elements";

defineSlide("model", createModelSlide());
defineMarkup("model-viewer", readModelItem); // a content template rooted at <model-viewer>
```

`defineSlide` puts the renderer in a page-wide registry (the `Symbol.for` registry the sheet and
thumbnails use) that every gallery reads as its default `slides`. `gallery.slides` overrides it per
gallery, as a framework's `Slides` does. `defineSlide` and `defineMarkup` are exported from
`@ogdakke/fluidbox/elements` so apps can register their own types the same way.

## 4.7 How the bundle split is kept

The rules today (`scripts/check-bundles.ts:152`): no core entry may carry add-on code. The new
entries keep that:

1. **Built-in media stays in the lazy viewer chunk.** `Image`, `Video` and `Iframe` call
   `slide.drawImage()` etc. on the slide object the runtime passes in. They don't import the image
   code; the viewer chunk that already holds it (`viewer-strip.ts`) does the drawing. The parts
   themselves are a few lines each in the binding's initial chunk.
2. **Add-on parts import only their add-on and the binding.** `react/model` imports
   `@ogdakke/fluidbox/model` and `@ogdakke/fluidbox/react`. The binding is external to the add-on
   part's build, as the core is external to the bindings today, so a page that uses both gets one
   copy.
3. **A Slides prop costs nothing until a slide mounts.** The binding keeps the renderers in a map
   it hands to the core; the add-on's code runs only when a slide of that type mounts. The add-on
   is still in the initial chunk of a page that imports it. Apps that want it lazy wrap the part in
   `React.lazy`, `defineAsyncComponent` or Angular `@defer`; the `Slides` prop is a function, so
   that works without changes to the library.
4. **The check gets new consumers.** One per new entry: `react-model`, `react-embed`,
   `react-spin`, and the same for Vue, Solid and Angular, plus `elements-model`, `elements-embed`
   and `elements-spin`. Each asserts it carries no other add-on and no other framework.

Estimated sizes, gzip, against `baseline/bundle-budget.md`:

| Entry                                               |   Today |                             Estimate | Why                                                                                                                                                                                                        |
| --------------------------------------------------- | ------: | -----------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `embed` (was `embeds`)                              | 2,711 B |                        2,800–2,950 B | `createEmbedProvider` with its URL and origin checks, the provider lookup and preconnect; drops `isEmbedItem` and the `render` default. YouTube and Vimeo stay in the default list, so neither shakes out. |
| `spin`                                              | 2,426 B |                              2,400 B | Drops `isSpinItem`.                                                                                                                                                                                        |
| `model`                                             | 1,300 B |                              1,280 B | Drops `isModelItem` and the marker.                                                                                                                                                                        |
| `hover-zoom`                                        | 1,456 B |                              1,456 B | Field names only.                                                                                                                                                                                          |
| `react/model`, `react/embed`, `react/spin`          |       — | 150–250 B each, on top of the add-on | A component calling `useMemo` and rendering `Media`.                                                                                                                                                       |
| Vue, Solid, Angular add-on parts                    |       — |                       150–300 B each | Angular's component metadata is the largest.                                                                                                                                                               |
| `elements/model`, `elements/embed`, `elements/spin` |       — | 250–450 B each, on top of the add-on | The markup reader is the larger half.                                                                                                                                                                      |

These are estimates from the size of the code they replace (the `AddonSlide` adapters are about
40 lines each). The bundle check measures the real numbers once the entries exist (§9).

## 4.8 HLS (`@ogdakke/fluidbox/hls`), later and low priority

A small `attach` for the built-in video (§2.8), so streaming needs no app code:

```ts
export interface FluidboxHlsOptions {
  /** Loads hls.js where the browser can't play HLS itself. */
  readonly load: () => Promise<{ default: typeof import("hls.js").default }>;
  /** Passed to `new Hls()`. */
  readonly config?: Partial<import("hls.js").HlsConfig>;
}
export function hlsAttach(options: FluidboxHlsOptions): FluidboxVideoOptions["attach"];
```

```tsx
const attachHls = hlsAttach({ load: () => import("hls.js") });
<Fluidbox.Slides video={() => <Fluidbox.Video attach={attachHls} />} />;
```

- Native HLS first: if `video.canPlayType("application/vnd.apple.mpegurl")` says `"maybe"` or
  `"probably"` (Safari, iOS), it sets `video.src` and loads nothing.
- Otherwise it loads hls.js once per page, and if `Hls.isSupported()`, attaches with
  `autoStartLoad: false` and calls `startLoad()` once the slide is active or opening, from the
  `slide` argument of §2.8 (`slide.active || slide.opening` at attach, otherwise on
  `onActiveChange`). A mounted neighbour then fetches only the manifest, not segments, until it is
  shown. If hls.js
  isn't supported, it sets `video.src` so the slide shows its error state.
- On `signal` abort it calls `hls.destroy()`.
- Never bundles hls.js: `load` is the app's dynamic import, as the model add-on's `load` is.

Size estimate: 350–500 B gzip. Bundle-check consumer `hls`, which must not contain hls.js. Plan
step 3 or later (§9.2). It is optional, because the `attach` option already covers streaming.

## 4.9 No glyphs in the add-ons

The fourth amendment removes every icon from the package's JavaScript (§2.21). Among the
add-ons, only the embed has one: the Play triangle (`embeds.ts:309-315`), sized in `embedStyles`
(`:269-273`). Spin, model and hover zoom draw no glyphs. Their posters are images, and their
cursors and the model's transparent background move to `baseline.css` (§10.3).

**Embed Play button.** It follows the control rule. With no content it shows its label as text:
the `label` option, `"Play <title>"` by default. That is visible, and also the accessible name.
Content can come three ways:

```ts
createEmbedSlide({ play: () => playIcon.content.cloneNode(true) }); // plain JS: a Node factory, as `icons`
```

```tsx
<Embed play={<PlayIcon />} /> // the bindings: a node; the label becomes aria-label
```

In markup, a `<template data-fluidbox-icon="embed-play">` inside the gallery works, as for the
controls (§2.21). The button keeps `data-fluidbox-embed-play`, and gets `data-fluidbox-default`
when it shows its text. The baseline draws today's triangle from `--fluidbox-icon-embed-play`
over the hidden text. The functional `position: absolute; inset: 0; margin: auto` (§10.3, R8)
keeps it above the poster in every case.

**Injected styles.** The add-ons keep injecting their functional rules through `addStyles`, now
unlayered with today's specificity, like the stylesheets (§10.1). Their look rules move to `baseline.css`: the Play
button's size, shape, colours and hover; spin's `grab` cursors; the model's transparent backdrop
and `--poster-color`. `posterStyles` and hover zoom's inline styles are all functional and
unchanged.
