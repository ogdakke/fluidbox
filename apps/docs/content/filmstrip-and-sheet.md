---
title: Filmstrip and sheet
section: Guides
order: 6
---

# Filmstrip and sheet

Two optional pieces ship as their own entries, so their code loads only when you import them. Pass each one to `createLightbox`, or to `Lightbox.Root` in React.

```ts
import { createLightbox } from "@ogdakke/fluidbox";
import { filmstrip } from "@ogdakke/fluidbox/filmstrip";
import { sheet } from "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/sheet.css";

const details = sheet();
const viewer = createLightbox({ source, filmstrip: filmstrip(), sheet: details });
```

## Filmstrip

`filmstrip()` docks a scrubbable row of thumbnails along the bottom of the viewer when the source has more than one item. Tapping a thumbnail moves to it, and the strip follows swipes, arrow keys and `goTo`. It keeps itself in step when you call `setSource`. Its styles are in `styles.css`.

Each thumbnail is a `button` with `data-lightbox-filmstrip-item` and `data-index`, inside a listbox labelled "Gallery filmstrip". The dialog gets `data-filmstrip` while a strip is docked. To draw your own thumbnails, pass `renderItem`:

```ts
filmstrip({
  renderItem({ item, target, signal }) {
    target.textContent = item.id;
  },
});
```

In React, `Lightbox.Filmstrip` renders the same strip as a component.

## Sheet

`sheet()` adds a panel that rises over the photo, as the replies on X and the comments on Instagram do on a phone. Swipe or scroll up to raise it and down to lower it. The photo fits into the room left above the sheet.

The sheet rests at one of three stops:

| Stop    | Sheet                                                               |
| ------- | ------------------------------------------------------------------- |
| `photo` | Tucked away, or peeking by `--lightbox-sheet-peek`.                 |
| `info`  | Its content's height, up to `--lightbox-sheet-max-height`.          |
| `full`  | Near the top, when the content is taller than the info stop allows. |

Render your own element with `data-lightbox-sheet` into the portal, or pass `render` and the runtime makes one for you and fills it for each item:

```ts
const details = sheet({
  render({ item, target }) {
    target.textContent = item.media.type === "image" ? item.media.alt : item.media.title;
  },
  onChange(stop) {
    console.log("sheet at", stop);
  },
});
```

Give any element `data-lightbox-sheet-stop="info"` or `"full"` to make it raise the sheet when clicked, such as a reply count or a "View all comments" link. Escape, a tap above the sheet and the close button lower it before they close the viewer. Drive it from code with `details.set("full")`, read `details.stop`, and `details.subscribe(listener)` to follow it.

A `data-lightbox-sheet-handle` element inside the sheet draws a grab bar.

### React

Pass the sheet to `Lightbox.Root` and read its stop with `useLightboxSheet`, for example to set `aria-expanded` on a trigger:

```tsx
import { Lightbox, useLightboxSheet } from "@ogdakke/fluidbox/react";
import { sheet } from "@ogdakke/fluidbox/sheet";

function Viewer() {
  const replies = useMemo(() => sheet(), []);
  const stop = useLightboxSheet(replies);
  return (
    <Lightbox.Root source={source} sheet={replies}>
      {/* triggers and items */}
      <Lightbox.Portal>
        <Lightbox.Content />
        <button data-lightbox-sheet-stop="info" aria-expanded={stop !== "photo"}>
          Replies
        </button>
        <section data-lightbox-sheet data-lightbox-chrome aria-label="Replies">
          <div data-lightbox-sheet-handle />
          {/* replies */}
        </section>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
```

### Styling the sheet

Set these on the dialog. The runtime reads the first five, so they can change with a media query.

| Variable                                                         | Default            | Effect                                                         |
| ---------------------------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| `--lightbox-sheet-enabled`                                       | `1`                | `0` turns the sheet off, as for a wide screen with a sidebar.  |
| `--lightbox-sheet-photo`                                         | `fit`              | `fit` shrinks the photo into the room above; `push` slides it. |
| `--lightbox-sheet-peek`                                          | `0px`              | How much of the sheet shows at the photo stop.                 |
| `--lightbox-sheet-gap`                                           | `12px`             | Space between the photo and the sheet.                         |
| `--lightbox-sheet-max-height`                                    | `60svh`            | The info stop's height.                                        |
| `--lightbox-sheet-top`                                           | safe area + `56px` | Space above the sheet at the full stop.                        |
| `--lightbox-sheet-fade`                                          | `1`                | `0` keeps the photo showing behind the sheet at the full stop. |
| `--lightbox-sheet-radius`, `-max-width`, `-background`, `-color` |                    | The panel's look.                                              |

While it moves, the dialog publishes `--lightbox-sheet-visible` (pixels showing), `--lightbox-sheet-progress` (`0` at photo, `1` at info) and `--lightbox-sheet-expand` (`0` at info, `1` at full), and sets `data-sheet` to the current stop. Use them to fade a caption as the sheet rises:

```css
.caption {
  opacity: clamp(0, 1 - var(--lightbox-sheet-progress) * 2.5, 1);
}

@media (min-width: 900px) {
  [data-lightbox-dialog]:has(.replies) {
    --lightbox-sheet-enabled: 0;
    --lightbox-stage-right: 350px;
  }
}
```

The [social viewers example](https://fluidbox.local/social.html) builds X's and Instagram's viewers this way: a reply sidebar on a wide screen, and a replies sheet and a peeking caption on a phone.
