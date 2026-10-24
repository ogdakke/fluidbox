# 1. Inventory and mapping

Every current public name and what it becomes. A row says either the new name, or "removed"
with the reason and what covers the capability. Nothing may disappear silently.

Sources: `packages/fluidbox/src/{public-api,index,kit,labels,css-api,items,image-item,trigger,controlled,controls,origins,static-viewer,gallery,item,filmstrip,elements,embeds,spin,model,hover-zoom,addons}.ts`,
the binding sources in `packages/{react,vue,solid,angular}/src`, `packages/fluidbox/package.json`
`exports`, `docs/PUBLIC_API.md` and `apps/docs/content`.

Conventions in this part:

- "→ same" means the name is kept as it is.
- A new name in `code` with no explanation is a plain rename.
- `B` means "every binding" (React, Vue, Solid, Angular) and the custom elements.

## 1.1 Entry points

| Current entry                     | New entry                                                        | Notes                                                  |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| `@ogdakke/fluidbox`               | → same                                                           | No side effects, no browser globals.                   |
| `@ogdakke/fluidbox/elements`      | → same                                                           | Defines the elements. Browser only.                    |
| `@ogdakke/fluidbox/react`         | → same                                                           |                                                        |
| `@ogdakke/fluidbox/vue`           | → same                                                           |                                                        |
| `@ogdakke/fluidbox/solid`         | → same                                                           |                                                        |
| `@ogdakke/fluidbox/angular`       | → same                                                           |                                                        |
| `@ogdakke/fluidbox/filmstrip`     | `@ogdakke/fluidbox/thumbnails`                                   | Registers the thumbnails add-on.                       |
| `@ogdakke/fluidbox/filmstrip.css` | `@ogdakke/fluidbox/thumbnails.css`                               |                                                        |
| `@ogdakke/fluidbox/sheet`         | → same                                                           |                                                        |
| `@ogdakke/fluidbox/sheet.css`     | → same                                                           |                                                        |
| `@ogdakke/fluidbox/styles.css`    | → same                                                           |                                                        |
| `@ogdakke/fluidbox/kit`           | → same                                                           | Contents change (§1.8).                                |
| `@ogdakke/fluidbox/hover-zoom`    | → same                                                           |                                                        |
| `@ogdakke/fluidbox/embeds`        | `@ogdakke/fluidbox/embed`                                        | One name: the item type is `"embed"`.                  |
| `@ogdakke/fluidbox/model`         | → same                                                           | Now exports `createModelSlide`.                        |
| `@ogdakke/fluidbox/spin`          | → same                                                           | Now exports `createSpinSlide`.                         |
| —                                 | `@ogdakke/fluidbox/{react,vue,solid,angular}/{embed,model,spin}` | New. The add-on parts, twelve entries.                 |
| —                                 | `@ogdakke/fluidbox/elements/{embed,model,spin}`                  | New. Registers the add-on for the custom elements.     |
| —                                 | `@ogdakke/fluidbox/hls`                                          | New, later (§4.8). `hlsAttach` for the built-in video. |

## 1.2 Root exports (`@ogdakke/fluidbox`)

### Values

| Current                   | New     | Notes                                                                                               |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `createFluidbox`          | → same  |                                                                                                     |
| `createItemList`          | → same  |                                                                                                     |
| `idOf`                    | → same  |                                                                                                     |
| `itemLabel`               | → same  | Reads `alt` for `"image"`, else `title`.                                                            |
| `imageItem`               | → same  | Produces `type: "image"` and, given a third argument, `zoom`.                                       |
| `FluidboxToggleEvent`     | removed | Replaced by `FluidboxValueChangeEvent` (§2.6). Open and close are value changes from and to `null`. |
| `FluidboxItemChangeEvent` | removed | Replaced by `FluidboxValueChangeEvent`.                                                             |
| `FluidboxSheetEvent`      | → same  | Field `stop` → `snap`.                                                                              |
| `FluidboxZoomEvent`       | → same  |                                                                                                     |

### Types

| Current                      | New                                                                                     | Notes                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fluidbox`                   | → same                                                                                  | Members change (§1.5).                                                                                                                         |
| `FluidboxBindOptions`        | → same                                                                                  | `returns` removed: the bound value can be a list.                                                                                              |
| `FluidboxCommandOptions`     | → same                                                                                  |                                                                                                                                                |
| `FluidboxControlName`        | → same                                                                                  | `zoomReset` stays; `"counter"` added.                                                                                                          |
| `FluidboxCustomItem`         | removed                                                                                 | `type: "custom"` goes away. Your own types extend `FluidboxCustomItemBase` and join the union through `FluidboxItemTypes` (§2.3).              |
| `FluidboxEventMap`           | → same                                                                                  | Entries change (§1.6).                                                                                                                         |
| `FluidboxFilmstripOptions`   | `FluidboxThumbnailsOptions`                                                             |                                                                                                                                                |
| `FluidboxIframeItem`         | → same                                                                                  |                                                                                                                                                |
| `FluidboxImageItem`          | → same                                                                                  | `type: "img"` → `"image"`; `zoomSrc`/`zoomSrcset` → `zoom`.                                                                                    |
| `FluidboxItem`               | → same                                                                                  | Now `FluidboxItemTypes[keyof FluidboxItemTypes]`.                                                                                              |
| `FluidboxItemBase`           | → same                                                                                  | Gains `caption`.                                                                                                                               |
| `FluidboxItemList`           | → same                                                                                  |                                                                                                                                                |
| `FluidboxItemListOptions`    | → same                                                                                  |                                                                                                                                                |
| `FluidboxItems`              | → same                                                                                  |                                                                                                                                                |
| `FluidboxLabels`             | → same                                                                                  | Keys change (§1.9).                                                                                                                            |
| `FluidboxLoading`            | `FluidboxPreload`                                                                       | Values `"hover"` → `"intent"`, `"press"`, `"eager"`.                                                                                           |
| `FluidboxOptions`            | → same                                                                                  | Fields change (§1.3).                                                                                                                          |
| `FluidboxOrigin`             | removed from the public API                                                             | `findTrigger` returns an element; the runtime resolves the visual from `data-fluidbox-origin`, as `bind` does today. Stays internal.           |
| `FluidboxOriginAdapter`      | removed                                                                                 | Replaced by the `findTrigger` and `revealTrigger` options.                                                                                     |
| `FluidboxOverlayOptions`     | → same                                                                                  | `travel` + `frameLayer` → `flight`; `returns` removed.                                                                                         |
| `FluidboxPictureSource`      | → same                                                                                  |                                                                                                                                                |
| `FluidboxReason`             | → same                                                                                  | Same values.                                                                                                                                   |
| `FluidboxRenderContext`      | → same                                                                                  |                                                                                                                                                |
| `FluidboxRenderer`           | → same                                                                                  | Still draws thumbnails, the sheet and live overlays.                                                                                           |
| `FluidboxRevealContext`      | → same                                                                                  | Passed to `revealTrigger`.                                                                                                                     |
| `FluidboxSheet`              | → same                                                                                  | `stop` → `snap`, `set` → `setSnap`.                                                                                                            |
| `FluidboxSheetOptions`       | → same                                                                                  | `render` stays.                                                                                                                                |
| `FluidboxSheetSnapPoint`     | → same                                                                                  |                                                                                                                                                |
| `FluidboxSlideRenderContext` | `FluidboxSlide`                                                                         | The object a slide renderer gets (§2.8). `target` → `media` and `layer`; adds `waitUntil`, `drawImage`, `drawVideo`, `drawIframe`, `zoomable`. |
| `FluidboxSlideRenderer`      | → same                                                                                  | Keyed by item type in `slides`.                                                                                                                |
| `FluidboxState`              | → same                                                                                  | `id` → `value`.                                                                                                                                |
| `FluidboxStatus`             | → same                                                                                  |                                                                                                                                                |
| `FluidboxTarget`             | → same                                                                                  | An index, an id or an item.                                                                                                                    |
| `FluidboxThumbnail`          | → same                                                                                  |                                                                                                                                                |
| `FluidboxToggleState`        | removed                                                                                 | No toggle events. `FluidboxValueChangeEvent.action` says `"open"`, `"move"` or `"close"`.                                                      |
| `FluidboxUpdateOptions`      | → same                                                                                  | Keys follow the options.                                                                                                                       |
| `FluidboxVideoItem`          | → same                                                                                  | Adds `sources` (§2.8).                                                                                                                         |
| —                            | `FluidboxVideoSource`, `FluidboxVideoOptions`, `FluidboxVideoAttachSlide`, `videoSlide` | New: video `sources`, and `attach` for a streaming engine, with a `slide` argument (§2.8).                                                     |
| `FluidboxVideoTrack`         | → same                                                                                  |                                                                                                                                                |
| `FluidboxViewerContext`      | → same                                                                                  |                                                                                                                                                |
| `FluidboxViewerRenderer`     | → same                                                                                  |                                                                                                                                                |
| `FluidboxZoomCommandOptions` | → same                                                                                  |                                                                                                                                                |
| `FluidboxZoomState`          | → same                                                                                  |                                                                                                                                                |
| `FluidboxImageProps`         | → same                                                                                  |                                                                                                                                                |
| —                            | `FluidboxItemTypes`                                                                     | New. The interface you merge your item types into.                                                                                             |
| —                            | `FluidboxCustomItemBase<TType>`                                                         | New. `{ type, title, width, height }` plus the base fields.                                                                                    |
| —                            | `FluidboxValue`                                                                         | New. `string \| null`.                                                                                                                         |
| —                            | `FluidboxValueChangeEvent`, `FluidboxValueChangeDetails`                                | New (§2.6).                                                                                                                                    |
| —                            | `FluidboxSlides`                                                                        | New. The `slides` option's type.                                                                                                               |

## 1.3 Options (`createFluidbox(options)`)

| Current     | New                            | Notes                                                                                                                      |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `items`     | → same                         |                                                                                                                            |
| `labels`    | → same                         |                                                                                                                            |
| `zoom`      | → same                         | `false \| { step?, max? }`.                                                                                                |
| `renderers` | `slides`                       | Keyed by item type, not by a `render` name. Built-in types fall back to the built-in slide.                                |
| `loop`      | → same                         |                                                                                                                            |
| `viewer`    | → same                         | Draws the viewer's layer.                                                                                                  |
| `controls`  | → same                         | `true`, `false`, or a list of `FluidboxControlName`.                                                                       |
| `filmstrip` | `thumbnails`                   |                                                                                                                            |
| `sheet`     | → same                         |                                                                                                                            |
| `origins`   | `findTrigger`, `revealTrigger` | `getOrigin(id)` → `findTrigger(item, index)`; `revealOrigin(id, index, ctx)` → `revealTrigger(item, index, ctx)`.          |
| `loading`   | `preload`                      | `"hover"` → `"intent"`.                                                                                                    |
| —           | `value`                        | New. The item to open on creation, as the server-rendered viewer needs. Replaces passing an `index` to `takeOverFluidbox`. |

## 1.4 Item fields

| Current                                                                                                | New                                               | Notes                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `type: "img"`                                                                                          | `type: "image"`                                   |                                                                                                |
| `type: "video"`                                                                                        | → same                                            |                                                                                                |
| `type: "iframe"`                                                                                       | → same                                            |                                                                                                |
| `type: "custom"`                                                                                       | removed                                           | The item's `type` names its slide directly.                                                    |
| `render` (custom)                                                                                      | removed                                           | The `type` is the key into `slides`.                                                           |
| `id`                                                                                                   | → same                                            | Required on items without `src`.                                                               |
| `thumbnail`                                                                                            | → same                                            |                                                                                                |
| `placeholder`                                                                                          | → same                                            |                                                                                                |
| `src`, `srcset`, `sizes`, `alt`, `width`, `height`, `sources` (image)                                  | → same                                            |                                                                                                |
| `zoomSrc`                                                                                              | `zoom.src`                                        |                                                                                                |
| `zoomSrcset`                                                                                           | `zoom.srcset`                                     |                                                                                                |
| `title`, `poster`, `autoplay`, `loop`, `muted`, `playsInline`, `controls`, `preload`, `tracks` (video) | → same                                            |                                                                                                |
| —                                                                                                      | `sources` (video)                                 | New. `<source>` children before `src`.                                                         |
| —                                                                                                      | `fit: "contain" \| "fill"` (every type but image) | New (§5.4). `width` and `height` become optional when `"fill"`.                                |
| `title`, `allow`, `referrerPolicy`, `sandbox` (iframe)                                                 | → same                                            |                                                                                                |
| `title`, `width`, `height` (custom)                                                                    | → same on `FluidboxCustomItemBase`                |                                                                                                |
| `FluidboxVideoTrack.{src,kind,srclang,label,default}`                                                  | → same                                            |                                                                                                |
| —                                                                                                      | `caption`                                         | New, optional, on every type. Read by `<Fluidbox.Caption>` and the default `aria-describedby`. |

## 1.5 The instance (`Fluidbox`)

### State (`fluidbox.state`)

| Current       | New     | Notes                                                                             |
| ------------- | ------- | --------------------------------------------------------------------------------- |
| `status`      | → same  |                                                                                   |
| `id`          | `value` | One name for the open item's id everywhere.                                       |
| `index`       | → same  |                                                                                   |
| `item`        | → same  |                                                                                   |
| `count`       | → same  |                                                                                   |
| `hasPrevious` | → same  |                                                                                   |
| `hasNext`     | → same  |                                                                                   |
| `zoom`        | → same  | Now non-null on any slide whose media box is zoomable, not only on images (§5.2). |

### Members

| Current                                     | New                                     | Notes                                                                                       |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `state`                                     | → same                                  |                                                                                             |
| `items`                                     | → same                                  |                                                                                             |
| `sheet`                                     | → same                                  |                                                                                             |
| `open(target?, options?)`                   | → same                                  |                                                                                             |
| `close(options?)`                           | → same                                  |                                                                                             |
| `next(options?)`                            | → same                                  |                                                                                             |
| `previous(options?)`                        | → same                                  |                                                                                             |
| `zoomTo(scale, options?)`                   | → same                                  |                                                                                             |
| `zoomIn(options?)`                          | → same                                  |                                                                                             |
| `zoomOut(options?)`                         | → same                                  |                                                                                             |
| `resetZoom(options?)`                       | `zoomReset(options?)`                   | Same word as the `ZoomReset` part and the `zoomReset` label.                                |
| `update(options)`                           | → same                                  |                                                                                             |
| `setItems(items)`                           | → same                                  |                                                                                             |
| `preload(target)`                           | → same                                  |                                                                                             |
| `load()`                                    | → same                                  |                                                                                             |
| `bind(element, target, options?)`           | `bind(element, value, options?)`        | `value` is a target or a list of targets: the first opens, all close back onto the element. |
| `bindOverlay(element, target, options?)`    | `bindOverlay(element, value, options?)` | Same `value`.                                                                               |
| `subscribe(listener)`                       | → same                                  |                                                                                             |
| `destroy()`                                 | → same                                  |                                                                                             |
| `filmstrip` (named in `docs/PUBLIC_API.md`) | —                                       | Not in the `Fluidbox` interface today; the doc is stale. Nothing to map.                    |

### Command and bind options

| Current                                        | New                                   | Notes                                                                     |
| ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `FluidboxCommandOptions.signal`                | → same                                |                                                                           |
| `FluidboxCommandOptions.scrub`                 | → same                                |                                                                           |
| `FluidboxZoomCommandOptions.signal`, `.origin` | → same                                |                                                                           |
| `FluidboxBindOptions.signal`                   | → same                                |                                                                           |
| `FluidboxBindOptions.returns`                  | removed                               | Pass a list as `value`.                                                   |
| `FluidboxBindOptions.onPreviewChange`          | → same                                | Plain JS only. The bindings use the trigger's children function.          |
| `FluidboxOverlayOptions.signal`                | → same                                |                                                                           |
| `FluidboxOverlayOptions.returns`               | removed                               | Pass a list as `value`.                                                   |
| `FluidboxOverlayOptions.travel`                | `flight`                              | `false` → `"none"`, `true` → `"copy"`, a renderer → `{ live: renderer }`. |
| `FluidboxOverlayOptions.frameLayer`            | `flight: "frame"` on a second overlay | The frame layer is its own overlay (§3.9).                                |

## 1.6 Events

| Current                                                                                     | New                                                           | Notes                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `beforetoggle`                                                                              | `beforevaluechange`                                           | Cancelable. `action: "open"` or `"close"`.                   |
| `toggle`                                                                                    | `valuechange`                                                 | `action: "open"` or `"close"`.                               |
| `beforeitemchange`                                                                          | `beforevaluechange`                                           | `action: "move"`.                                            |
| `itemchange`                                                                                | `valuechange`                                                 | `action: "move"`, or `"open"` for the item it opens on.      |
| `settle`                                                                                    | `valuechangecomplete`                                         | Also fires when a close finishes, which nothing fires today. |
| `sheetchange`                                                                               | → same                                                        | `stop` → `snap`.                                             |
| `zoomchange`                                                                                | → same                                                        |                                                              |
| `FluidboxToggleEvent.oldState`, `.newState`                                                 | `FluidboxValueChangeEvent.previousValue`, `.value`, `.action` |                                                              |
| `FluidboxItemChangeEvent.{id,index,item}`                                                   | `FluidboxValueChangeEvent.{value,index,item}`                 |                                                              |
| `.reason` on every event                                                                    | → same                                                        |                                                              |
| `fluidbox-preview-change` (`<fluidbox-item>`)                                               | → same                                                        |                                                              |
| `fluidbox-addon-change` (internal, dispatched by `<fluidbox-filmstrip>`/`<fluidbox-sheet>`) | → same, internal                                              |                                                              |

Reasons stay: `api`, `trigger`, `keyboard`, `pointer`, `wheel`, `items`. A move from the
thumbnails keeps the reason of its input.

## 1.7 Renderer types

| Current                                                | New                                | Notes |
| ------------------------------------------------------ | ---------------------------------- | ----- |
| `FluidboxRenderContext.{item,index,target,signal}`     | → same                             |       |
| `FluidboxSlideRenderContext.target`                    | `FluidboxSlide.media` and `.layer` | §2.8. |
| `FluidboxSlideRenderContext.active`, `.onActiveChange` | → same on `FluidboxSlide`          |       |
| `FluidboxViewerContext.{target,fluidbox,signal}`       | → same                             |       |

## 1.8 Kit (`@ogdakke/fluidbox/kit`)

Not for app code. Names change with the core; listed so nothing goes missing.

| Current                                                                                                  | New                                          | Notes                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `controlNames`, `zoomControlNames`                                                                       | → same                                       |                                                                                    |
| `fluidboxControls`, `FluidboxControl`                                                                    | → same                                       | Adds `counter`.                                                                    |
| `defaultLabels`, `resolveLabels`                                                                         | → same                                       |                                                                                    |
| `bindTrigger`, `createTrigger`                                                                           | → same                                       | Take `value` instead of `target` + `returns`.                                      |
| `frameLayerOf`                                                                                           | removed                                      | `flight: "frame"` names the element directly.                                      |
| `resolveOrigin`                                                                                          | → same                                       | Used by `findTrigger`.                                                             |
| `FluidboxTrigger`, `FluidboxTriggerOptions`, `FluidboxTriggerPointer`                                    | → same                                       |                                                                                    |
| `FluidboxTriggerPreview`                                                                                 | → same                                       | `{ item, index, status }`. Bindings re-export it as the trigger's render argument. |
| `idOf`, `itemLabel`, `targetKey`, `targetKeys`, `indexIn`                                                | → same                                       |                                                                                    |
| `fluidboxControlIcon`                                                                                    | → same                                       |                                                                                    |
| `fluidboxEventTypes`                                                                                     | → same                                       | New list of types.                                                                 |
| `latestOrigins`                                                                                          | `latestFindTrigger`                          | Wraps the newest `findTrigger`/`revealTrigger`.                                    |
| `unloadFluidbox`                                                                                         | → same                                       |                                                                                    |
| `createFluidboxSync`                                                                                     | → same                                       | Takes `value` instead of `open` + `index`.                                         |
| `watchFluidbox`                                                                                          | → same                                       | Reports `value`.                                                                   |
| `FluidboxChangeDetails`                                                                                  | `FluidboxValueChangeDetails`                 | Moves to the root entry.                                                           |
| `fluidboxStaticViewer`, `fluidboxStaticViewerNodes`, `FluidboxStaticNode`, `FluidboxStaticViewerOptions` | → same                                       | Options take `value` instead of `index`; `filmstrip` → `thumbnails`.               |
| `takeOverFluidbox(fluidbox, element, index)`                                                             | `takeOverFluidbox(fluidbox, element, value)` |                                                                                    |
| `FluidboxSlot`, `FluidboxSlots`, `createSlots`                                                           | → same                                       | Also used for slides now.                                                          |
| `FluidboxAddonName`                                                                                      | → same                                       | `"sheet" \| "thumbnails"`.                                                         |
| —                                                                                                        | `createSlideSlots`                           | New. Slots for slides that carry `media`, `layer` and activity.                    |

## 1.9 Labels (`FluidboxLabels`)

| Current                                       | New              | Notes                                                                                                    |
| --------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `viewer`                                      | → same           |                                                                                                          |
| `close`, `previous`, `next`                   | → same           |                                                                                                          |
| `position`                                    | → same           |                                                                                                          |
| `announcement`                                | → same           |                                                                                                          |
| `slides`, `carousel`, `slide`                 | → same           |                                                                                                          |
| `filmstrip`                                   | `thumbnails`     |                                                                                                          |
| `filmstripList`                               | `thumbnailsList` |                                                                                                          |
| `zoomed`                                      | → same           | Also names `ZoomControls`.                                                                               |
| `zoomIn`, `zoomOut`, `zoomReset`, `zoomLevel` | → same           |                                                                                                          |
| `sheet`                                       | → same           |                                                                                                          |
| `error`, `retry`                              | → same           |                                                                                                          |
| —                                             | `counter`        | New: `(index, count) => string`, default `` `${index + 1} / ${count}` ``. Shown by `<Fluidbox.Counter>`. |

## 1.10 CSS custom properties

### Published (the runtime sets them)

| Current                                                                     | New    | On                                               |
| --------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
| `--fluidbox-closed`                                                         | → same | Overlays, travelling copies, transition layers   |
| `--fluidbox-dismiss-progress`                                               | → same | Viewer root                                      |
| `--fluidbox-drag-x`, `--fluidbox-drag-y`                                    | → same | Viewer root                                      |
| `--fluidbox-media-width`, `--fluidbox-media-height`                         | → same | Dialog. Now the media box's size for every type. |
| `--fluidbox-height`                                                         | → same | Viewer root                                      |
| `--fluidbox-scroll-top`                                                     | → same | Viewer root                                      |
| `--fluidbox-content-height`                                                 | → same | Dialog                                           |
| `--fluidbox-sheet-visible`, `-progress`, `-expand`, `-dismiss`, `-keyboard` | → same | Viewer root                                      |

### Inputs (you set them)

| Current                                                                                                                                              | New                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `--fluidbox-background`, `--fluidbox-color`, `--fluidbox-control-background`                                                                         | → same                                   |
| `--fluidbox-backdrop-background`, `--fluidbox-backdrop-filter`, `--fluidbox-backdrop-opacity`                                                        | → same                                   |
| `--fluidbox-focus-color`, `--fluidbox-focus-contrast`                                                                                                | → same                                   |
| `--fluidbox-image-placeholder-background`                                                                                                            | → same                                   |
| `--fluidbox-layer-color`, `--fluidbox-layer-mask-opacity`                                                                                            | → same                                   |
| `--fluidbox-max-upscale`                                                                                                                             | → same                                   |
| `--fluidbox-preview-width`, `--fluidbox-preview-height`                                                                                              | → same                                   |
| `--fluidbox-slide-gap`                                                                                                                               | → same                                   |
| `--fluidbox-stage-top`, `-right`, `-bottom`, `-left`                                                                                                 | → same                                   |
| `--fluidbox-transition-content-opacity`, `--fluidbox-transition-layer-opacity`                                                                       | → same                                   |
| `--fluidbox-zoom-bleed`, `--fluidbox-zoom-clip`                                                                                                      | → same                                   |
| `--fluidbox-gallery-control-opacity`                                                                                                                 | → same                                   |
| `--layer-fluidbox`, `--layer-fluidbox-flight`, `--layer-fluidbox-hover-zoom`                                                                         | → same                                   |
| `--fluidbox-filmstrip-axis`, `-item-size`, `-gap`, `-space`, `-item-radius`, `-zoom-duration`, `-zoom-travel`                                        | `--fluidbox-thumbnails-*`, same suffixes |
| `--fluidbox-sheet-enabled`, `-photo`, `-peek`, `-gap`, `-fit-inset`, `-fit-limit`, `-fade`, `-top`, `-radius`, `-max-width`, `-background`, `-color` | → same                                   |

Internal names (`css-api.ts` `internal`) are not public and are not listed. `--fluidbox-filmstrip-hide`
becomes `--fluidbox-thumbnails-hide`.

## 1.11 Data attributes

### Parts

| Current                                                                              | New                                                                                      | Notes                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `data-fluidbox-overlay`                                                              | `data-fluidbox-viewer`                                                                   | Frees "overlay" for the trigger part, and "viewer" already means this layer. |
| `data-fluidbox-static`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-backdrop`                                                             | → same                                                                                   |                                                                              |
| `data-fluidbox-container`                                                            | → same                                                                                   |                                                                              |
| `data-fluidbox-dialog`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-slides`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-slide`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-frame`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-image-frame`                                                          | → same                                                                                   |                                                                              |
| `data-fluidbox-media`                                                                | → same                                                                                   | Now on the media box of every slide (§5.1).                                  |
| `data-fluidbox-item-content`                                                         | removed                                                                                  | A custom slide's box is `data-fluidbox-media` like every other.              |
| —                                                                                    | `data-fluidbox-slide-layer`                                                              | New. A slide's layer beside the box.                                         |
| `data-fluidbox-mount`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-slide-placeholder`, `data-fluidbox-slide-preview`                     | → same                                                                                   |                                                                              |
| `data-fluidbox-media-cover`                                                          | → same                                                                                   |                                                                              |
| `data-fluidbox-error`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-announcer`                                                            | → same                                                                                   |                                                                              |
| `data-fluidbox-portal`                                                               | → same                                                                                   | The viewer's layer.                                                          |
| `data-fluidbox-addons`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-close`, `-previous`, `-next`                                          | → same                                                                                   |                                                                              |
| `data-fluidbox-zoom-in`, `-zoom-out`, `-zoom-reset`                                  | → same                                                                                   |                                                                              |
| `data-fluidbox-zoom-controls`                                                        | → same                                                                                   | On `<Fluidbox.ZoomControls>`.                                                |
| —                                                                                    | `data-fluidbox-toolbar`, `data-fluidbox-counter`, `data-fluidbox-caption`                | New parts.                                                                   |
| `data-fluidbox-hover-zoom`                                                           | → same                                                                                   |                                                                              |
| `data-fluidbox-icon`                                                                 | → same                                                                                   |                                                                              |
| `data-fluidbox-chrome`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-owns-input`                                                           | → same                                                                                   |                                                                              |
| `data-fluidbox-description`                                                          | → same                                                                                   | `Caption` sets it.                                                           |
| `data-fluidbox-exempt`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-zoom-viewport`                                                        | → same                                                                                   |                                                                              |
| `data-fluidbox-filmstrip-dock`, `-filmstrip`, `-filmstrip-scroll`, `-filmstrip-item` | `data-fluidbox-thumbnails-dock`, `-thumbnails`, `-thumbnails-scroll`, `-thumbnails-item` |                                                                              |
| `data-fluidbox-flight`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-transition-content`, `-transition-layer`                              | → same                                                                                   |                                                                              |
| `data-fluidbox-trigger`                                                              | → same                                                                                   |                                                                              |
| `data-fluidbox-origin`                                                               | → same                                                                                   |                                                                              |
| `data-fluidbox-thumbnail-overlay` (value `travel`)                                   | `data-fluidbox-trigger-overlay` (value = `flight`)                                       |                                                                              |
| `data-fluidbox-frame-layer`                                                          | `data-fluidbox-trigger-overlay="frame"`                                                  |                                                                              |
| `data-fluidbox-ghost`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-item-id`                                                              | `data-fluidbox-value`                                                                    | Holds an id, or ids separated by spaces.                                     |
| `data-fluidbox-returns` (read by the gallery, listed internal)                       | removed                                                                                  | Folded into `data-fluidbox-value`.                                           |
| `data-fluidbox-media-addon`, `-media-poster`                                         | → same                                                                                   |                                                                              |
| `data-fluidbox-embed`, `-embed-play`                                                 | → same                                                                                   |                                                                              |
| `data-fluidbox-model`                                                                | → same                                                                                   |                                                                              |
| `data-fluidbox-spin`                                                                 | → same                                                                                   |                                                                              |

### Sheet parts

| Current                                                                                                   | New                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `data-fluidbox-sheet-scroller`, `-sheet-stage`, `-sheet-slot`, `-sheet`, `-sheet-handle`, `-sheet-scroll` | → same                                                                                              |
| `data-fluidbox-sheet-stop`                                                                                | `data-fluidbox-sheet-snap` (the internal marker of that name is renamed `data-fluidbox-sheet-mark`) |

### States

| Current                                                                                                                                                                                            | New                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `data-fluidbox-status`, `data-open`, `data-closed`, `data-starting-style`, `data-opening`, `data-ending-style`, `data-dragging`, `data-dismissing`, `data-zoomed`, `data-zoomable`, `data-gallery` | → same                                                                                 |
| `data-fluidbox-hover-zooming`                                                                                                                                                                      | → same                                                                                 |
| `data-sheet`                                                                                                                                                                                       | → same (the snap index)                                                                |
| `data-sheet-raised`, `-expanded`, `-peeking`, `-off`, `-dismiss`, `-dismissed`                                                                                                                     | → same                                                                                 |
| `data-fluidbox-thumbnail-hidden`                                                                                                                                                                   | → same                                                                                 |
| `data-fluidbox-phase`                                                                                                                                                                              | → same                                                                                 |
| `aria-selected`, `data-fluidbox-selected` (filmstrip items)                                                                                                                                        | → same (thumbnails items)                                                              |
| `data-fluidbox-media-pending`                                                                                                                                                                      | → same                                                                                 |
| `data-fluidbox-embed-playing`, `-embed-ready`                                                                                                                                                      | → same                                                                                 |
| `data-fluidbox-model-ready`, `-model-error`                                                                                                                                                        | → same                                                                                 |
| `data-fluidbox-spin-loaded`, `data-frame`, `data-grabbing`                                                                                                                                         | → same                                                                                 |
| —                                                                                                                                                                                                  | `data-active` on `[data-fluidbox-slide]` and on `Thumbnails` items: the slide on show. |

## 1.12 React (`@ogdakke/fluidbox/react`)

### Parts

| Current                                                                | New                                                                                                     | Notes                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                                                        | → same                                                                                                  | Props in the next table.                                                                                                      |
| `Fluidbox.Trigger`                                                     | → same                                                                                                  | `item` + `returns` → `value`.                                                                                                 |
| `Fluidbox.Viewer`                                                      | → same                                                                                                  |                                                                                                                               |
| `Fluidbox.Controls`                                                    | removed                                                                                                 | `<Fluidbox.Toolbar />` with no children renders Previous, Next and Close; `<Fluidbox.ZoomControls />` renders the zoom group. |
| `Fluidbox.Close`, `Previous`, `Next`, `ZoomIn`, `ZoomOut`, `ZoomReset` | → same                                                                                                  |                                                                                                                               |
| `Fluidbox.Filmstrip`                                                   | `Fluidbox.Thumbnails`                                                                                   |                                                                                                                               |
| `Fluidbox.Sheet`                                                       | → same                                                                                                  |                                                                                                                               |
| `Fluidbox.SheetStop`                                                   | `Fluidbox.SheetSnap`                                                                                    | `stop` → `to`.                                                                                                                |
| `Fluidbox.ThumbnailOverlay`                                            | `Fluidbox.Overlay`                                                                                      | `travel` → `flight`.                                                                                                          |
| `Fluidbox.FrameLayer`                                                  | `<Fluidbox.Overlay flight="frame">`                                                                     |                                                                                                                               |
| —                                                                      | `Fluidbox.Slides`, `Media`, `Image`, `Video`, `Iframe`, `Toolbar`, `ZoomControls`, `Counter`, `Caption` | New.                                                                                                                          |
| `Action` (named in the brief)                                          | —                                                                                                       | No binding exports it. Only the props type `FluidboxActionProps` exists (React, Solid). Nothing to map beyond the type.       |

### Root props

| Current                                | New                                     | Notes                            |
| -------------------------------------- | --------------------------------------- | -------------------------------- |
| `items`                                | → same                                  |                                  |
| `open`                                 | `value`                                 | `null` closed, an id open.       |
| `index`                                | `value`                                 |                                  |
| `onOpenChange(open, details)`          | `onValueChange(value, details)`         |                                  |
| `onIndexChange(index, details)`        | `onValueChange(value, details)`         |                                  |
| —                                      | `defaultValue`                          | New, uncontrolled start.         |
| `loop`                                 | → same                                  |                                  |
| `href(index \| null)`                  | `href(value \| null)`                   | Called with an id.               |
| `labels`                               | → same                                  |                                  |
| `zoom`                                 | → same                                  |                                  |
| `renderers`                            | removed                                 | `<Fluidbox.Slides>` props.       |
| `origins`                              | `findTrigger`, `revealTrigger`          |                                  |
| `loading`                              | `preload`                               |                                  |
| `onBeforeToggle`, `onBeforeItemChange` | `onValueChange` with `details.cancel()` |                                  |
| `onToggle`, `onItemChange`             | `onValueChange`                         |                                  |
| `onSettle`                             | `onValueChangeComplete`                 |                                  |
| `onSheetChange`                        | `<Fluidbox.Sheet onSnapChange>`         | Moves to the part it belongs to. |
| `onZoomChange`                         | → same                                  |                                  |
| `children`                             | → same                                  |                                  |

### Other props

| Current                                                                     | New                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Trigger `asChild`                                                           | → same                                                           |
| Trigger `item`, `returns`                                                   | `value`                                                          |
| Trigger `children(preview)`                                                 | → same: `({ item, index, status })`                              |
| `FluidboxControlsProps.zoom`                                                | removed (see `Controls`)                                         |
| Filmstrip `children({ item, index })`                                       | Thumbnails `children({ item, index, active })`                   |
| Sheet `snapPoints`, `dismiss`, `children({ item, index })`, HTML attributes | → same, `dismiss` → `dismissMotion` (§2.14); adds `onSnapChange` |
| SheetStop `stop`                                                            | SheetSnap `to`                                                   |
| ThumbnailOverlay `travel`                                                   | Overlay `flight`                                                 |

### Hooks and types

| Current                                                                                                         | New                                        | Notes                                            |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `useFluidbox()`, `useFluidbox(selector)`                                                                        | → same                                     | State `id` → `value`; `resetZoom` → `zoomReset`. |
| `useFluidboxSheet()` → `{ stop, set }`                                                                          | `useFluidboxSheet()` → `{ snap, setSnap }` |                                                  |
| —                                                                                                               | `useFluidboxSlide(options?)`               | New.                                             |
| `FluidboxApi`, `FluidboxCommands`, `UseFluidbox`, `FluidboxSheetApi`                                            | → same                                     |                                                  |
| `FluidboxReactRenderContext`, `FluidboxReactRenderer`                                                           | removed                                    | Slide content reads `useFluidboxSlide()`.        |
| `FluidboxItemContext`                                                                                           | → same                                     |                                                  |
| `FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxViewerProps`, `FluidboxSheetProps`, `FluidboxActionProps` | → same                                     |                                                  |
| `FluidboxControlsProps`                                                                                         | removed                                    |                                                  |
| `FluidboxFilmstripProps`                                                                                        | `FluidboxThumbnailsProps`                  |                                                  |
| `FluidboxSheetStopProps`                                                                                        | `FluidboxSheetSnapProps`                   |                                                  |
| `FluidboxThumbnailOverlayProps`, `FluidboxFrameLayerProps`                                                      | `FluidboxOverlayProps`                     |                                                  |
| `FluidboxReactParts`                                                                                            | → same                                     |                                                  |
| `FluidboxChangeDetails`                                                                                         | `FluidboxValueChangeDetails`               |                                                  |
| `FluidboxTriggerPreview`                                                                                        | → same                                     |                                                  |
| Core type re-exports (23 names)                                                                                 | → same, renamed as in §1.2                 |                                                  |

## 1.13 Vue (`@ogdakke/fluidbox/vue`)

| Current                                                                                                                                                                                                  | New                                                              | Notes                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| The 15 parts                                                                                                                                                                                             | As React (§1.12)                                                 | Same names.                                 |
| Root props `items, labels, zoom, loop, origins, loading`                                                                                                                                                 | `items, labels, zoom, loop, findTrigger, revealTrigger, preload` |                                             |
| Root `open`/`v-model:open`, `index`/`v-model:index`                                                                                                                                                      | `v-model` (`modelValue`)                                         | `null` or an id.                            |
| `update:open`, `update:index` emits                                                                                                                                                                      | `update:modelValue(value, details)`                              |                                             |
| `beforetoggle`, `beforeitemchange` emits                                                                                                                                                                 | `update:modelValue` with `details.cancel()`                      |                                             |
| `toggle`, `itemchange` emits                                                                                                                                                                             | `update:modelValue`                                              |                                             |
| `settle` emit                                                                                                                                                                                            | `value-change-complete`                                          |                                             |
| `sheetchange` emit                                                                                                                                                                                       | `<Fluidbox.Sheet @snap-change>`                                  |                                             |
| `zoomchange` emit                                                                                                                                                                                        | `zoom-change`                                                    | Vue's kebab-case convention for emits.      |
| Root `renderers`                                                                                                                                                                                         | removed                                                          | Named slots on `<Fluidbox.Slides>` (§3.13). |
| Root default slot `(api)`                                                                                                                                                                                | → same                                                           |                                             |
| Trigger `as-child`, `item`, `returns`, slot `(preview)`                                                                                                                                                  | `as-child`, `value`, slot `(preview)`                            |                                             |
| Controls `zoom`                                                                                                                                                                                          | removed                                                          |                                             |
| Filmstrip slot                                                                                                                                                                                           | Thumbnails slot                                                  |                                             |
| Sheet `snap-points`, `dismiss` (→ `dismiss-motion`, §2.14), slot                                                                                                                                         | → same                                                           |                                             |
| SheetStop `stop`                                                                                                                                                                                         | SheetSnap `to`                                                   |                                             |
| ThumbnailOverlay `travel`, FrameLayer                                                                                                                                                                    | Overlay `flight`                                                 |                                             |
| `useFluidbox()`, `useFluidbox(selector)`, `useFluidboxSheet()`                                                                                                                                           | → same, plus `useFluidboxSlide()`                                |                                             |
| Types `FluidboxApi`, `FluidboxCommands`, `FluidboxItemContext`, `FluidboxSheetApi`, `FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxSheetProps`, `FluidboxTriggerPreview`, `FluidboxChangeDetails` | → same, `FluidboxChangeDetails` → `FluidboxValueChangeDetails`   |                                             |
| `FluidboxVueRenderContext`, `FluidboxVueRenderer`                                                                                                                                                        | removed                                                          |                                             |

## 1.14 Solid (`@ogdakke/fluidbox/solid`)

| Current                                                                                                                                                                                                                                                                                                                                           | New                                                  | Notes                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The 15 parts                                                                                                                                                                                                                                                                                                                                      | As React                                             |                                                                                                                          |
| Root props                                                                                                                                                                                                                                                                                                                                        | As React                                             | Including `value`, `onValueChange`, `onValueChangeComplete`.                                                             |
| Trigger `as`, `item`, `returns`, `ref`, children `(preview: Accessor)`                                                                                                                                                                                                                                                                            | `as`, `value`, `ref`, children `(preview: Accessor)` |                                                                                                                          |
| Viewer                                                                                                                                                                                                                                                                                                                                            | → same                                               | Its doc says it keeps the default Close; the code drops every default. The new rule (§3.4) is the same in every binding. |
| `useFluidbox()`, `useFluidbox(selector)`, `useFluidboxSheet()`                                                                                                                                                                                                                                                                                    | → same, plus `useFluidboxSlide()`                    |                                                                                                                          |
| Types `FluidboxApi`, `FluidboxSheetApi`, `FluidboxRootProps`, `FluidboxTriggerProps`, `FluidboxSheetProps`, `FluidboxViewerProps`, `FluidboxActionProps`, `FluidboxSheetStopProps`, `FluidboxThumbnailOverlayProps`, `FluidboxFrameLayerProps`, `FluidboxFilmstripProps`, `FluidboxControlsProps`, `FluidboxSolidParts`, `FluidboxTriggerPreview` | Renamed as React                                     |                                                                                                                          |
| `FluidboxSolidRenderContext`, `FluidboxSolidRenderer`                                                                                                                                                                                                                                                                                             | removed                                              |                                                                                                                          |
| `FluidboxItemContext`, `FluidboxChangeDetails` (defined, not exported)                                                                                                                                                                                                                                                                            | exported                                             |                                                                                                                          |

## 1.15 Angular (`@ogdakke/fluidbox/angular`)

| Current                                                                           | New                                                                                                                                                                                  | Notes                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `FluidboxModule`                                                                  | → same                                                                                                                                                                               |                                                                   |
| `FluidboxRootDirective` `[fluidboxRoot]`, `exportAs: "fluidbox"`                  | → same                                                                                                                                                                               |                                                                   |
| Root inputs `items, labels, zoom, loop, origins, loading`                         | `items, labels, zoom, loop, findTrigger, revealTrigger, preload`                                                                                                                     | Signal `input()`s.                                                |
| Root `[(open)]`, `[(index)]`                                                      | `[(value)]`                                                                                                                                                                          | `model()`.                                                        |
| Root `renderers`                                                                  | removed                                                                                                                                                                              | `<ng-template fluidboxSlide="type">`.                             |
| Outputs `beforeToggle`, `beforeItemChange`                                        | `beforeValueChange`                                                                                                                                                                  | Emits the cancelable `FluidboxValueChangeEvent`.                  |
| Outputs `toggle`, `itemChange`                                                    | `valueChange` (from the model)                                                                                                                                                       |                                                                   |
| Output `settle`                                                                   | `valueChangeComplete`                                                                                                                                                                |                                                                   |
| Output `sheetChange`                                                              | `snapChange` on `fluidboxSheet`                                                                                                                                                      |                                                                   |
| Output `zoomChange`                                                               | → same                                                                                                                                                                               |                                                                   |
| Root members `fluidbox, state, list, resolvedLabels, api, sheet`, commands        | → same; `resetZoom` → `zoomReset`                                                                                                                                                    |                                                                   |
| Root members `watch`, `connect`, `schedule` (marked internal, but public)         | made private                                                                                                                                                                         |                                                                   |
| `FluidboxTriggerDirective` `[fluidboxTrigger]`, `fluidboxReturns`, `preview`      | `[fluidboxTrigger]` takes a value or a list; `fluidboxReturns` removed; `preview` → same                                                                                             |                                                                   |
| `FluidboxThumbnailOverlayComponent` `[fluidboxThumbnailOverlay]`, `travel`        | `FluidboxOverlayComponent` `[fluidboxOverlay]`, `flight`                                                                                                                             |                                                                   |
| `FluidboxFrameLayerDirective` `[fluidboxFrameLayer]`                              | `[fluidboxOverlay] flight="frame"`                                                                                                                                                   |                                                                   |
| `FluidboxViewerDirective` `ng-template[fluidboxViewer]`                           | → same                                                                                                                                                                               |                                                                   |
| `FluidboxSheetStopDirective` `button[fluidboxSheetStop]`                          | `FluidboxSheetSnapDirective` `button[fluidboxSheetSnap]`                                                                                                                             |                                                                   |
| `FluidboxControlDirective` (abstract)                                             | → same, not exported                                                                                                                                                                 |                                                                   |
| `FluidboxCloseDirective` … `FluidboxZoomResetDirective`                           | → same                                                                                                                                                                               |                                                                   |
| `FluidboxControlsComponent` `[fluidboxControls]`, `zoom`                          | removed                                                                                                                                                                              | `[fluidboxToolbar]` and `[fluidboxZoomControls]`.                 |
| `FluidboxFilmstripDirective` `[fluidboxFilmstrip]`                                | `FluidboxThumbnailsDirective` `[fluidboxThumbnails]`                                                                                                                                 |                                                                   |
| `FluidboxSheetDirective` `ng-template[fluidboxSheet]`                             | → same                                                                                                                                                                               |                                                                   |
| `injectFluidbox()`, `injectFluidbox(select)`, `injectFluidboxSheet()`             | → same, plus `injectFluidboxSlide()`                                                                                                                                                 |                                                                   |
| Types `FluidboxApi`, `FluidboxSheetApi`, `FluidboxItemContext`, `FluidboxContent` | → same; `FluidboxContent` removed with `renderers`                                                                                                                                   |                                                                   |
| Core re-exports                                                                   | Renamed as §1.2                                                                                                                                                                      | Adds `FluidboxSlideRenderer`, `FluidboxSlide`, `FluidboxOptions`. |
| —                                                                                 | `[fluidboxSlide]`, `[fluidboxMedia]`, `fluidbox-image`, `fluidbox-video`, `fluidbox-iframe`, `[fluidboxToolbar]`, `[fluidboxZoomControls]`, `[fluidboxCounter]`, `[fluidboxCaption]` | New (§3.15).                                                      |

## 1.16 Custom elements (`@ogdakke/fluidbox/elements`)

| Current                                                                                                                       | New                                                                                                                         | Notes                         |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `<fluidbox-gallery>` / `FluidboxGalleryElement`                                                                               | → same                                                                                                                      |                               |
| attr `open`, `index`                                                                                                          | attr `value`                                                                                                                | An id; absent means closed.   |
| attr `nozoom`, `zoom-step`, `zoom-max`, `loop`                                                                                | → same                                                                                                                      |                               |
| attr `loading`                                                                                                                | attr `preload`                                                                                                              |                               |
| prop `items`, `labels`, `zoom`, `viewer`                                                                                      | → same                                                                                                                      |                               |
| prop `renderers`                                                                                                              | prop `slides`                                                                                                               |                               |
| prop `origins`                                                                                                                | props `findTrigger`, `revealTrigger`                                                                                        |                               |
| prop `loading`                                                                                                                | prop `preload`                                                                                                              |                               |
| prop `fluidbox`, `state`, `sheet`; `whenReady()`, `subscribe()`, `setItems()`, commands                                       | → same; `resetZoom` → `zoomReset`                                                                                           |                               |
| `FluidboxGalleryEventMap`                                                                                                     | → same, new event names                                                                                                     |                               |
| `<template slot="viewer">`                                                                                                    | → same                                                                                                                      |                               |
| `<fluidbox-controls>` placeholder (`zoom` attr)                                                                               | `<fluidbox-toolbar>` placeholder; `<fluidbox-zoom-controls>` placeholder                                                    |                               |
| `<fluidbox-item>` / `FluidboxItemElement`, attr `item-id`                                                                     | attr `value`                                                                                                                |                               |
| `<fluidbox-item>` attr `returns`                                                                                              | folded into `value="a b c"` on the trigger: first opens, all return                                                         |                               |
| `<fluidbox-item>` attr `placeholder`, `aria-label`; slots `trigger`, `content`, `sheet`; props `itemId`, `returns`, `trigger` | → same; `itemId` → `value`; `returns` removed                                                                               |                               |
| `fluidbox-preview-change`                                                                                                     | → same                                                                                                                      |                               |
| `<fluidbox-filmstrip>` / `FluidboxFilmstripElement` (`render`)                                                                | `<fluidbox-thumbnails>` / `FluidboxThumbnailsElement`                                                                       |                               |
| `<fluidbox-sheet>` / `FluidboxSheetElement` (`snap-points`, `dismiss` → `dismiss-motion`, `render`)                           | → same                                                                                                                      |                               |
| `FluidboxPreviewChangeEvent`                                                                                                  | → same                                                                                                                      |                               |
| Content-template mapping (`img`/`picture`, `video` + `track`, `iframe[src]`, other markup → custom)                           | → same, other markup → the slide of the item's `type` attribute, else a markup slide                                        |                               |
| —                                                                                                                             | `<img data-zoom-src data-zoom-srcset>`                                                                                      | New: sets `zoom` from markup. |
| —                                                                                                                             | `<template data-fluidbox-slide="type">`, `<fluidbox-media>`, `<fluidbox-image>`, `<fluidbox-counter>`, `<fluidbox-caption>` | New (§3.16).                  |

## 1.17 Thumbnails and sheet entries

| Current                                                                                                      | New                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `./filmstrip` registers `createFilmstrip`; exports type `FluidboxFilmstripOptions`                           | `./thumbnails` registers the thumbnails; exports `FluidboxThumbnailsOptions` |
| `./sheet` registers `createSheet`; exports `FluidboxSheet`, `FluidboxSheetOptions`, `FluidboxSheetSnapPoint` | → same                                                                       |
| Turning one on without its import throws an Error naming the import                                          | → same, with the new name                                                    |

## 1.18 Add-on entries

### `./hover-zoom`

| Current                                              | New                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `hoverZoom(element, item, { scale, image, signal })` | → same. Reads `item.zoom` instead of `zoomSrc`/`zoomSrcset`. |
| `FluidboxHoverZoomOptions`                           | → same                                                       |

### `./embeds` → `./embed`

| Current                                                                                   | New                                                                                                          | Notes                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `FluidboxEmbedProvider` (`"youtube" \| "vimeo"`)                                          | `FluidboxEmbedProvider`, the provider object                                                                 | `name: string` on it; `FluidboxEmbedItem.provider` is that name. |
| —                                                                                         | `createEmbedProvider`, `FluidboxEmbedProviderOptions`, `FluidboxEmbedVideo`, `youtube`, `vimeo`, `embedItem` | New: providers as a public API (§4.2).                           |
| `FluidboxEmbedItem` (custom + `provider`, `video`, `hash`, `start`, `poster`)             | → same, `type: "embed"`                                                                                      |                                                                  |
| `FluidboxEmbedItemOptions` (`title, id, width, height, thumbnail, poster, start, render`) | → same without `render`                                                                                      |                                                                  |
| `parseYouTube`, `parseVimeo`, `embedUrl`                                                  | `youtube.parse`, `vimeo.parse`, `youtube.url`, `vimeo.url`                                                   | Moved into the providers.                                        |
| `EMBED_ALLOW`                                                                             | → same                                                                                                       | The default `allow`.                                             |
| `youtubeItem`, `vimeoItem`                                                                | → same                                                                                                       | Produce `type: "embed"`.                                         |
| `isEmbedItem`                                                                             | removed                                                                                                      | `item.type === "embed"` narrows.                                 |
| `createEmbedRenderer({ label })`, `FluidboxEmbedRendererOptions`                          | `createEmbedSlide({ providers, label })`, `FluidboxEmbedSlideOptions`                                        | `providers` defaults to `[youtube, vimeo]`.                      |
| `renderEmbed`                                                                             | `embedSlide`                                                                                                 |                                                                  |

### `./spin`

| Current                                                                     | New                                           | Notes         |
| --------------------------------------------------------------------------- | --------------------------------------------- | ------------- |
| `FluidboxSpinItem`, `FluidboxSpinItemOptions`, `FluidboxSpinFrameTemplate`  | → same, `type: "spin"`, no `render`           |               |
| `spinItem`, `spinFrames`                                                    | → same                                        |               |
| `isSpinItem`                                                                | removed                                       | Discriminant. |
| `createSpinRenderer({ label, keep, turns })`, `FluidboxSpinRendererOptions` | `createSpinSlide`, `FluidboxSpinSlideOptions` |               |

### `./model`

| Current                                                                                                                   | New                                                                    | Notes                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `FluidboxModelItem` (`model: true`, `src`, `poster`, `ar`, `arModes`, `iosSrc`, `attributes`), `FluidboxModelItemOptions` | → same, `type: "model"`; the `model: true` marker and `render` removed |                                                                 |
| `modelItem`                                                                                                               | → same                                                                 | Sets `fit: "fill"`; `width` and `height` optional (§4.4, §5.4). |
| `isModelItem`                                                                                                             | removed                                                                | Discriminant.                                                   |
| `createModelRenderer({ load })`, `FluidboxModelRendererOptions`                                                           | `createModelSlide({ load })`, `FluidboxModelSlideOptions`              |                                                                 |

## 1.19 Stale or wrong docs found while reading

Fix these as part of the docs step (§9):

- `docs/PUBLIC_API.md` names `FluidboxChangeEvent`; the class is `FluidboxItemChangeEvent`. It lists
  a `filmstrip` member that the interface doesn't have, and says "nine patterns" (there are 13).
- `apps/docs/content/patterns/origins.md:15` writes `revealOrigin(id, index, { signal, reason })`;
  the field is `phase`.
- `index.md:38` and `getting-started.md:138` say "nine common setups"; the framework pages' pattern
  tables list 11 and omit hover and media.
- `roadmap.md:66` lists sharper zoom images as after 1.0; they ship.
- `custom-elements.md:64` has `zoom` in a "Class" cell.
- `items-and-origins.md:192` says `phase` is `"open"` after an opening; the source says before.
- Solid's `Viewer` doc says the default Close stays; the code removes all defaults.
- `docs/BINDINGS.md` describes the bindings as wrappers of `<fluidbox-gallery>` with a `source`
  prop. That is a previous design. Replace it with part 3.

## 1.20 Additions from the third amendment

All new; nothing old is renamed except the sheet's `dismiss`. "Step" is the plan step (§9.2).

| Where                          | Name                                                                                     | Step                | §          |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------- | ---------- |
| Options / Root                 | `dismiss: { drag, backdrop }`, `wheel`                                                   | 1                   | 2.14       |
| Options / Root                 | `shareUrl`                                                                               | 1                   | 2.12       |
| Options / Root                 | `slideshow`, `reachEndThreshold`                                                         | 7                   | 2.19, 2.20 |
| `FluidboxSheetOptions.dismiss` | → `dismissMotion: "flight" \| "scroll"`; `"none"` → Root `dismiss.drag: false`           | 1                   | 2.14       |
| Item fields                    | `download`, `data`                                                                       | 1                   | 2.12, 2.15 |
| Image item                     | `tiles` (read by the deep-zoom add-on)                                                   | 7                   | 2.18       |
| State                          | `fullscreen`                                                                             | 1                   | 2.11       |
| State                          | `playing`                                                                                | 7                   | 2.19       |
| Commands                       | `setFullscreen`, `download`, `share`                                                     | 1                   | 2.11, 2.12 |
| Commands                       | `play`, `pause`                                                                          | 7                   | 2.19       |
| Events                         | `mediaerror` / `FluidboxMediaErrorEvent`, `FluidboxMediaErrorKind`                       | 1                   | 2.13       |
| Events                         | `reachend` / `FluidboxReachEndEvent`                                                     | 7                   | 2.20       |
| `FluidboxReason`               | `"slideshow"`                                                                            | 7                   | 2.19       |
| `FluidboxSlide`                | `fail`, `onZoom`; `zoomable(on \| { max, sharpen })`                                     | 1 (`onZoom` in 1.4) | 2.13, 2.18 |
| `FluidboxSlide`                | `hotspot`                                                                                | 7                   | 2.17       |
| Types                          | `FluidboxZoomPose`, `FluidboxZoomableOptions`, `FluidboxSlideshowOptions`                | 1, 7                | 2.18, 2.19 |
| `FluidboxControlName`          | `"fullscreen"`, `"download"`, `"share"`                                                  | 1                   | 3.18       |
| `FluidboxControlName`          | `"slideshow"`                                                                            | 7                   | 3.18       |
| Labels                         | `enterFullscreen`, `exitFullscreen`, `download`, `share`, `linkCopied`                   | 1                   | 2.9        |
| Labels                         | `playSlideshow`, `pauseSlideshow`                                                        | 7                   | 2.9        |
| Item lists                     | `withCount(count)` on `createItemList` lists                                             | 7                   | 2.20       |
| CSS                            | `--fluidbox-motion-speed` (input), `--fluidbox-zoom-scale` (published, on the media box) | 7, 1.4              | 2.16, 2.17 |
| Data attributes                | `data-fluidbox-fullscreen`, `-download`, `-share`, `data-copied`, item `data-*`          | 1                   | 3.18, 2.15 |
| Data attributes                | `data-fluidbox-slideshow`, `-hotspot`                                                    | 7                   | 3.18       |
| Parts (all bindings)           | `Fullscreen`, `Download`, `Share`; Root `onMediaError`                                   | 2, 4                | 3.18       |
| Parts (all bindings)           | `Slideshow`, `Hotspot`; Root `onReachEnd`                                                | 7                   | 3.18       |
| Hooks                          | `useFluidboxSlide().fail`, `.onZoom`                                                     | 2                   | 3.18       |
| Entry                          | `@ogdakke/fluidbox/deep-zoom` (`deepZoomSlide`, `DeepZoom` parts)                        | after 1.0           | 2.18       |

## 1.21 Fourth amendment: icons, styles, CSS variables

| Today                                                                                                                                                                                                                                                                                                               | New                                                                                         | §          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| `control-icons.ts`: `CONTROL_ICON_PATHS`, `CONTROL_ICON_ATTRIBUTES`, `controlIcon`                                                                                                                                                                                                                                  | removed                                                                                     | 2.21       |
| kit `fluidboxControlIcon`                                                                                                                                                                                                                                                                                           | removed                                                                                     | 2.21       |
| React `defaultIcon`, Vue `controlIcon`, Solid `defaultIcon`, Angular `#icon()`                                                                                                                                                                                                                                      | removed; a part without children renders its label text                                     | 2.21, 3.19 |
| static viewer control icons (`static-viewer.ts:53-58`)                                                                                                                                                                                                                                                              | label text                                                                                  | 2.21       |
| embed Play triangle (`embeds.ts:309-315`)                                                                                                                                                                                                                                                                           | label text, or `play` (a Node factory or a node)                                            | 4.9        |
| `data-fluidbox-icon` on drawn SVGs                                                                                                                                                                                                                                                                                  | removed; `<template data-fluidbox-icon="name">` in markup                                   | 2.21, 10.6 |
| —                                                                                                                                                                                                                                                                                                                   | `fluidbox.bindControl(element, name)`                                                       | 2.21       |
| —                                                                                                                                                                                                                                                                                                                   | option and gallery property `icons: Partial<Record<FluidboxControlName, () => Node>>`       | 2.21       |
| —                                                                                                                                                                                                                                                                                                                   | `"retry"` in `FluidboxControlName`                                                          | 3.19       |
| —                                                                                                                                                                                                                                                                                                                   | parts `Loading`, `Error`, `Retry` (and Angular, elements forms)                             | 3.19       |
| —                                                                                                                                                                                                                                                                                                                   | prop `label: string \| false` on every control part; markup `data-fluidbox-label="content"` | 3.19       |
| —                                                                                                                                                                                                                                                                                                                   | slide attributes `data-busy`, `data-error`; control attribute `data-fluidbox-default`       | 10.6       |
| `styles.css`, `filmstrip.css` (→ `thumbnails.css`), `sheet.css`: look and mechanics together, unlayered                                                                                                                                                                                                             | functional rules only, in `@layer fluidbox`                                                 | 10.1–10.3  |
| —                                                                                                                                                                                                                                                                                                                   | `@ogdakke/fluidbox/baseline.css`, opt-in, in `@layer fluidbox-baseline`                     | 10.4       |
| `--fluidbox-background`, `--fluidbox-color`, `--fluidbox-control-background`, `--fluidbox-focus-color`, `--fluidbox-focus-contrast`, `--fluidbox-backdrop-background`, `--fluidbox-backdrop-filter`, `--fluidbox-backdrop-opacity`, `--fluidbox-image-placeholder-background`, `--fluidbox-gallery-control-opacity` | leave the package API; `baseline.css` tokens                                                | 10.5       |
| `--fluidbox-filmstrip-hide`, `-zoom-duration`, `-zoom-travel`, `-item-radius`                                                                                                                                                                                                                                       | `baseline.css` tokens, renamed `--fluidbox-thumbnails-*`                                    | 10.5       |
| `--fluidbox-sheet-radius`, `-max-width`, `-background`, `-color`, `-fade`                                                                                                                                                                                                                                           | `baseline.css` tokens (`max-width` keeps its declaration in the package, with no default)   | 10.5       |
| mechanics properties (stage insets, layers, preview size, slide gap, max upscale, transition and layer opacities, layer colour and mask opacity, zoom bleed and clip, thumbnails axis, item size, gap and space, sheet enabled, photo, peek, gap, fit inset and limit, top)                                         | → same, package API                                                                         | 10.5       |
| —                                                                                                                                                                                                                                                                                                                   | `--fluidbox-icon-*` (14 glyph tokens), baseline only                                        | 10.4       |
