---
title: Photo in the address
section: Patterns
order: 12
description: Keep the open photo in the address, so a link opens it and Back closes it.
---

# Photo in the address

The viewer can follow your state instead of its triggers. Pass `open` and `index`, and it opens, moves and closes as they change. Clicks, swipes and keys still work straight away, and the change callbacks tell your state what happened. Here that state is `?photo=` in the address.

<!-- pattern: url -->

- Opening pushes a history entry and moving replaces it, so Back closes the viewer and Forward opens it again on the same photo. Push on every move instead if you want Back to step through the photos.
- A link with `?photo=2` opens the second photo when the page loads, flying from its thumbnail.
- The viewer ignores an `index` out of range, so a stale link opens nothing.
- The callbacks fire for every input, the viewer's own buttons and keys included. In React, Solid and Vue each one also gets a `reason`: `"trigger"`, `"keyboard"`, `"pointer"`, `"wheel"`, `"api"` or `"items"`.
- Leave `open` out and the triggers own it again. Pass only `index` to steer an open viewer from outside, as a carousel beside it would.
- Each version reads the address after the first render, in an effect, `onMount`, `onMounted` or `afterNextRender`. The server has no `location`, and its HTML then matches the browser's first render, with the viewer closed. Server-rendered pages, [Next.js](../nextjs.md) among them, take the pattern as it is.
