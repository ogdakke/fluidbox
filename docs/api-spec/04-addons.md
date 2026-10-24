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

`Media render` calls the renderer with the slide (its `media` box, `signal`, `active`,
`onActiveChange`) when the part mounts, and calls its disposer on unmount. That is today's
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

YouTube and Vimeo facades: a poster and a Play button, then the player in a sandboxed iframe.

```ts
export interface FluidboxEmbedItem extends FluidboxCustomItemBase<"embed"> {
  readonly provider: "youtube" | "vimeo";
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

export function youtubeItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem;
export function vimeoItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem;
export function parseYouTube(
  source: string,
): { video: string; start?: number; short?: boolean } | null;
export function parseVimeo(source: string): { video: string; hash?: string; start?: number } | null;
export function embedUrl(item: FluidboxEmbedItem, options?: { autoplay?: boolean }): string;
export const EMBED_ALLOW: string;

export interface FluidboxEmbedSlideOptions {
  /** The Play button's name. @default (item) => `Play ${item.title}` */
  readonly label?: (item: FluidboxEmbedItem) => string;
}
export function createEmbedSlide(
  options?: FluidboxEmbedSlideOptions,
): FluidboxSlideRenderer<FluidboxEmbedItem>;
export const embedSlide: FluidboxSlideRenderer<FluidboxEmbedItem>;
```

`FluidboxEmbedItemOptions` loses `render`; the rest is unchanged (`title`, `id`, `width`,
`height`, `thumbnail`, `poster`, `start`). Behaviour, DOM and styles are unchanged
(`embeds.ts:292`): draw into `slide.media`, pause on deactivate, reset to the poster when the box
leaves the document.

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
   * Loads <model-viewer>. Called when a model first comes on show; the slide
   * then waits for customElements.whenDefined("model-viewer").
   * @default waits for the element without loading anything
   */
  readonly load?: () => Promise<unknown>;
}
export function createModelSlide(
  options?: FluidboxModelSlideOptions,
): FluidboxSlideRenderer<FluidboxModelItem>;
```

The `model: true` marker goes: `type: "model"` says the same thing. `load` becomes optional so the
custom elements entry can register a model slide for pages that load `<model-viewer>` with their own
`<script>`. Never bundles `@google/model-viewer`, as now.

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

| Entry                                               |   Today |                             Estimate | Why                                                  |
| --------------------------------------------------- | ------: | -----------------------------------: | ---------------------------------------------------- |
| `embed` (was `embeds`)                              | 2,711 B |                        2,650–2,700 B | Drops `isEmbedItem` and the `render` default.        |
| `spin`                                              | 2,426 B |                              2,400 B | Drops `isSpinItem`.                                  |
| `model`                                             | 1,300 B |                              1,280 B | Drops `isModelItem` and the marker.                  |
| `hover-zoom`                                        | 1,456 B |                              1,456 B | Field names only.                                    |
| `react/model`, `react/embed`, `react/spin`          |       — | 150–250 B each, on top of the add-on | A component calling `useMemo` and rendering `Media`. |
| Vue, Solid, Angular add-on parts                    |       — |                       150–300 B each | Angular's component metadata is the largest.         |
| `elements/model`, `elements/embed`, `elements/spin` |       — | 250–450 B each, on top of the add-on | The markup reader is the larger half.                |

These are estimates from the size of the code they replace (the `AddonSlide` adapters are about
40 lines each). The bundle check measures the real numbers once the entries exist (§9).
