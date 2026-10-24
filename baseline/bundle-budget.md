# Bundle budget baseline

Measured on 2026-10-24 with Bun 1.4.3 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/fluidbox-bundles.json`. The limits themselves live in `scripts/check-bundles.ts`; this page records what they measure and why they moved.

The check builds one small consumer per public entry with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is `packages/fluidbox/dist/styles.css`, measured as its own resource and added once to the activation total. Initial JS is what an entry loads before anyone touches a trigger; activation JS adds the lazy chunks the viewer loads on hover, press or idle.

| Consumer entry | Initial JS gzip | Activation JS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -----------------------: |
| Root           |        10,329 B |           45,025 B |                 47,835 B |
| Elements       |        14,467 B |           48,325 B |                 51,135 B |
| React          |        17,778 B |           51,823 B |                 54,633 B |
| Solid          |        14,171 B |           48,199 B |                 51,009 B |
| Vue            |        14,827 B |           48,896 B |                 51,706 B |
| Angular        |        15,245 B |           49,229 B |                 52,039 B |
| Thumbnails     |         3,763 B |            3,763 B |                  4,858 B |
| Sheet          |         7,277 B |            7,277 B |                  8,272 B |
| Kit            |         1,662 B |            1,662 B |                  4,472 B |
| Hover zoom     |         1,453 B |            1,453 B |                  4,263 B |
| Embed          |         2,991 B |            2,991 B |                  5,801 B |
| Model          |         1,375 B |            1,375 B |                  4,185 B |
| Spin           |         2,388 B |            2,388 B |                  5,198 B |
| React embed    |        20,246 B |           54,368 B |                 57,178 B |
| React model    |        18,859 B |           52,895 B |                 55,705 B |
| React spin     |        19,704 B |           53,720 B |                 56,530 B |

`styles.css` is 2,810 B gzip. The opt-in `baseline.css` is 3,235 B gzip; no entry imports it, so it has its own limit and counts in no activation total. Each limit is the measurement plus 40 B, rounded up to the next 50 B.

The 2026-10-22 increases, about 1.3 KB initial and 4.5 KB activation on each core entry, record the hardening and product-media work merged together:

- Lifecycle: abandoned-open recovery, settlement guards, isolated subscriber errors, equal-items detection, slide reuse across `setItems`, derived ids and page-global viewer ownership.
- Security: media URL checks, the default iframe sandbox, DOM-built portals for Trusted Types, and link triggers with a fallback.
- Accessibility: bubble-phase key routing, isolation of only what was on the page, top-layer mounting over a modal dialog, announcements, focus rescue, caption tracks, busy and error states, and forced-colours and contrast styles.
- Zoom: the zoom commands, state and event, zoom controls, keyboard pan, and the sharper image when zoomed.
- Media: slide activity for custom renderers and owned-input arbitration. The hover zoom, embeds, model and spin add-ons have budgets of their own and add nothing to a page that doesn't import them.

On 2026-10-23 zoom steps taken before a zoom rests (Zoom in pressed twice, `+ +`, `zoomIn()` twice) started adding up instead of repeating the first step. That moved each core entry about 10 B initial and 90 B activation, in the viewer driver and the zoom engine. Fitting the image a zoom left once the viewer closes or moves to another item, so it doesn't open or come back still zoomed, added about 100 B activation more.

On 2026-10-24 the API redesign moved every core entry by about 1.2 KB initial and 7.4 KB activation, against 9,126 B and 37,231 B on 2026-10-23:

- Initial: the value model (`beforevaluechange`, `valuechange` and `valuechangecomplete` with `previousValue` and `action`) in place of the toggle and item events; `findTrigger` and `revealTrigger`; item checks for `fit: "fill"`, `data` and media kinds; full screen, Download, Share, `shareUrl`, the dismiss and wheel options; and the `bindControl` stub, which loads its wiring on first use.
- Activation: slides for every media kind with their own error and retry states, item `data` on slides and thumbnails, full screen with its WebKit fallback, Download through `fetch` for cross-origin files, Share with its clipboard fallback, the wheel modes, the rubber band when drag-to-dismiss is off, the `mediaerror` event, and the control wiring that `bindControl` shares with the layer.
- The control icons are gone: controls are text until an `icons` factory or `baseline.css` gives them a glyph. Each binding's initial chunk lost its icon builder and paths, about 370 B on React against the redesign before that.
- `styles.css` lost 824 B to `baseline.css`, which holds the colours, shadows, radii, transitions and mask glyphs. The embeds add-on lost its Play SVG; model and spin lost their looks.

Later on 2026-10-24 the media add-ons became slides. The `embeds` entry became `embed` and grew 434 B, to 2,991 B: `createEmbedProvider` with its URL and origin checks, the provider lookup, a preconnect to the player's origin, the `play` content option, and `fail` for an item whose provider the slide doesn't have. The spec estimated 2,800–2,950 B. YouTube and Vimeo stay in the default provider list, so neither shakes out of `embedSlide`. Model grew 63 B, to 1,375 B, because a model the viewer opens on holds the opening until its first frame has painted; spin lost 51 B with `isSpinItem`.

The React binding's new parts then moved React by 1,426 B initial, to 17,778 B, and about 1,460 B activation: `Slides` with a slide host that holds each slide's commit until its layout effect, `Media` with `render`, attributes and children, `Image`, `Video` and `Iframe`, `Toolbar`, `ZoomControls`, `Counter`, `Caption`, `Fullscreen`, `Download`, `Share`, `Loading`, `Error` and `Retry`, the label rule on every control, `Overlay` in place of `ThumbnailOverlay` and `FrameLayer`, `SheetSnap`, `useFluidboxSlide`, and `value` in place of the open and index sync. The spec estimated 600–1,200 B for the redesign's parts and 300–500 B for features 1–5. `styles.css` grew 69 B, to 2,810 B: the rules that let an error part or a Retry of yours stand in for the default error, and the toolbar's `display: contents`. Every entry's activation with CSS moved with it.

The trigger video's playback for custom players and the click and tap zoom modes added about 420 B to every viewer's activation, against the spec's estimate of 150–250 B: `origin` and its live view, `returnPlayback` and the built-in video's registration, the origin video found at open and close, the zoom option's two modes and the `data-fluidbox-zoom-click` mark. The custom elements' `zoom-click` and `zoom-tap` attributes added 80 B to their initial chunk.

The React add-on parts are entries of their own, `react/embed`, `react/model` and `react/spin`. Each consumer imports `Fluidbox` and the part, so it measures the binding, the part and the add-on together; each also checks that it carries no other add-on.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
