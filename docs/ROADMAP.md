# Roadmap to 1.0

Where fluidbox stands, what gates 1.0, and what comes after it. The user-facing summary is
[Roadmap](../apps/docs/content/roadmap.md).

Fluidbox is a headless lightbox: one runtime owns the opening, closing, navigation, zoom and
media handoff across touch, trackpad, mouse and keyboard, and pages compose their own viewer on
it. The package draws no icons; the look is the opt-in `baseline.css`.

## Where the project stands

The package is private at `0.0.0`. The API redesign (`docs/API_SPEC.md`, `docs/api-spec/`) is in:

- One runtime behind `createFluidbox()`, SSR-safe at the root: items and lazy lists, triggers and
  origins, `slides` by item type with `FluidboxSlide`, the viewer's layer, the thumbnails and the
  sheet as add-ons, value changes with reasons, zoom with a sharper `zoom` image, full screen,
  download, share and media errors.
- Native bindings for React, Vue, Solid and Angular, built on the plain API and the binding kit
  (`@ogdakke/fluidbox/kit`), with composable parts. The custom elements are an adapter over the
  same runtime ([CUSTOM_ELEMENT_PARITY.md](CUSTOM_ELEMENT_PARITY.md)).
- The add-ons `embed`, `spin`, `model` (with live 3D thumbnails) and `hover-zoom`, each with parts
  in every binding and an elements entry where it has a slide.
- Plan step 7: `--fluidbox-motion-speed`, `reachend` with `withCount` for lists that grow, the
  slideshow (`play`, `pause`, `state.playing`, the Slideshow part) and hotspots
  (`slide.hotspot()`, the Hotspot part).
- 13 patterns in every framework, plain JavaScript and the elements, checked by
  `tests/browser/patterns.spec.ts`; bundle budgets in [baseline/bundle-budget.md](../baseline/bundle-budget.md).

Automated tests cover bounded DOM, navigation, interruption, crop and radius continuity, origins,
item replacement, loading failures, teardown, server rendering and the desktop and phone browser
profiles ([TESTING.md](TESTING.md)). They don't establish physical iOS or Android quality, bounded
decoded-image memory, or comparative performance.

## Interaction quality is a release contract

Assertions for the cases that distinguish this library. Settled screenshots are useful but are not motion tests.

| Scenario                                 | Required behavior and evidence                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grab or reverse an unfinished open/close | Continue from the painted pose without a position or scale jump. Assert timestamped geometry around interruption and retain motion recordings.                                                    |
| Dismiss, reverse, and release            | Preserve continuity through direction changes and settlement; avoid an abrupt velocity reset where the current interaction supports continuous handoff.                                           |
| Pinch to one-finger pan                  | Retain the focal point and pose when a finger lifts; do not restart the gesture from the fitted image.                                                                                            |
| Zoomed pan versus gallery navigation     | Define boundary ownership and prevent accidental item changes while the image owns the gesture.                                                                                                   |
| Trackpad and mouse wheel                 | Cover diagonal input, momentum tails, ctrl-wheel zoom, and line/pixel delta modes. Dismissal must not unintentionally transfer residual momentum into page scrolling.                             |
| Native slide-window rebase               | Cross boundaries in both directions, reverse rapidly, and jump far away without a blank frame or incorrect selection. Test animated motion on all supported engines, not only instant navigation. |
| Preview to decoded image                 | Keep geometry and zoom pose stable; retain a usable preview until replacement is ready.                                                                                                           |
| Recycled or missing origin               | Never animate to or focus an element now representing another item. Use the documented fallback transition and focus target.                                                                      |
| Viewport changes                         | Resize, rotate, and change mobile browser chrome while open or zoomed without stranding controls or losing the active item.                                                                       |
| Input cancellation and teardown          | Handle pointer cancellation, window blur, unmount, and destroy during any phase without stuck capture, inert background, or pending commands.                                                     |

Use deterministic geometry assertions for continuity, browser automation for state and input routing, and physical iOS Safari/Android Chrome plus desktop trackpad checks for native behavior. Record device, OS, browser, refresh rate, and scenario. Include 60 Hz and 120 Hz hardware where available. Emulated devices do not satisfy the physical-device gate.

Before setting numeric budgets, collect raw samples on a stable runner for 1, 1,000, 10,000, and 100,000 items, plus a realistic 12-image gallery on a slower phone. Measure cold/warm first useful paint, interaction frame gaps, decode/upgrade work, network requests, and repeated-session retention. Keep synchronous opening cost and DOM bounds as separate checks. Track initial import bytes and total viewer activation bytes, including required dependencies and behavior CSS.

The measurement work must check in the baseline report, measurement definitions, runner configuration, and calibrated regression thresholds. Until then, frame/latency budgets are explicitly unresolved rather than claimed to pass. Repeated interrupted sessions must be checked for retained media, listeners, observers, timers, animations, and background loading as well as DOM cleanup. Compare selected scenarios with other lightboxes using the same assets and devices before making public superiority claims.

## Accessibility and styling gates

Custom appearance must not remove dialog semantics, naming, focus handling, background inertness,
keyboard behaviour or reduced-motion support. Editing text or operating a native media or form
control must not trigger gallery shortcuts. Test Escape ownership, focus traversal, nested scroll
containers, open shadow roots, disabled and hidden controls, recycled-origin focus fallback and
teardown, with RTL, forced colours, reduced motion and screen reader announcements. Reduced motion
keeps state and event order, not only shorter animations. Two substantially different viewers built
from the same parts, with their own controls, captions and thumbnails placement, must pass the
interaction and accessibility checks without `baseline.css`.

## Before 1.0

| Work                 | Remaining                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protect interactions | Physical iPhone, Mac and Android results; calibrated cold-load, frame-gap, memory and repeated-session budgets.                                    |
| Docs and examples    | Plan step 6: every page on the new API, the patterns and `CONTRACT.md`, URL sync for each router.                                                  |
| Integration          | Adoption in `portfolio-v4`, feedback from an independent consumer, physical mixed-media checks.                                                    |
| Release              | Final names, license, browser matrix with tested versions ([BROWSER_SUPPORT.md](BROWSER_SUPPORT.md)), changelog, clean installs, release evidence. |

## Open decisions

1. Caller-selected focus fallback and origin discovery in open shadow roots. The fallback is the
   nearest focusable host.
2. Geometry when responsive art direction or new items change the aspect ratio while zoomed.

## After 1.0

- Deep zoom: `@ogdakke/fluidbox/deep-zoom`, with IIIF and DZI tiles on `onZoom` and
  `zoomable({ max, sharpen })`, and parts per framework.
- A Svelte binding.
- Lists of unknown length fetched page by page beyond `reachend`, persistent offscreen custom
  content, CDN URL adapters on demand, and a shadcn registry recipe that installs editable parts
  over the maintained runtime, never a copied gesture implementation.

## Framework references

Design references, not dependencies: [Kobalte's Solid dialog parts](https://kobalte.dev/docs/core/components/dialog/),
[Reka UI's Vue composition](https://www.reka-ui.com/docs/guides/composition),
[spartan/ui's Angular dialog and directives](https://www.spartan.ng/components/dialog) and
[shadcn's registry format](https://ui.shadcn.com/docs/registry/getting-started).
