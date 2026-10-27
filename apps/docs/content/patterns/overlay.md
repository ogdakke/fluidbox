---
title: One trigger for an album
section: Patterns
order: 2
description: Several items behind one thumbnail that shows the last one viewed, with a count that flies with the photo.
---

# One trigger for an album

One thumbnail stands for a whole album. Its `value` is the list of the album's items: it opens the first, and every one of them closes back onto it. It shows whichever item the viewer showed last, so the closing flight lands on a matching picture.

<!-- pattern: overlay -->

- **A list as the value.** Pass the items, or their ids, as the trigger's `value`: on the framework `Trigger`, as `[fluidboxTrigger]` in Angular, to `fluidbox.bind(cover, album)`, or as `value="id id …"` on a `<fluidbox-item>` (`data-fluidbox-value` on a button). The first opens; every one closes back onto this trigger.
- **The preview follows the selection.** The framework triggers hand their content the item they show (`{ item, index, status }`); Angular reads it from `trigger.preview()`. Plain JavaScript gets `onPreviewChange(item, index)` in `bind`'s options. On custom elements, the `<fluidbox-item>` dispatches `fluidbox-preview-change` with `{ id, item }`, and you swap the trigger's image in its handler. The preview changes before the closing flight measures the trigger.
- **Overlays.** A badge or caption on the thumbnail is an `Overlay` part (`fluidboxOverlay` in Angular, `fluidbox.bindOverlay()` in plain JavaScript, `data-fluidbox-trigger-overlay` in markup). Its `flight` says how it goes with the photo:
  - `"none"`, the default, stays on the card and gets `--fluidbox-closed` to animate against;
  - `"copy"` flies a still copy of it and fades it on landing;
  - `"live"` renders its content live in the flying frame (in plain JavaScript, `flight: { live: render }`);
  - `"frame"` moves the element itself into the flying frame, where it scales with the photo, as a scrim does.

  A trigger can have several, such as a `"frame"` scrim beside a `"live"` count.
