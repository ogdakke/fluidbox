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

`sheet()` adds a panel that rises over the photo, as the replies on X and the comments on Instagram do on a phone. The photo and the sheet share one native scroller with a snap point per stop, so swipes, momentum and rubber-banding are the browser's own. Scroll-driven animations fit the photo into the room left above the sheet, so no script runs while it moves.

Stop `0` is the sheet at rest: away below the screen, or peeking by `--lightbox-sheet-peek`. Each snap point adds a stop above it, lowest first:

```ts
const replies = sheet({
  // Pixels, a percentage of the viewer's height, or "content" for the sheet's own height.
  snapPoints: ["62%", "100%"],
  // A swipe down on the resting photo: "flight" flies it home, "scroll" scrolls
  // it off the bottom and closes, "none" keeps the viewer open.
  dismiss: "flight",
  onChange(stop) {
    console.log("sheet at", stop);
  },
});
```

The default is `["60%", "content"]` with the `"flight"` dismiss. A stop set in pixels or percent is always reachable: the sheet stretches to it when its content is shorter. A `"content"` stop follows the content, so with little content it sits lower and the space above it shows. With `dismiss: "flight"`, a second flick down while the sheet is still lowering goes straight into the flight.

Render your own element with `data-lightbox-sheet` into `replies.slot`, or pass `render` and the runtime makes one and fills it for each item:

```ts
sheet({
  render({ item, target }) {
    target.textContent = item.media.type === "image" ? item.media.alt : item.media.title;
  },
});
```

Inside the sheet:

| Attribute                    | Effect                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `data-lightbox-sheet-handle` | Draws a grab bar.                                                                           |
| `data-lightbox-sheet-scroll` | The part that scrolls once the sheet is at its top stop. Without one, the whole sheet does. |

Below the top stop a swipe anywhere on the sheet moves the sheet; at the top, its content scrolls, and a pull down from the top of the content carries on into the sheet, as React Aria's sheet does.

Give any element `data-lightbox-sheet-stop="1"` to raise the sheet to that stop when clicked, such as a reply count or a "View all comments" link. Clicking it again at that stop lowers the sheet. The runtime keeps `aria-expanded` on these triggers and moves focus into the sheet once it settles. Escape, a tap above the sheet and the close button lower it before they close the viewer. Drive it from code with `replies.set(2)`, read `replies.stop`, and `replies.subscribe(listener)` to follow it. The dialog also dispatches `lightbox-sheet-change` with `detail.stop`.

### Text fields and the keyboard

A text field in the sheet works as it does in React Aria's sheet. A tap focuses the field without letting Safari pan the screen. The sheet pads its bottom by the part the keyboard covers, so its end can be brought above the keyboard. Once the keyboard is open, the field scrolls into view inside the sheet. When the sheet starts down, focus leaves the field, so the keyboard goes as the sheet does.

### Why the viewer owns the sheet

A drawer library on top of the viewer would bring a second gesture system that fights the viewer's dismiss and zoom, and couldn't fit the photo to the sheet as it moves. The sheet is the viewer's own scroller instead, so the browser moves the photo and the sheet together. Script runs only to measure, to record the stop when a scroll ends, and for the flight.

### React

Pass the sheet to `Lightbox.Root` and render its content with `Lightbox.Sheet`, which portals into the slot. `useLightboxSheet` returns the current stop:

```tsx
import { Lightbox, useLightboxSheet } from "@ogdakke/fluidbox/react";
import { sheet } from "@ogdakke/fluidbox/sheet";

function Viewer() {
  const replies = useMemo(() => sheet({ snapPoints: ["62%", "100%"] }), []);
  const stop = useLightboxSheet(replies);
  return (
    <Lightbox.Root source={source} sheet={replies}>
      {/* triggers and items */}
      <Lightbox.Portal>
        <Lightbox.Content />
        <button data-lightbox-sheet-stop="1">Replies</button>
      </Lightbox.Portal>
      <Lightbox.Sheet sheet={replies}>
        <section data-lightbox-sheet data-lightbox-chrome aria-label="Replies">
          <div data-lightbox-sheet-handle />
          <ul data-lightbox-sheet-scroll>{/* replies */}</ul>
          <ReplyForm />
        </section>
      </Lightbox.Sheet>
    </Lightbox.Root>
  );
}
```

### Styling the sheet

Set these on the dialog. The runtime reads the first five, so they can change with a media query.

| Variable                                                         | Default            | Effect                                                            |
| ---------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `--lightbox-sheet-enabled`                                       | `1`                | `0` turns the sheet off, as for a wide screen with a sidebar.     |
| `--lightbox-sheet-photo`                                         | `fit`              | `fit` shrinks the photo into the room above; `push` slides it up. |
| `--lightbox-sheet-peek`                                          | `0px`              | How much of the sheet shows at rest.                              |
| `--lightbox-sheet-gap`                                           | `12px`             | Space between the photo and the sheet.                            |
| `--lightbox-sheet-fit-limit`                                     | `55%`              | How much the sheet covers before a fitting photo rises instead.   |
| `--lightbox-sheet-top`                                           | safe area + `56px` | Space above the sheet at its tallest.                             |
| `--lightbox-sheet-fade`                                          | `1`                | `0` keeps the photo showing behind the sheet at the top stop.     |
| `--lightbox-sheet-radius`, `-max-width`, `-background`, `-color` |                    | The panel's look.                                                 |

As it scrolls, the dialog's state properties follow on the compositor:

| Property                    | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `--lightbox-sheet-visible`  | Pixels of the sheet showing.                                     |
| `--lightbox-sheet-progress` | `0` at rest to `1` at the first stop.                            |
| `--lightbox-sheet-expand`   | `0` at the first stop to `1` at the last.                        |
| `--lightbox-sheet-dismiss`  | `0` at rest to `1` with the photo scrolled away, for `"scroll"`. |

The dialog also gets `data-sheet` with the stop number, `data-sheet-raised` above stop 0 and `data-sheet-expanded` at the top stop. Use them to fade a caption as the sheet rises:

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

The [social viewers example](https://fluidbox.local/social.html) builds X's and Instagram's viewers this way: a reply sidebar on a wide screen, and a replies sheet and a peeking caption on a phone. It also has React Aria's Sheet with the same replies, to compare.
