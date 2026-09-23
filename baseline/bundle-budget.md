# Bundle budget baseline

Measured on 2026-09-23 with Bun 1.4.2 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/lightbox-bundles.json`.

The check builds six small consumer entries with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. It bundles the required `unlazy` dependency. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is the required `packages/lightbox/dist/styles.css`, measured as its own resource and added once to the activation total. The initial JS figure retains the previous static-graph calculation and limits; it is useful for checking whether a binding starts loading the viewer too early.

| Consumer entry | Initial JS gzip | Activation JS gzip | CSS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -------: | -----------------------: |
| Root           |         9,486 B |           30,504 B |  3,612 B |                 34,116 B |
| Elements       |        22,643 B |           22,643 B |  3,612 B |                 26,255 B |
| React          |           348 B |           22,991 B |  3,612 B |                 26,603 B |
| Solid          |           261 B |           22,904 B |  3,612 B |                 26,516 B |
| Vue            |           383 B |           23,026 B |  3,612 B |                 26,638 B |
| Angular        |           250 B |           22,893 B |  3,612 B |                 26,505 B |

The root includes `createLightbox` and its bounded native gallery strip. Its 10,500 B initial ceiling leaves 1,014 B, about 10.7%. Its conservative activation graph also includes the optional custom-element registration chunk. The 31,500 B activation ceiling leaves 996 B, about 3.3%, and the 35,500 B combined ceiling leaves 1,384 B, about 4.1%. Every other entry retains a 24,500 B activation ceiling and a 28,500 B combined ceiling. Their largest current values leave 1,474 B for activation JS and 1,862 B with CSS. Initial limits remain 25,000 B for elements and 1,500 B for each framework binding; the CSS limit remains 5,000 B.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
