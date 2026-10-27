---
title: Programmatic control
section: Patterns
order: 6
description: Open from code, read the state, log value changes, and cancel moves.
---

# Programmatic control

The fluidbox opens, moves and closes the viewer from code. Its state tells you what is on show, and one value-change event tells you what is about to change, why, and lets you cancel it.

<!-- pattern: programmatic -->

- **Commands.** `open(target)`, `next()`, `previous()` and `close()` return a promise that resolves `true` once the command happened and its motion settled, and `false` when it was cancelled or had nothing to do. A target is an index, an id or the item: `open(2)`, `open("photo-fjord")`. While open, `open` moves to the item.
- **State.** `status` (`closed`, `opening`, `open`, `closing`), `value` (the id on show), `index`, `item`, `count`, `hasPrevious` and `hasNext`, with `zoom`, `fullscreen` and `playing`. Read it with `useFluidbox()` in React and Solid, the Root's slot in Vue, `#fb="fluidbox"` or `injectFluidbox()` in Angular, and `state` with `subscribe()` on a fluidbox or a `<fluidbox-gallery>`.
- **Value changes.** `beforevaluechange` comes before every open, move and close, whether from a key, a gesture or your code. `valuechange` follows as the motion starts, and `valuechangecomplete` once it settles. Each has the new `value`, `index` and `item`, the `previousValue`, an `action` (`"open"`, `"move"` or `"close"`) and a `reason`: `"trigger"`, `"keyboard"`, `"pointer"`, `"wheel"`, `"api"`, `"items"` or `"slideshow"`.
- **Cancel.** Call `event.preventDefault()` on `beforevaluechange`, and the command resolves `false`. The framework roots call `onValueChange(value, details)` (`@value-change`, `(beforeValueChange)` in Angular) from the same event, and `details.cancel()` stops the change. The pattern cancels moves only, so the lock keeps Escape working.
