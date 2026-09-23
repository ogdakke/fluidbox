# Pre-virtualization browser baseline

Captured on 2026-09-23 from the DOM-backed lightbox, before changing slide or filmstrip rendering. The files in `current/` are immutable reference evidence from commit `892f1c0`, not universal timing targets. Later captures write to `test-results/capture/` by default.

## What is saved

- `current/{chromium,firefox,pixel-7}/closed.png`, `open.png`, and `next.png`: static states of a 30-item gallery.
- `current/{chromium,firefox,pixel-7}/interactions.webm`: open, keyboard navigation, filmstrip jump to item 21, close.
- `current/{chromium,firefox,pixel-7}/metrics.json`: timestamped `requestAnimationFrame` samples, frame gaps, navigation timing, long tasks where supported, and Chromium CDP CPU time.
- `current/{chromium,firefox,pixel-7}/shadow-open.png` and `shadow.webm`: shadow-root host appearance.
- `current/chromium/diagnostic.webm` and `diagnostic-frames.json`: a video with `performance.now()` and action name rendered in its upper-left corner, plus per-frame state and geometry. The clock is diagnostic instrumentation, so use `interactions.webm` for uninstrumented motion.
- `current/chromium/diagnostic-inspection/contact-sheet.jpg` and `frames.json`: an index of the 77 recorded video frames. Full-resolution frames can be extracted on demand.
- `current/chromium/stress-1000.json` and `stress-10000.json`: source, slide, filmstrip, and DOM-node counts plus local fixture/open times.

The 10,000-item run created 10,000 slides, 10,000 filmstrip buttons, and about 100,000 total DOM nodes. Its opening took 15.2 seconds locally, versus 468 ms at 1,000 items. These elapsed times include Playwright and host scheduling. Use the counts and growth trend as the architectural baseline; calibrate timing budgets on a dedicated runner.

## Inspect a suspect frame

```sh
bun run inspect:video baseline/current/chromium/diagnostic.webm
bun run inspect:video baseline/current/chromium/diagnostic.webm --frame=33
```

The first command writes numbered 80-frame contact sheets (`contact-001.jpg`, `contact-002.jpg`, …) and a `frames.json` mapping frame numbers to video timestamps and sheet files. The second writes a full-resolution PNG. Read the clock in that PNG (for example, `1298ms filmstrip-21`) and find that time in `diagnostic-frames.json` to inspect the selected slide and media position. The Playwright trace from a failing test adds DOM snapshots, network traffic, and actions; CI uploads `test-results/` and `playwright-report/`.

Playwright WebM recordings are 25 fps in this environment. A single 60 Hz display frame may fall between recorded video frames. The `requestAnimationFrame` samples can flag frame gaps and geometry jumps, but cannot prove that every composited pixel was correct. A compositor-level capture or deterministic animation-frame snapshot runner is still needed for exhaustive one-frame visual checks.

## Reproduce

```sh
bun install --frozen-lockfile
bunx playwright install --with-deps chromium firefox webkit
bun run test:browser
bun run test:browser:baseline
STRESS_COUNT=10000 bun run test:browser:baseline --project=chromium --grep 'large gallery'
```

To recapture the pre-virtualization behavior exactly, check out commit `892f1c0` in a separate worktree and run the capture there. The commands above capture the current renderer into ignored `test-results/capture/`.

The visual snapshots live under `tests/browser/interactions.spec.ts-snapshots/` and are compared in CI on Ubuntu 26.04. This local machine lacks WebKit runtime libraries and has no passwordless sudo, so WebKit, iPhone, and iPad baselines are set up to be captured by the CI workflow's manual `baseline` job. New captures default to `test-results/capture/`, keeping this committed baseline immutable. The new repository has no remote yet, so the CI job has not run.
