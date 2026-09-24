# Bundle budget baseline

Measured on 2026-09-24 with Bun 1.4.2 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/lightbox-bundles.json`.

The check builds six small consumer entries with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. It bundles the required `unlazy` dependency. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is the required `packages/lightbox/dist/styles.css`, measured as its own resource and added once to the activation total. The initial JS figure retains the previous static-graph calculation and limits; it is useful for checking whether a binding starts loading the viewer too early.

| Consumer entry | Initial JS gzip | Activation JS gzip | CSS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -------: | -----------------------: |
| Root           |        16,936 B |           38,535 B |  3,754 B |                 42,289 B |
| Elements       |        22,727 B |           22,727 B |  3,754 B |                 26,481 B |
| React          |        19,689 B |           23,456 B |  3,754 B |                 27,210 B |
| Solid          |           260 B |           22,987 B |  3,754 B |                 26,741 B |
| Vue            |           383 B |           23,110 B |  3,754 B |                 26,864 B |
| Angular        |           249 B |           22,976 B |  3,754 B |                 26,730 B |

The root includes `createLightbox` and its bounded native gallery strip. Its limits are 16,950 B for initial JS, 38,550 B for activated JS, and 42,310 B with CSS. React limits are 19,700 B, 23,470 B, and 27,220 B respectively. The 2026-09-24 increase of roughly 200 B records the decoded-origin cache which keeps a lazy thumbnail painted and defers full-image work until opening completes. Elements retain a 25,000 B initial limit. Solid, Vue, and Angular retain 1,500 B initial limits. All other activation limits remain 24,500 B without CSS and 28,500 B with CSS. The CSS limit remains 5,000 B.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
