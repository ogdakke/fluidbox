---
title: Zoom
section: Patterns
order: 7
description: Set the zoom step and maximum, or turn zoom off.
---

# Zoom

Images zoom with pinch (or Ctrl + wheel), double-tap, double-click and the `+`, `-` and `0` keys, and pan while zoomed. Each viewer can set how far a double-tap zooms (`step`) and how far zoom goes (`max`), or turn zoom off.

<!-- pattern: zoom -->

- `zoom: { step, max }` or `zoom: false` on the viewer. The custom elements also read `zoom-step`, `zoom-max` and `zoom="off"` attributes.
- Changing zoom options rebuilds the viewer, so set them once. The framework roots compare `step` and `max`, so a new object with the same values keeps it.
- `step` defaults to `2` and `max` to `4`.
- While zoomed, the dialog has `data-zoomed`. Pans can reach under the browser's bars; set `--fluidbox-zoom-bleed: 0px` to keep them inside the window, or `--fluidbox-zoom-clip` to keep them inside the stage insets.
