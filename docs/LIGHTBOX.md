# Lightbox styling contract

`@ogdakke/fluidbox/elements` registers the custom elements without installing CSS. Import `@ogdakke/fluidbox/styles.css` explicitly for the current viewer styling. The runtime exposes DOM parts, state attributes, and live CSS variables for theming.

## Authoring content

Use `slot="trigger"` for the closed preview and `slot="content"` for the open content. A template keeps the content out of the page layout; `data-src` and `data-srcset` defer its full-size requests until opening. A live element keeps interactive state and moves into the overlay while open.

```html
<app-lightbox aria-label="Mountain photo" close-button>
  <button slot="trigger" type="button">
    <img src="/media/mountain-768w.webp" alt="Mountain" width="768" height="512" />
  </button>
  <template slot="content">
    <picture width="1536" height="1024">
      <source
        type="image/avif"
        data-srcset="/media/mountain-768w.avif 768w, /media/mountain.avif 1536w"
        sizes="100vw"
      />
      <source
        type="image/webp"
        data-srcset="/media/mountain-768w.webp 768w, /media/mountain.webp 1536w"
        sizes="100vw"
      />
      <img data-src="/media/mountain.webp" src="/media/mountain-768w.webp" alt="Mountain" />
    </picture>
  </template>
</app-lightbox>
```

The component animates from the trigger's decoded image to the open frame, then reveals content after its image decodes. Content can also be a live section with text and controls. The older `src` attribute and `template[data-lightbox-content]` remain supported.

## Parts

Every generated part has a stable data selector. The runtime does not generate class names.

| Selector                             | Part                                             |
| ------------------------------------ | ------------------------------------------------ |
| `[data-lightbox-trigger]`            | Element that opens the lightbox                  |
| `[data-lightbox-preview]`            | Optional preview box used for handoff geometry   |
| `[data-lightbox-target]`             | Preferred handoff target inside a custom preview |
| `[data-lightbox-overlay]`            | Body-level portal root                           |
| `[data-lightbox-container]`          | Gesture and layout container                     |
| `[data-lightbox-backdrop]`           | Modal backdrop                                   |
| `[data-lightbox-dialog]`             | Accessible dialog                                |
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

Zoom, error, status, thumbnail, and preview-proxy parts follow the same `data-lightbox-*` naming.

For a plain image lightbox, the image itself supplies the handoff geometry. A custom trigger can
mark its visual box with `data-lightbox-preview`. If that box contains a more precise transition
target, mark the nested element with `data-lightbox-target`; it takes precedence over the preview
box. `data-lightbox-thumbnail` remains the optional image source for loading and filmstrip artwork.

## State

The lightbox root, overlay, and dialog expose `data-lightbox-state="closed|opening|open|closing"`. They also expose presence-based `[data-open]`, `[data-closed]`, `[data-starting-style]`, and `[data-ending-style]` hooks. The dialog adds state such as `[data-dragging]`, `[data-dismissing]`, `[data-zoomed]`, `[data-lightbox-gallery]`, and `[data-filmstrip]`.

Transition layers expose `data-lightbox-phase="preview|opening|open|dragging|closing"`. Gallery slides use `aria-hidden`, and filmstrip items use `aria-selected`, so CSS does not need private implementation state.

## Live variables

JavaScript writes measurements and motion state as custom properties. CSS decides how those values affect presentation.

| Variable                                                  | Meaning                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `--lightbox-progress`                                     | `1` at the closed preview pose, `0` when fully open                          |
| `--lightbox-dismiss-progress`                             | `0` when open, increasing toward dismissal                                   |
| `--lightbox-drag-x`, `--lightbox-drag-y`                  | Current drag displacement                                                    |
| `--lightbox-frame-transform`, `--lightbox-frame-radius`   | Current crop frame pose                                                      |
| `--lightbox-media-transform`                              | Current media pose                                                           |
| `--lightbox-backdrop-opacity`, `--lightbox-close-opacity` | Values supplied during interactive dismissal                                 |
| `--lightbox-transition-*`                                 | Detached content bounds, transform, counter-transform, and opacity overrides |
| `--lightbox-item-width`, `--lightbox-item-height`         | Natural gallery item dimensions constrained to the viewport                  |
| `--lightbox-zoom-*`                                       | Zoom canvas, anchor, placeholder, and scroll measurements                    |

For example, a gallery can keep its transition plane opaque without changing the component:

```css
.video-gallery [data-lightbox-transition-layer] {
  --lightbox-transition-layer-opacity: 1;
  --lightbox-transition-content-opacity: 1;
}
```

The component may use Web Animations for compositor motion, but it does not install visual defaults. Consumers may replace `lightbox.css`, override any part selector, or map the live variables to different effects.
