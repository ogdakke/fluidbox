# Bundle budget baseline

Measured on 2026-10-23 with Bun 1.4.2 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/fluidbox-bundles.json`. The limits themselves live in `scripts/check-bundles.ts`; this page records what they measure and why they moved.

The check builds one small consumer per public entry with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is `packages/fluidbox/dist/styles.css`, measured as its own resource and added once to the activation total. Initial JS is what an entry loads before anyone touches a trigger; activation JS adds the lazy chunks the viewer loads on hover, press or idle.

| Consumer entry | Initial JS gzip | Activation JS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -----------------------: |
| Root           |         9,126 B |           37,231 B |                 40,796 B |
| Elements       |        13,082 B |           40,620 B |                 44,185 B |
| React          |        14,864 B |           42,551 B |                 46,116 B |
| Solid          |        12,723 B |           40,379 B |                 43,944 B |
| Vue            |        13,443 B |           41,138 B |                 44,703 B |
| Angular        |        13,898 B |           41,578 B |                 45,143 B |
| Filmstrip      |         3,644 B |            3,644 B |                  5,016 B |
| Sheet          |         7,249 B |            7,249 B |                  8,559 B |
| Kit            |         1,635 B |            1,635 B |                  5,200 B |
| Hover zoom     |         1,456 B |            1,456 B |                  5,021 B |
| Embeds         |         2,711 B |            2,711 B |                  6,276 B |
| Model          |         1,300 B |            1,300 B |                  4,865 B |
| Spin           |         2,426 B |            2,426 B |                  5,991 B |

`styles.css` is 3,565 B gzip. Each limit is the measurement plus 40 B, rounded up to the next 50 B.

The 2026-10-22 increases, about 1.3 KB initial and 4.5 KB activation on each core entry, record the hardening and product-media work merged together:

- Lifecycle: abandoned-open recovery, settlement guards, isolated subscriber errors, equal-items detection, slide reuse across `setItems`, derived ids and page-global viewer ownership.
- Security: media URL checks, the default iframe sandbox, DOM-built portals for Trusted Types, and link triggers with a fallback.
- Accessibility: bubble-phase key routing, isolation of only what was on the page, top-layer mounting over a modal dialog, announcements, focus rescue, caption tracks, busy and error states, and forced-colours and contrast styles.
- Zoom: the zoom commands, state and event, zoom controls, keyboard pan, and the sharper image when zoomed.
- Media: slide activity for custom renderers and owned-input arbitration. The hover zoom, embeds, model and spin add-ons have budgets of their own and add nothing to a page that doesn't import them.

On 2026-10-23 zoom steps taken before a zoom rests (Zoom in pressed twice, `+ +`, `zoomIn()` twice) started adding up instead of repeating the first step. That moved each core entry about 10 B initial and 90 B activation, in the viewer driver and the zoom engine. Fitting the image a zoom left once the viewer closes or moves to another item, so it doesn't open or come back still zoomed, added about 100 B activation more.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
