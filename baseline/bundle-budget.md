# Bundle budget baseline

Measured on 2026-09-24 with Bun 1.4.2 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/lightbox-bundles.json`.

The check builds six small consumer entries with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. It bundles the required `unlazy` dependency. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is the required `packages/lightbox/dist/styles.css`, measured as its own resource and added once to the activation total. The initial JS figure retains the previous static-graph calculation and limits; it is useful for checking whether a binding starts loading the viewer too early.

| Consumer entry | Initial JS gzip | Activation JS gzip | CSS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | -------: | -----------------------: |
| Root           |        17,670 B |           39,566 B |  3,754 B |                 43,320 B |
| Elements       |        23,007 B |           23,007 B |  3,754 B |                 26,761 B |
| React          |        20,907 B |           24,674 B |  3,754 B |                 28,428 B |
| Solid          |           260 B |           23,267 B |  3,754 B |                 27,021 B |
| Vue            |           382 B |           23,389 B |  3,754 B |                 27,143 B |
| Angular        |           250 B |           23,257 B |  3,754 B |                 27,011 B |

The root includes `createLightbox` and its bounded native gallery strip. Its limits are 17,690 B for initial JS, 39,590 B for activated JS, and 43,350 B with CSS. React limits are 20,930 B, 24,700 B, and 28,450 B respectively. The 2026-09-24 increases record the decoded-origin cache, deferred full-image loading, finite interrupted-pose guard, shared filmstrip arbitration, disposable pointerdown preparation, and traveling-overlay control reveal settlement. Elements retain a 25,000 B initial limit. Solid, Vue, and Angular retain 1,500 B initial limits. All other activation limits remain 24,500 B without CSS and 28,500 B with CSS. The CSS limit remains 5,000 B.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.
