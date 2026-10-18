# Lightbox styling contract

`@ogdakke/fluidbox/elements` registers the custom elements without installing CSS. Import `@ogdakke/fluidbox/styles.css` explicitly for the current viewer styling. Style the viewer through its data attributes and CSS variables. The stylesheet does not require CSS `@scope`.

## Authoring content

Every `<app-lightbox>` requires a stable `item-id`, one trigger, and one inert content template. The gallery compiles this markup into the same `LightboxItem` model used by `createLightbox()`. Standard `src`, `srcset`, `sizes`, `type`, and `media` attributes pass through to the generated viewer `<picture>`.

```html
<app-gallery aria-label="Photos">
  <app-lightbox item-id="mountain">
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
  </app-lightbox>
  <app-filmstrip></app-filmstrip>
</app-gallery>
```

The template is inert, so full-size resources do not load while the gallery is closed. `<app-gallery>` owns one `createLightbox()` controller. `<app-lightbox>` only describes an item and its transition origin. Non-image template content uses the core custom-media renderer and is cloned into the bounded slide window.

For image items, set `placeholder-src` on `<app-lightbox>` to a small data URL or other immediately
available image. The runtime paints it behind the slide's preview and full image, including adjacent
slides during a swipe. The full image only covers it after decoding.

## Parts

The main viewer parts have data selectors. The runtime does not generate class names. The body-level overlay and flight layer are separate from `app-lightbox`, so selectors for open viewer parts should start at `[data-lightbox-overlay]` or `[data-lightbox-flight]`, not at the host element.

| Selector                             | Part                                             |
| ------------------------------------ | ------------------------------------------------ |
| `[data-lightbox-trigger]`            | Element that opens the lightbox                  |
| `[data-lightbox-preview]`            | Optional preview box used for handoff geometry   |
| `[data-lightbox-target]`             | Preferred handoff target inside a custom preview |
| `[data-lightbox-overlay]`            | Body-level portal root                           |
| `[data-lightbox-container]`          | Gesture and layout container                     |
| `[data-lightbox-backdrop]`           | Modal backdrop                                   |
| `[data-lightbox-dialog]`             | Accessible dialog                                |
| `[data-lightbox-portal]`             | Application controls and caption mount target    |
| `[data-lightbox-slides]`             | Native horizontal gallery scroller               |
| `[data-lightbox-slide]`              | Gallery item                                     |
| `[data-lightbox-frame]`              | Cropping and radius frame                        |
| `[data-lightbox-media]`              | Image media element                              |
| `[data-lightbox-content]`            | Arbitrary standalone content wrapper             |
| `[data-lightbox-item-content]`       | Arbitrary gallery item                           |
| `[data-lightbox-close]`              | Close control                                    |
| `[data-lightbox-filmstrip]`          | Filmstrip root                                   |
| `[data-lightbox-filmstrip-scroll]`   | Filmstrip scroller                               |
| `[data-lightbox-filmstrip-item]`     | Filmstrip option                                 |
| `[data-lightbox-transition-layer]`   | Authored content that travels with an item       |
| `[data-lightbox-transition-content]` | Portalled transition content plane               |

The runtime also marks zoom, error, status, thumbnail, and preview-proxy elements with `data-lightbox-*` attributes. Treat these as implementation details unless listed above or below.

For a plain image lightbox, the image itself supplies the handoff geometry. A custom trigger can
mark its visual box with `data-lightbox-preview`. If that box contains a more precise transition
target, mark the nested element with `data-lightbox-target`; it takes precedence over the preview
box. `data-lightbox-thumbnail` remains the optional image source for loading and filmstrip artwork.

An indexed gallery assigns a canonical `LightboxSource` to `gallery.source` and a `LightboxOriginAdapter` to `gallery.origins`. Mark a mounted trigger's visible clipped box with `data-lightbox-origin`. The descendant image remains the media preview even when a wrapper supplies geometry and corner radius. A virtualized host can implement `revealOrigin(id, index, { signal, reason })`. Viewer motion never waits for it, and the runtime aborts stale reveals on selection, close, source replacement, and teardown.

Call `await gallery.whenReady()` before using `gallery.controller` from application JavaScript. It
resolves after the initial source is compiled and rejects if the element disconnects first. The
controller supports grouped origins through `registerOrigin(ids, origin)` and host overlay registration.
For a trigger that represents another gallery item, set `lightbox.openItemId` to that item's id.
The trigger keeps its own `item-id`; pointer preparation and clicks open the override. If a host
updates the preview image to match the selection, mark its `<picture>` or other preview container
with `data-lightbox-dynamic-preview` so changes inside the preview, including traveling overlay
mounts and image attributes, do not rebuild the gallery source.
Use `hide-close-button` on `<app-gallery>` to omit its default close control.

## State

The lightbox root, overlay, and dialog expose `data-lightbox-state="closed|opening|open|closing"`. They also expose presence-based `[data-open]`, `[data-closed]`, `[data-starting-style]`, and `[data-ending-style]` hooks. The dialog adds state such as `[data-dragging]`, `[data-dismissing]`, `[data-zoomed]`, `[data-lightbox-gallery]`, and `[data-filmstrip]`.

Transition layers expose `data-lightbox-phase="preview|opening|open|dragging|closing"`. Gallery slides use `aria-hidden`, and filmstrip items use `aria-selected`, so CSS does not need private implementation state.

## Customize the viewer

Import the package CSS first, then put your overrides in a later stylesheet. The package roots its viewer rules at `[data-lightbox-overlay]` or `[data-lightbox-flight]`. Descendant rules use a zero-specificity `:where(...)` root, so a later rule with the same part selector can override a default without extra selector weight.

```css
/* The runtime copies these six computed values onto the body-level overlay. */
app-lightbox {
  --background: #171717;
  --color: #fff;
  --accent: #353535;
  --primary: #e8c66d;
  --border: #e8c66d;
  --radius: 8px;
  --lightbox-preview-width: 18rem;
}

/* Other portal values must inherit from :root or be set on the portal. */
[data-lightbox-overlay] {
  --lightbox-filmstrip-dock-background: #171717cc;
}

[data-lightbox-overlay] [data-lightbox-close] {
  width: 40px;
  height: 40px;
}
```

The runtime reads the computed `--background`, `--color`, `--accent`, `--primary`, `--border`, and `--radius` from the opening `app-lightbox` and copies them to the overlay's inline style. These are the host's theme inputs, including values it inherits from its ancestors. The overlay's backdrop and controls use the copied values. Other variables on `app-lightbox` do not inherit into the body-level portal. Set those on `:root` or the portal root if the open viewer needs them.

`--layer-lightbox` and `--layer-lightbox-flight` set the overlay and flight stacking levels. `--lightbox-preview-width`, `--lightbox-preview-height`, and `--lightbox-preview-aspect` affect the closed preview. The filmstrip reads `--lightbox-filmstrip-dock-background`, `--lightbox-filmstrip-zoom-duration`, and `--lightbox-filmstrip-zoom-travel`.

State selectors such as `[data-lightbox-state="open"]`, `[data-zoomed]`, and `[aria-selected="true"]` can refine those rules. The package selectors keep their original specificity where the overlay or flight root itself is styled. Source order resolves equal-specificity rules, so load your overrides after the package CSS.

## Runtime-owned motion variables

JavaScript writes measurements and motion state as custom properties. A custom stylesheet can read them to synchronize its own effects. The values below belong to the runtime. Do not set them to fixed values on generated parts: inline values or Web Animations control the active pose.

| Variable                                                                                                                     | Published on                                                       | Value and lifetime                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--lightbox-progress`                                                                                                        | Transition layer and detached `[data-lightbox-transition-content]` | Unitless. `1` at the preview pose, `0` at the open pose. It inherits into their children. The runtime registers it as an animatable number when supported. |
| `--lightbox-dismiss-progress`                                                                                                | Overlay                                                            | Unitless `0` to `1` during pointer dismissal, capped at `0.6` for wheel dismissal; removed when the gesture settles.                                       |
| `--lightbox-drag-x`, `--lightbox-drag-y`                                                                                     | Overlay                                                            | Drag displacement in pixels during a gesture; removed when it settles.                                                                                     |
| `--lightbox-frame-transform`, `--lightbox-frame-radius`                                                                      | Frame                                                              | CSS transform and border-radius values for the crop pose.                                                                                                  |
| `--lightbox-media-transform`                                                                                                 | Media                                                              | CSS transform for the media pose, also updated by zoom.                                                                                                    |
| `--lightbox-backdrop-opacity`, `--lightbox-close-opacity`                                                                    | Backdrop and close control                                         | Unitless opacity values written during interactive dismissal.                                                                                              |
| `--lightbox-transition-top`, `--lightbox-transition-left`, `--lightbox-transition-width`, `--lightbox-transition-height`     | Detached transition content                                        | Pixel bounds of the content plane while it is mounted.                                                                                                     |
| `--lightbox-item-width`, `--lightbox-item-height`                                                                            | Gallery item frame                                                 | CSS lengths constrained to the viewport.                                                                                                                   |
| `--lightbox-zoom-canvas-width`, `--lightbox-zoom-canvas-height`, `--lightbox-zoom-anchor-top`, `--lightbox-zoom-anchor-left` | Zoom canvas and anchor                                             | Pixel geometry while zoom is active.                                                                                                                       |

Transform properties describe the engine's pose, but their inline values do not necessarily change on every animation frame. Web Animations can interpolate transforms directly. For a continuous authored effect during dragging, read the overlay's gesture values on an overlay descendant:

```css
[data-lightbox-overlay] [data-lightbox-close] {
  rotate: calc(var(--lightbox-dismiss-progress, 0) * 30deg);
}
```

The authored transition layer can supply presentation values that the runtime copies when it moves content to the body:

```css
.video-gallery [data-lightbox-transition-layer] {
  --lightbox-transition-layer-opacity: 1;
  --lightbox-transition-content-opacity: 1;
}
```

The component may use Web Animations for compositor motion. The package CSS supplies the current geometry and default controls; a replacement stylesheet must provide its own layout for the portal, frame, and controls.
