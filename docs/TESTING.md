# Browser and scalability testing

The current baseline is documented in [`baseline/README.md`](../baseline/README.md). It was captured before the renderer changed.

## Test tiers

| Tier                   | Runs                                                                     | Evidence                                                                                     | Gate                                              |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pull request           | Chromium, Firefox, WebKit; Pixel 7, iPhone 15 Pro, iPad Pro 11 emulation | Playwright assertions, screenshots, and traces and videos of a retried failure               | Interaction checks and committed visual snapshots |
| Baseline capture       | Manual CI dispatch or local command                                      | Full videos, timecoded diagnostic, frame samples, CPU/long-task readings, 1k/10k allocations | Observational                                     |
| Performance regression | Dedicated, stable runner after virtualization                            | Cold/warm open, DOM counts, frame gaps, CDP task/script/layout time, heap after cleanup      | Relative budgets calibrated from the new renderer |
| Real devices           | iOS Safari and Android Chrome device lab                                 | Touch, browser chrome, memory pressure, GPU/compositor behavior                              | Release gate once available                       |

## Running the browser suite

`bun run test:browser` builds the package and runs every spec on all six projects. Locally it uses six workers and records no traces or videos; on CI each shard uses two workers, retries a failure once and records the retry.

| Variable           | Values                                          | Default                                       |
| ------------------ | ----------------------------------------------- | --------------------------------------------- |
| `FLUIDBOX_WORKERS` | a worker count                                  | 6 locally, 2 on CI                            |
| `FLUIDBOX_RECORD`  | `off`, `on`, `retain-on-failure`, `first-retry` | `off` locally, `first-retry` on CI            |
| `FLUIDBOX_PORT`    | a free port; not 4190, which WebKit blocks      | 4173                                          |
| `FLUIDBOX_SERVER`  | `dev`, `preview` (run `build:examples` first)   | `dev`                                         |
| `BASELINE_CAPTURE` | set by `test:browser:baseline`                  | unset, so `baseline.spec.ts` is not collected |

Six workers stay reliable when other runs share the machine. Eight is the fastest setting on an idle 16-core machine; at twelve the WebKit motion checks start to fail. Only `baseline` records every run regardless of `FLUIDBOX_RECORD`; the other specs attach what they assert on (motion and collapsed geometry as JSON). To keep a failure's video locally, use `FLUIDBOX_RECORD=retain-on-failure`, or `FLUIDBOX_RECORD=first-retry` with `--retries=1`.

Several checkouts on one machine each need their own `FLUIDBOX_PORT`. Wrap every run of more than one spec in the shared lock, so suites wait for each other instead of starving each other's timing-sensitive checks:

```sh
flock /tmp/fluidbox-playwright.lock env FLUIDBOX_PORT=4193 bun run test:browser
FLUIDBOX_WORKERS=8 FLUIDBOX_RECORD=retain-on-failure bunx playwright test tests/browser/zoom.spec.ts
```

CI runs on pushes to `master`, on pull requests, and by hand (`workflow_dispatch`); a branch without a pull request isn't tested. A newer push to a pull request cancels the run still going on it.

The `checks` job (format, build, lint, unit, bundle, SSR and both site builds) takes under a minute, and the browser suite starts only once it passes. The browser suite is skipped for a draft pull request, which runs it once it's marked ready (or by hand), and for a change that touches only `apps/docs/`, `docs/`, `baseline/` or Markdown files.

The browser suite runs in eight shards. Each uploads a blob report; when a shard fails, the `merge-reports` job joins them into one HTML report. A shard runs with an 18-minute `--global-timeout`, which ends a stuck run before the 25-minute job timeout, so its report still uploads. The browsers are cached by Playwright version, and ffmpeg is installed only to index a failure's videos.

`bun run test:contract` compiles the positive and negative consumer fixtures for the locked
headless root and composed React type contracts. It runs without creating a browser session. The
package build, publint, and attw then verify that the generated declarations and export map remain
consumable.

Playwright device profiles emulate viewport, user agent, and touch on desktop browser builds. They do not replace real phones or tablets. CPU figures from a shared CI VM should be treated as trends, not hard absolute limits.

The proposed browser policy is in [BROWSER_SUPPORT.md](BROWSER_SUPPORT.md). The version and capability audit for that policy is still pending.

`tests/browser/motion.spec.ts` covers one warm-image DOM gallery on desktop Chromium, Firefox, and WebKit, plus the Pixel 7, iPhone 15 Pro, and iPad Pro 11 emulation profiles. It interrupts an unfinished open with close, then an unfinished close with open. It pins Web Animations tracks at 90 ms so a busy browser worker cannot finish the transition before the sample. The test reads the visible active-slide media before closing and the visible flight-layer media during closing. Both reads around each command happen in the same browser task, with `performance.now()` timestamps. It checks that the sampled animation is unfinished, the media width is more than 15 px from both settled endpoints, and the handoff changes each rectangle coordinate by less than 4 px. It also checks final settlement, focus return, portal and flight removal, and restoration of a background element that was inert before opening. Every run attaches its JSON geometry; a video and trace come with `FLUIDBOX_RECORD` or a CI retry.

The same spec checks the indexed-source example's mounted image origin. Its opening media starts within 4 px of the thumbnail on all rectangle coordinates and grows by at least 20 px at 120 ms before settling. For an indexed item with no mounted origin, it checks that opening starts transparent and grows and fades in through the documented fallback. These tests use the example page's real image cards and the harness with the origin deliberately unmounted.

The photo-library radius case uses the button's explicit `data-fluidbox-preview` box and four distinct corner radii. It multiplies the frame's computed radius by its current transform scale to assert the visible corner size at opening, during close-to-open reversal, and near the closing endpoint. This catches a zero-radius handoff when the thumbnail image itself has square corners but its button clips the visible preview.

These assertions detect a pose jump at the command handoff. They do not measure velocity continuity across frames, a pointer grab during flight, cold image decode, mobile browser chrome, or retained listeners and media after repeated sessions. Physical iOS Safari and desktop trackpad checks remain to be run on the available devices; Android Chrome requires a device not currently available. None of these unfinished checks is counted as a Stage 0 exit gate pass.

The four framework fixture pages in `apps/examples` exercise built `/react`, `/solid`, `/vue`, and `/angular` exports. React uses the composed runtime; Solid, Vue, and Angular remain compatibility bindings and are migration work. `bun run test:ssr` imports every entry without browser globals. `bun run test:bundle` builds one consumer entry at a time and fails when a subpath imports an unrelated framework, the root eagerly registers custom elements, or an entry exceeds its gzip budget. The activation check includes `unlazy` and every reachable lazy chunk while excluding only the entry's own framework peer. [Bundle budgets](../baseline/bundle-budget.md) is the canonical record of current measurements and limits; keep numeric ceilings there so this testing guide cannot drift from the executable check. tsdown reports raw and gzip artifact sizes during `bun run build`; publint and attw validate exports and declarations.

## Scenario matrix to build out

- Open/close and interrupted reverse transitions; drag, wheel, keyboard, swipe, zoom and pinch.
- Light DOM, open shadow roots, nested scroll containers, transformed ancestors, right-to-left layout, reduced motion, high contrast, and focus return.
- Images of mixed dimensions and formats; delayed, failed, retried, and decoded media; video and both same-origin and cross-origin iframes.
- 1, 1k, 10k, and 100k items; jump to distant indices; rapid direction changes; source insertion/removal; recycled or missing origin element while open.
- Hydration and framework source updates after mount.
- Cleanup after repeated open/close, aborts, detached media, listeners, heap growth, and background network work.

Each interaction test should assert state and accessibility, then retain a trace on failure. Stable keyframes use `toHaveScreenshot`. Motion tests need videos plus timestamped geometry; exact one-frame pixel defects need frame extraction or deterministic animation sampling. Performance tests must record the runner model, browser/version, viewport, scenario, warm/cold state, and raw samples alongside summaries.

## Virtualization contract

`FluidboxSource` exposes `count`, `getItem(index)`, and `getIndex(id)` without requiring every trigger in the DOM. Source items carry stable IDs and media/thumbnail metadata. `FluidboxOriginAdapter` supplies optional `getOrigin(id)` and `revealOrigin(id, index, context)` integration, while composed bindings register mounted origins directly. The controller persists while host thumbnails recycle. A missing origin uses a scale-and-fade transition and the saved focus fallback when one remains mounted.

`tests/browser/source-reveal.spec.ts` checks native scrolling inside a nested host container, fallback for a clipped origin, cancellation during rapid selection and source replacement, immediate close during pending reveal, teardown, and throwing/rejected host callbacks. The TanStack integration in `tests/browser/photo-library.spec.ts` checks 10k and 100k datasets, distant filmstrip selection, background reveal, current closing geometry, focus return, bounded DOM, responsive columns, and filmstrip toggling without source replacement. See [VIRTUALIZATION.md](VIRTUALIZATION.md) for the source and host ownership contract.

The slide renderer keeps at most 31 slides and rebases its native scroll window after settlement. The filmstrip keeps a viewport-sized thumbnail range and selects by scroll offset in constant time. Image decodes outside the active window are aborted; custom content, including iframes, mounts only near the active item and is restored when evicted.

Pull-request tests enforce bounded slide, filmstrip, and total DOM counts at 1,000 and 100,000 items and exact DOM cleanup after repeated open/close. A same-run Chromium gate compares median synchronous open time at those sizes and saves raw measurements. The manual capture records frame gaps and CDP task/script/layout time. Absolute CPU/frame budgets still need calibration on a dedicated runner. An indexed source currently requires synchronous item lookup and stable count/IDs during a session; source mutation notifications, asynchronous pagination, and very large scroll tracks beyond the tested 100,000 items remain future work.
