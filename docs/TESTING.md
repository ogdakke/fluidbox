# Browser and scalability testing

The current baseline is documented in [`baseline/README.md`](../baseline/README.md). Capture it before changing renderer behavior.

## Test tiers

| Tier                   | Runs                                                                 | Evidence                                                                                     | Gate                                              |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pull request           | Chromium, Firefox, WebKit; Pixel 7, iPhone 13, iPad Pro 11 emulation | Playwright assertions, screenshots, traces and videos on failure                             | Interaction checks and committed visual snapshots |
| Baseline capture       | Manual CI dispatch or local command                                  | Full videos, timecoded diagnostic, frame samples, CPU/long-task readings, 1k/10k allocations | Observational                                     |
| Performance regression | Dedicated, stable runner after virtualization                        | Cold/warm open, DOM counts, frame gaps, CDP task/script/layout time, heap after cleanup      | Relative budgets calibrated from the new renderer |
| Real devices           | iOS Safari and Android Chrome device lab                             | Touch, browser chrome, memory pressure, GPU/compositor behavior                              | Release gate once available                       |

Playwright device profiles emulate viewport, user agent, and touch on desktop browser builds. They do not replace real phones or tablets. CPU figures from a shared CI VM should be treated as trends, not hard absolute limits.

## Scenario matrix to build out

- Open/close and interrupted reverse transitions; drag, wheel, keyboard, swipe, zoom and pinch.
- Light DOM, open shadow roots, nested scroll containers, transformed ancestors, right-to-left layout, reduced motion, high contrast, and focus return.
- Images of mixed dimensions and formats; delayed, failed, retried, and decoded media; video and both same-origin and cross-origin iframes.
- 1, 1k, 10k, and 100k items; jump to distant indices; rapid direction changes; source insertion/removal; recycled or missing origin element while open.
- Client-only use, SSR import without DOM globals, hydration, and framework binding smoke examples.
- Cleanup after repeated open/close, aborts, detached media, listeners, heap growth, and background network work.

Each interaction test should assert state and accessibility, then retain a trace on failure. Stable keyframes use `toHaveScreenshot`. Motion tests need videos plus timestamped geometry; exact one-frame pixel defects need frame extraction or deterministic animation sampling. Performance tests must record the runner model, browser/version, viewport, scenario, warm/cold state, and raw samples alongside summaries.

## Virtualization contract

The future gallery source should expose a stable `count` and indexed item lookup without requiring every `<app-lightbox>` trigger in the DOM. Items need stable IDs and media/thumbnail metadata; an optional `getOrigin(id)` supplies a mounted element for shared-element transitions. When the host list recycles that element, the viewer must keep the item open and use a defined fallback closing animation.

The viewer should keep a fixed overscanned window of slides around the active index and preserve native scroll geometry through spacers or an equivalent windowed track. The filmstrip should render only the visible thumbnail range and calculate the nearest index from scroll offset in constant time. Decodes and fetches outside the window must be cancelled. Selection should survive data refresh by ID, and mounted custom media must be restored or disposed exactly once.

The first hard scalability gates after that work are independent of gallery size: a bounded number of slide and filmstrip nodes, bounded listeners and active decodes, O(1) selection work per animation frame, and no increase in retained heap after repeated open/close. The existing 10k baseline makes these regressions straightforward to detect.
