# Bundle budget baseline

Measured on 2026-09-23 with Bun 1.4.2 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/lightbox-bundles.json`.

The check builds six small consumer entries with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. It bundles the required `unlazy` dependency. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is the required `packages/lightbox/dist/styles.css`, measured as its own resource and added once to the activation total. The initial JS figure retains the previous static-graph calculation and limits; it is useful for checking whether a binding starts loading the viewer too early.

| Consumer entry | Initial JS gzip | Activation JS gzip | CSS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -------: | -----------------------: |
| Root           |           456 B |           23,005 B |  3,612 B |                 26,617 B |
| Elements       |        22,549 B |           22,549 B |  3,612 B |                 26,161 B |
| React          |           346 B |           22,895 B |  3,612 B |                 26,507 B |
| Solid          |           259 B |           22,808 B |  3,612 B |                 26,420 B |
| Vue            |           382 B |           22,931 B |  3,612 B |                 26,543 B |
| Angular        |           249 B |           22,798 B |  3,612 B |                 26,410 B |

The highest current activation JS value is 23,005 B. Its 24,500 B ceiling leaves 1,495 B, about 6.5%, for normal build variation and small fixes while flagging a new substantial dependency or an unexpectedly eager feature. The highest combined value is 26,617 B. Its 28,500 B ceiling leaves 1,883 B, about 7.1%. The prior initial JS limits remain 600 B for root, 25,000 B for elements, and 1,500 B for each framework binding; the prior CSS limit remains 5,000 B. The combined limit makes CSS growth visible in the same total even if the separate limits still pass.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
