# Fluidbox styling contract

`@ogdakke/fluidbox/elements` registers the custom elements without installing CSS. Import `@ogdakke/fluidbox/styles.css` explicitly for the current viewer styling. Style the viewer through its data attributes and CSS variables. The stylesheet does not require CSS `@scope`.

## Authoring content

Every `<fluidbox-item>` requires a stable `item-id`, one trigger, and one inert content template. The gallery compiles this markup into the same `FluidboxItem` model used by `createFluidbox()`. Standard `src`, `srcset`, `sizes`, `type`, and `media` attributes pass through to the generated viewer `<picture>`.

```html
<fluidbox-gallery role="group" aria-label="Photos">
  <fluidbox-item item-id="mountain">
    <button slot="trigger" type="button">
      <img src="/media/mountain-768w.webp" alt="Mountain" width="768" height="512" />
    </button>
    <template slot="content">
      <picture>
        <source
          type="image/avif"
          srcset="/media/mountain-768w.avif 768w, /media/mountain.avif 1536w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcset="/media/mountain-768w.webp 768w, /media/mountain.webp 1536w"
          sizes="100vw"
        />
        <img src="/media/mountain.webp" width="1536" height="1024" alt="Mountain" />
      </picture>
    </template>
  </fluidbox-item>
  <fluidbox-filmstrip></fluidbox-filmstrip>
</fluidbox-gallery>
```

The template is inert, so full-size resources do not load while the gallery is closed. `<fluidbox-gallery>` owns one `createFluidbox()` controller. `<fluidbox-item>` only describes an item and its transition origin. Non-image template content uses the core custom-media renderer and is cloned into the bounded slide window.

For image items, set `placeholder-src` on `<fluidbox-item>` to a small data URL or other immediately
available image. The runtime paints it behind the slide's preview and full image, including adjacent
slides during a swipe. The full image only covers it after decoding.

## Parts

The main viewer parts have data selectors. The runtime does not generate class names. The body-level overlay and flight layer are separate from `fluidbox-item`, so selectors for open viewer parts should start at `[data-fluidbox-overlay]` or `[data-fluidbox-flight]`, not at the host element.

| Selector                             | Part                                             |
| ------------------------------------ | ------------------------------------------------ |
| `[data-fluidbox-trigger]`            | Element that opens the lightbox                  |
| `[data-fluidbox-preview]`            | Optional preview box used for handoff geometry   |
| `[data-fluidbox-target]`             | Preferred handoff target inside a custom preview |
| `[data-fluidbox-overlay]`            | Body-level portal root                           |
| `[data-fluidbox-container]`          | Gesture and layout container                     |
| `[data-fluidbox-backdrop]`           | Modal backdrop                                   |
| `[data-fluidbox-dialog]`             | Accessible dialog                                |
| `[data-fluidbox-portal]`             | Application controls and caption mount target    |
| `[data-fluidbox-slides]`             | Native horizontal gallery scroller               |
| `[data-fluidbox-slide]`              | Gallery item                                     |
| `[data-fluidbox-frame]`              | Cropping and radius frame                        |
| `[data-fluidbox-media]`              | Image media element                              |
| `[data-fluidbox-content]`            | Arbitrary standalone content wrapper             |
| `[data-fluidbox-item-content]`       | Arbitrary gallery item                           |
| `[data-fluidbox-close]`              | Close control                                    |
| `[data-fluidbox-filmstrip]`          | Filmstrip root                                   |
| `[data-fluidbox-filmstrip-scroll]`   | Filmstrip scroller                               |
| `[data-fluidbox-filmstrip-item]`     | Filmstrip option                                 |
| `[data-fluidbox-transition-layer]`   | Authored content that travels with an item       |
| `[data-fluidbox-transition-content]` | Portalled transition content plane               |

The runtime also marks zoom, error, status, thumbnail, and preview-proxy elements with `data-fluidbox-*` attributes. Treat these as implementation details unless listed above or below.

For a plain image lightbox, the image itself supplies the handoff geometry. A custom trigger can
mark its visual box with `data-fluidbox-preview`. If that box contains a more precise transition
target, mark the nested element with `data-fluidbox-target`; it takes precedence over the preview
box. `data-fluidbox-thumbnail` remains the optional image source for loading and filmstrip artwork.

An indexed gallery assigns a canonical `FluidboxSource` to `gallery.source` and a `FluidboxOriginAdapter` to `gallery.origins`. Mark a mounted trigger's visible clipped box with `data-fluidbox-origin`. The descendant image remains the media preview even when a wrapper supplies geometry and corner radius. A virtualized host can implement `revealOrigin(id, index, { signal, reason })`. Viewer motion never waits for it, and the runtime aborts stale reveals on selection, close, source replacement, and teardown.

Call `await gallery.whenReady()` before using `gallery.controller` from application JavaScript. It
resolves after the initial source is compiled and rejects if the element disconnects first. The
controller supports grouped origins through `registerOrigin(ids, origin)` and host overlay registration.
For a trigger that represents another gallery item, set `lightbox.openItemId` to that item's id.
The trigger keeps its own `item-id`; pointer preparation and clicks open the override. If a host
updates the preview image to match the selection, mark its `<picture>` or other preview container
with `data-fluidbox-dynamic-preview` so changes inside the preview, including traveling overlay
mounts and image attributes, do not rebuild the gallery source.
Use `hide-close-button` on `<fluidbox-gallery>` to omit its default close control.

## State

The lightbox root, overlay, and dialog expose `data-fluidbox-state="closed|opening|open|closing"`. They also expose presence-based `[data-open]`, `[data-closed]`, `[data-starting-style]`, and `[data-ending-style]` hooks. The dialog adds state such as `[data-dragging]`, `[data-dismissing]`, `[data-zoomed]`, `[data-fluidbox-gallery]`, and `[data-filmstrip]`.

Transition layers expose `data-fluidbox-phase="preview|opening|open|dragging|closing"`. Gallery slides use `aria-hidden`, and filmstrip items use `aria-selected`, so CSS does not need private implementation state.

## Customize the viewer

Import the package CSS first, then put your overrides in a later stylesheet. The package roots its viewer rules at `[data-fluidbox-overlay]` or `[data-fluidbox-flight]`. Descendant rules use a zero-specificity `:where(...)` root, so a later rule with the same part selector can override a default without extra selector weight.

```css
/* The runtime copies these six computed values onto the body-level overlay. */
fluidbox-item {
  --background: #171717;
  --color: #fff;
  --accent: #353535;
  --primary: #e8c66d;
  --border: #e8c66d;
  --radius: 8px;
  --fluidbox-preview-width: 18rem;
}

/* Other portal values must inherit from :root or be set on the portal. */
[data-fluidbox-overlay] {
  --fluidbox-filmstrip-dock-background: #171717cc;
}

[data-fluidbox-overlay] [data-fluidbox-close] {
  width: 40px;
  height: 40px;
}
```

The runtime reads the computed `--background`, `--color`, `--accent`, `--primary`, `--border`, and `--radius` from the opening `fluidbox-item` and copies them to the overlay's inline style. These are the host's theme inputs, including values it inherits from its ancestors. The overlay's backdrop and controls use the copied values. Other variables on `fluidbox-item` do not inherit into the body-level portal. Set those on `:root` or the portal root if the open viewer needs them.

`--layer-fluidbox` and `--layer-fluidbox-flight` set the overlay and flight stacking levels. `--fluidbox-preview-width`, `--fluidbox-preview-height`, and `--fluidbox-preview-aspect` affect the closed preview. The filmstrip reads `--fluidbox-filmstrip-dock-background`, `--fluidbox-filmstrip-zoom-duration`, and `--fluidbox-filmstrip-zoom-travel`.

State selectors such as `[data-fluidbox-state="open"]`, `[data-zoomed]`, and `[aria-selected="true"]` can refine those rules. The package selectors keep their original specificity where the overlay or flight root itself is styled. Source order resolves equal-specificity rules, so load your overrides after the package CSS.

## Runtime-owned motion variables

JavaScript writes measurements and motion state as custom properties. A custom stylesheet can read them to synchronize its own effects. The values below belong to the runtime. Do not set them to fixed values on generated parts: inline values or Web Animations control the active pose.

| Variable                                                                                                                     | Published on                                                       | Value and lifetime                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--fluidbox-progress`                                                                                                        | Transition layer and detached `[data-fluidbox-transition-content]` | Unitless. `1` at the preview pose, `0` at the open pose. It inherits into their children. The runtime registers it as an animatable number when supported. |
| `--fluidbox-dismiss-progress`                                                                                                | Overlay                                                            | Unitless `0` to `1` during pointer dismissal, capped at `0.6` for wheel dismissal; removed when the gesture settles.                                       |
| `--fluidbox-drag-x`, `--fluidbox-drag-y`                                                                                     | Overlay                                                            | Drag displacement in pixels during a gesture; removed when it settles.                                                                                     |
| `--fluidbox-frame-transform`, `--fluidbox-frame-radius`                                                                      | Frame                                                              | CSS transform and border-radius values for the crop pose.                                                                                                  |
| `--fluidbox-media-transform`                                                                                                 | Media                                                              | CSS transform for the media pose, also updated by zoom.                                                                                                    |
| `--fluidbox-backdrop-opacity`, `--fluidbox-close-opacity`                                                                    | Backdrop and close control                                         | Unitless opacity values written during interactive dismissal.                                                                                              |
| `--fluidbox-transition-top`, `--fluidbox-transition-left`, `--fluidbox-transition-width`, `--fluidbox-transition-height`     | Detached transition content                                        | Pixel bounds of the content plane while it is mounted.                                                                                                     |
| `--fluidbox-item-width`, `--fluidbox-item-height`                                                                            | Gallery item frame                                                 | CSS lengths constrained to the viewport.                                                                                                                   |
| `--fluidbox-zoom-canvas-width`, `--fluidbox-zoom-canvas-height`, `--fluidbox-zoom-anchor-top`, `--fluidbox-zoom-anchor-left` | Zoom canvas and anchor                                             | Pixel geometry while zoom is active.                                                                                                                       |

Transform properties describe the engine's pose, but their inline values do not necessarily change on every animation frame. Web Animations can interpolate transforms directly. For a continuous authored effect during dragging, read the overlay's gesture values on an overlay descendant:

```css
[data-fluidbox-overlay] [data-fluidbox-close] {
  rotate: calc(var(--fluidbox-dismiss-progress, 0) * 30deg);
}
```

The authored transition layer can supply presentation values that the runtime copies when it moves content to the body:

```css
.video-gallery [data-fluidbox-transition-layer] {
  --fluidbox-transition-layer-opacity: 1;
  --fluidbox-transition-content-opacity: 1;
}
```

The component may use Web Animations for compositor motion. The package CSS supplies the current geometry and default controls; a replacement stylesheet must provide its own layout for the portal, frame, and controls.
