# Framework bindings

The React, Vue, Solid and Angular bindings are private workspace packages (`packages/react`, `vue`, `solid`, `angular`). `scripts/build.ts` copies each one's `dist` into the core's `dist/<framework>/`, published as `@ogdakke/fluidbox/<framework>`, with `/embed`, `/model` and `/spin` beside it for the add-on parts. The user docs are the framework pages in `apps/docs/content` (`react.md`, `vue.md`, `solid.md`, `angular.md`, `nextjs.md`); this file is for people working on the bindings.

## What a binding is

A binding builds the anatomy of `docs/api-spec/03-anatomy.md` from the framework's own parts, over the plain JS API. It calls `createFluidbox()` once per Root, binds triggers with `createTrigger`, and hands the viewer renderers that mount framework content into the elements the runtime makes: the viewer's layer, each slide's layer and media box, the thumbnails and the sheet. It never renders the custom elements, and it keeps no gesture, zoom, transition, gallery or portal logic of its own (`AGENTS.md`).

| Part                                    | React, Vue, Solid        | Angular                                                                           | What the binding does                                                                                                                                    |
| --------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root                                    | `Fluidbox.Root`          | `[fluidboxRoot]`                                                                  | Makes the fluidbox; passes option changes through `update()` and items through `setItems`.                                                               |
| Trigger, Overlay                        | `Trigger`, `Overlay`     | `[fluidboxTrigger]`, `[fluidboxOverlay]`                                          | `createTrigger`; re-renders the preview synchronously before the closing flight measures.                                                                |
| Slides, Media, Image, Video, Iframe     | same names               | `ng-template[fluidboxSlide]`, `ng-template[fluidboxMedia]`, `<fluidbox-image>`…   | A `slides` renderer per type that mounts content into `slide.layer` and `slide.media`, and reports the commit with `holdSlideCommit`.                    |
| Hotspot                                 | `Hotspot`                | `button[fluidboxHotspot]`                                                         | `placeHotspot(slide, button, options)` from the kit.                                                                                                     |
| Viewer, Toolbar, ZoomControls, controls | same names               | `ng-template[fluidboxViewer]`, `[fluidboxToolbar]`, `button[fluidboxClose]`…      | A `viewer` renderer; each control reads its command, state and label from the kit's `fluidboxControls`, and sets `disabled`, `hidden` and `data-active`. |
| Counter, Caption, Loading, Error, Retry | same names               | `[fluidboxCounter]`, `[fluidboxCaption]`, `ng-template[fluidboxLoading]`…         | Read state; Retry is a control.                                                                                                                          |
| Thumbnails, Sheet, SheetSnap            | same names               | `[fluidboxThumbnails]`, `ng-template[fluidboxSheet]`, `button[fluidboxSheetSnap]` | Turn the add-on on through `update()`; render its content for each item.                                                                                 |
| Add-on parts                            | `Embed`, `Model`, `Spin` | `<fluidbox-embed>`, `<fluidbox-model>`, `<fluidbox-spin>`                         | A `Media` whose `render` is the add-on's plain-JS slide.                                                                                                 |

Hooks: `useFluidbox`, `useFluidboxSheet` and `useFluidboxSlide` in React, Vue and Solid; `injectFluidbox`, `injectFluidboxSheet` and `injectFluidboxSlide` in Angular. Events follow each framework's idiom: `onReachEnd` in React and Solid, `@reach-end` in Vue, `(reachEnd)` in Angular. The binding docs list them all.

## The kit

`@ogdakke/fluidbox/kit` (`packages/fluidbox/src/kit.ts`) is what the bindings share and what a binding for another framework would use. Its main pieces:

- `createSlots` keeps the per-item content of the thumbnails and the sheet (React and Vue use it).
- `holdSlideCommit` holds an open until a framework slide has committed.
- `placeHotspot` places a hotspot button on a slide.
- `createFluidboxSync`, `watchFluidbox` and `valueChangeDetails` connect a controlled `value`.
- `takeOverFluidbox` opens the live viewer over the server-rendered copy.
- `createTrigger` binds a trigger element and reports its preview.
- `resolveLabels`, `fluidboxControls`, `downloadLink` and `latestFindTrigger` cover labels, controls, downloads and trigger lookup.

The API reference lists every export.

## Server rendering

Every entry is safe to import on the server. A Root touches the DOM only after mount. When its controlled or default `value` names an image in an array, it renders the copy from `fluidboxStaticViewerNodes`, and the browser takes it over with `takeOverFluidbox`. `bun run test:ssr` (`scripts/check-ssr.ts`) renders each binding on the server, Angular through `@angular/platform-server` (JIT, zoneless).

## Where they are tested

- `apps/examples/src/patterns/<framework>/` holds the thirteen patterns against `CONTRACT.md`, checked by `tests/browser/patterns.spec.ts`. The docs show their `#region example` parts.
- `apps/examples/<framework>-slides.html` and `hotspots-<framework>.html` are fixtures for custom slides, the slide API, the slideshow, reach-end and hotspots, read by the browser specs.
- `bun run test:contract` type-checks the bindings and the examples, and `bun run test:bundle` checks each entry's size budget.
