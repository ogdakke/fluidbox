# Browser and scalability testing

The current baseline is documented in [`baseline/README.md`](../baseline/README.md). It was captured before the renderer changed.

## Test tiers

| Tier                   | Runs                                                                 | Evidence                                                                                     | Gate                                              |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pull request           | Chromium, Firefox, WebKit; Pixel 7, iPhone 13, iPad Pro 11 emulation | Playwright assertions, screenshots, traces and videos on failure                             | Interaction checks and committed visual snapshots |
| Baseline capture       | Manual CI dispatch or local command                                  | Full videos, timecoded diagnostic, frame samples, CPU/long-task readings, 1k/10k allocations | Observational                                     |
| Performance regression | Dedicated, stable runner after virtualization                        | Cold/warm open, DOM counts, frame gaps, CDP task/script/layout time, heap after cleanup      | Relative budgets calibrated from the new renderer |
| Real devices           | iOS Safari and Android Chrome device lab                             | Touch, browser chrome, memory pressure, GPU/compositor behavior                              | Release gate once available                       |

Playwright device profiles emulate viewport, user agent, and touch on desktop browser builds. They do not replace real phones or tablets. CPU figures from a shared CI VM should be treated as trends, not hard absolute limits.

The four framework pages in `examples/frameworks` exercise built `/react`, `/solid`, `/vue`, and `/angular` exports. `bun run test:ssr` imports those entries without browser globals. `bun run test:bundle` uses tsdown to build one consumer entry at a time and fails when a subpath imports an unrelated framework, the root eagerly includes custom elements, or an entry exceeds its gzip budget. Current limits are 600 B for the root, 25 kB for elements, 1.5 kB for each binding, and 5 kB for CSS. These limits exclude each framework and the external `unlazy` dependency. tsdown reports raw and gzip artifact sizes during `bun run build`; publint and attw validate exports and declarations.

## Scenario matrix to build out

- Open/close and interrupted reverse transitions; drag, wheel, keyboard, swipe, zoom and pinch.
- Light DOM, open shadow roots, nested scroll containers, transformed ancestors, right-to-left layout, reduced motion, high contrast, and focus return.
- Images of mixed dimensions and formats; delayed, failed, retried, and decoded media; video and both same-origin and cross-origin iframes.
- 1, 1k, 10k, and 100k items; jump to distant indices; rapid direction changes; source insertion/removal; recycled or missing origin element while open.
- Hydration and framework source updates after mount.
- Cleanup after repeated open/close, aborts, detached media, listeners, heap growth, and background network work.

Each interaction test should assert state and accessibility, then retain a trace on failure. Stable keyframes use `toHaveScreenshot`. Motion tests need videos plus timestamped geometry; exact one-frame pixel defects need frame extraction or deterministic animation sampling. Performance tests must record the runner model, browser/version, viewport, scenario, warm/cold state, and raw samples alongside summaries.

## Virtualization contract

`LightboxGallerySource` now exposes `count`, `getItem(index)`, and optional `getOrigin(id)` without requiring every `<app-lightbox>` trigger in the DOM. Source items carry stable IDs and media/thumbnail metadata. The gallery owns a persistent hidden controller, so host thumbnails can be recycled while the viewer stays open. A missing origin uses a scale-and-fade transition, and focus returns to the gallery when the selected origin is no longer mounted.

The slide renderer keeps at most 31 slides and rebases its native scroll window after settlement. The filmstrip keeps a viewport-sized thumbnail range and selects by scroll offset in constant time. Image decodes outside the active window are aborted; custom content, including iframes, mounts only near the active item and is restored when evicted.

Pull-request tests enforce bounded slide, filmstrip, and total DOM counts at 1,000 and 100,000 items and exact DOM cleanup after repeated open/close. A same-run Chromium gate compares median synchronous open time at those sizes and saves raw measurements. The manual capture records frame gaps and CDP task/script/layout time. Absolute CPU/frame budgets still need calibration on a dedicated runner. An indexed source currently requires synchronous item lookup and stable count/IDs during a session; source mutation notifications, asynchronous pagination, and very large scroll tracks beyond the tested 100,000 items remain future work.
