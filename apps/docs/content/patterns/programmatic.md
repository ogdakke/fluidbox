---
title: Programmatic control
section: Patterns
order: 6
description: Open from code, read the state, log events, and veto navigation.
---

# Programmatic control

The fluidbox opens, moves and closes the viewer from code. Its state tells you what is open, and events tell you what changed and why.

<!-- pattern: programmatic -->

- **Commands.** `open(target)`, `next()`, `previous()` and `close()` return a promise that resolves `true` when the command happened and `false` when it didn't. A target is an index or an id: `open(2)`, `open("photo-fjord")`. While open, `open` moves to the item.
- **State.** `status` (`closed`, `opening`, `open`, `closing`), `id`, `index`, `item`, `count`, `hasPrevious` and `hasNext`. Read it with `useFluidbox()` in the frameworks, `gallery.state` and `gallery.subscribe()` on custom elements, or `fluidbox.state` and `fluidbox.subscribe()` in plain JavaScript.
- **Events.** `beforetoggle` and `toggle` as the viewer opens and closes, like a popover's; `beforeitemchange`, `itemchange` and `settle` as it moves between items. Each has a `reason`: `"keyboard"`, `"pointer"`, `"trigger"`, `"api"` and so on. The framework roots take them as event props.
- **Veto.** `beforetoggle` and `beforeitemchange` fire before every command, whether it comes from a key, a gesture or your code. Call `event.preventDefault()` to cancel it.
