# Bundle budget baseline

Measured on 2026-10-25 with Bun 1.4.3 and tsdown 0.23.0 on Linux x86_64. Run `bun run test:bundle` from the workspace root to rebuild the package and check these limits. To save the per-chunk results as JSON after a build, run `bun run scripts/check-bundles.ts --json /tmp/fluidbox-bundles.json`. The limits themselves live in `scripts/check-bundles.ts`; this page records what they measure and why they moved.

The check builds one small consumer per public entry with tsdown as minified browser ESM targeting ES2022. It follows static and dynamic imports from each entry and counts each reachable emitted JS chunk once. Only the entry's own framework peer stays external: React, Solid, Vue, or Angular. An unresolved runtime external or an unrelated framework import fails the check. It gzips each emitted chunk separately, then sums those byte counts to estimate JS transfer. CSS is `packages/fluidbox/dist/styles.css`, measured as its own resource and added once to the activation total. Initial JS is what an entry loads before anyone touches a trigger; activation JS adds the lazy chunks the viewer loads on hover, press or idle. On demand JS is what the viewer loads apart from the flight: fullscreen, download and share in one chunk, which loads once an open settles or a control for one is in the viewer, and a slide's zoom pose in another, which loads with its first listener. Reachable JS is activation and on demand together, the conservative total of everything a viewer can load but its add-ons, as activation counted it before the split. Each column has its own limit.

These are the package's own chunks, as a consumer's bundler first emits them. A bundling consumer merges and splits them again by its own rules, often folding a small on-demand chunk into the viewer's, so its numbers differ; the sum of what loads stays close to the reachable column, plus the cost of each extra request when the chunks stay apart.

| Consumer entry | Initial JS gzip | Activation JS gzip | On demand JS gzip | Reachable JS gzip | Activation JS + CSS gzip |
| -------------- | --------------: | -----------------: | ----------------: | ----------------: | -----------------------: |
| Root           |         9,802 B |           44,045 B |           1,151 B |          45,196 B |                 46,855 B |
| Elements       |        13,946 B |           47,387 B |           1,151 B |          48,538 B |                 50,197 B |
| React          |        17,183 B |           50,787 B |           1,151 B |          51,938 B |                 53,597 B |
| Solid          |        16,955 B |           50,555 B |           1,151 B |          51,706 B |                 53,365 B |
| Vue            |        17,625 B |           51,193 B |           1,151 B |          52,344 B |                 54,003 B |
| Angular        |        14,713 B |           48,233 B |           1,151 B |          49,384 B |                 51,043 B |

| Root | 10,113 B | 44,558 B | 1,151 B | 45,709 B | 47,368 B |
| Elements | 14,261 B | 47,907 B | 1,151 B | 49,058 B | 50,717 B |
| React | 17,493 B | 51,306 B | 1,151 B | 52,457 B | 54,116 B |
| Solid | 13,948 B | 47,736 B | 1,151 B | 48,887 B | 50,546 B |
| Vue | 17,923 B | 51,702 B | 1,151 B | 52,853 B | 54,512 B |
| Angular | 15,029 B | 48,763 B | 1,151 B | 49,914 B | 51,573 B |
| Thumbnails | 3,763 B | 3,763 B | 0 B | 3,763 B | 4,858 B |
| Sheet | 7,277 B | 7,277 B | 0 B | 7,277 B | 8,272 B |
| Kit | 1,831 B | 1,831 B | 0 B | 1,831 B | 4,641 B |
| Hover zoom | 1,453 B | 1,453 B | 0 B | 1,453 B | 4,263 B |
| Embed | 2,991 B | 2,991 B | 0 B | 2,991 B | 5,801 B |
| Model | 2,488 B | 2,488 B | 0 B | 2,488 B | 5,298 B |
| Spin | 2,388 B | 2,388 B | 0 B | 2,388 B | 5,198 B |
| React embed | 19,683 B | 53,333 B | 1,151 B | 54,484 B | 56,143 B |
| React model | 18,409 B | 51,994 B | 1,151 B | 53,145 B | 54,804 B |
| React spin | 19,108 B | 52,678 B | 1,151 B | 53,829 B | 55,488 B |
| Solid embed | 19,297 B | 52,955 B | 1,151 B | 54,106 B | 55,765 B |
| Solid model | 18,032 B | 51,609 B | 1,151 B | 52,760 B | 54,419 B |
| Solid spin | 18,724 B | 52,283 B | 1,151 B | 53,434 B | 55,093 B |
| Vue embed | 20,146 B | 53,776 B | 1,151 B | 54,927 B | 56,586 B |
| Vue model | 18,827 B | 52,387 B | 1,151 B | 53,538 B | 55,197 B |
| Vue spin | 19,556 B | 53,108 B | 1,151 B | 54,259 B | 55,918 B |

| React embed | 20,001 B | 53,856 B | 1,151 B | 55,007 B | 56,666 B |
| React model | 19,621 B | 53,404 B | 1,151 B | 54,555 B | 56,214 B |
| React spin | 19,413 B | 53,191 B | 1,151 B | 54,342 B | 56,001 B |
| Vue embed | 20,459 B | 54,294 B | 1,151 B | 55,445 B | 57,104 B |
| Vue model | 20,024 B | 53,797 B | 1,151 B | 54,948 B | 56,607 B |
| Vue spin | 19,857 B | 53,615 B | 1,151 B | 54,766 B | 56,425 B |

`styles.css` is 2,810 B gzip. The opt-in `baseline.css` is 3,259 B gzip; no entry imports it, so it has its own limit and counts in no activation total. Each limit is the measurement plus 40 B, rounded up to the next 50 B.

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

The size pass after step 3 took back most of the React binding's growth:

- **Development only.** The item-data name check, every error message and the trigger reach warning run only where the bundler builds for development; a production build drops them, and a page without a bundler skips the checks. This took 520–640 B off each binding's initial chunk, 641 B off React's. The URL check stays in production. The React package now leaves `process.env.NODE_ENV` for the app's bundler too; it had shipped its development check in production.
- **On demand.** Fullscreen, download and share, and the zoom pose a slide follows with `onZoom`, load on first use, or as soon as one of their controls is in the viewer, so a press finds them ready. Activation fell about 430 B, and reachable grew about 720 B, the price of two small chunks that compress less well apart. The drag's rubber band stays: every drag uses it.
- **React.** One store subscription per control in place of four.

React's initial chunk ends at 17,149 B, 634 B under the step's peak, and still above the spec's estimate of 15,600–16,300 B. What is left is the parts themselves: `Root` with the slide host, the server viewer's take-over and the value sync is about 3.7 KB of the binding's 14 KB minified, `Trigger` 1.1 KB, and the attribute and status helpers that `Media`, `Loading` and `Error` need about 1.6 KB. `baseline.css` grew 24 B: the selected thumbnail's bar and the forced-colours edges are outlines now, which a reset that zeroes borders leaves alone.

The trigger video's playback for custom players and the click and tap zoom modes added about 420 B to every viewer's activation, against the spec's estimate of 150–250 B: `origin` and its live view, `returnPlayback` and the built-in video's registration, the origin video found at open and close, the zoom option's two modes and the `data-fluidbox-zoom-click` mark. The custom elements' `zoom-click` and `zoom-tap` attributes added 80 B to their initial chunk.

The model slide grew 74 B, to 1,449 B, when it began to make a fresh `<model-viewer>` each time its slide comes on show and remove it when the slide leaves, holding a reopen for the new element's first frame: the element draws nothing, or a clipped frame, once it has left the page and come back.

A close that keeps a box holding a custom element in its frame added about 30 B to every viewer's activation. React slide content then gained a Suspense boundary of its own, with the commit reported beside the content inside it, so a slide that suspends keeps the app around the viewer up and the open waits for it: about 35 B initial and 70 B activation, which moves the React limits.

The model slide grew 56 B, to 1,505 B, when its close began to carry the poster in the slide's own frame as well as in a flight: a box that holds `<model-viewer>` closes in place.

The React add-on parts are entries of their own, `react/embed`, `react/model` and `react/spin`. Each consumer imports `Fluidbox` and the part, so it measures the binding, the part and the add-on together; each also checks that it carries no other add-on.

The Vue binding's redesigned parts, step 4, moved Vue by 1,863 B initial, to 16,172 B, and 1,848 B activation, against 14,309 B and 47,899 B: the same parts as React's, with `v-model` for the value and a slide host that holds each slide's commit inside a `<Suspense>` until the content beside it has mounted. The binding is about 6.1 KB gzip on its own, against React's 6.4 KB; the old Vue binding was 4.1 KB. Its component names, which Vue's devtools show, are about 100 B of it. By part, gzip on its own: the slide host and `Slides` 426 B, `Media` with the attribute helper 662 B, `Image`, `Video` and `Iframe` 164 B, `Toolbar`, `ZoomControls`, `Counter` and `Caption` 291 B, `Loading` and `Error` 336 B; the controls grew 245 B with Fullscreen, Download, Share, Retry and the label rule, and Root 94 B, while `Trigger` lost 93 B and `Overlay` 163 B against ThumbnailOverlay and FrameLayer.

The Vue Root then began to draw the server copy of a viewer it renders open on an image, as React's does, and to take it over as it mounts: 1,360 B initial, to 17,532 B, of which about 440 B is the binding's and the rest the core's static viewer, which the Vue entry had not carried before. The Vue add-on parts are entries of their own, `vue/embed`, `vue/model` and `vue/spin`, measured and checked as React's are.

The fixes after the Vue binding's review added 93 B initial, to 17,625 B, and 97 B activation, about the same to each Vue entry: a cancellable `valueChange` beside `update:modelValue`, the add-on parts registering on mount, `loop` declared as a Boolean prop, a Trigger preview that reads the viewer's state only when its slot reads it, and an Embed that checks for its Play content on each render.

The Angular binding's redesigned parts moved it by about 2.5 KB initial, to 17,248 B against a limit of 14,800 B, and activation with it, to 50,757 B. That puts it about level with React's 17,183 B. The new code is: `fluidboxSlide` and `fluidboxMedia`, which mount each slide's view detached and hold its commit until the view, and any `@defer` block in it, has rendered; `fluidbox-image`, `fluidbox-video` and `fluidbox-iframe`; `injectFluidboxSlide`; `fluidboxToolbar`, `fluidboxZoomControls`, `fluidboxCounter` and `fluidboxCaption`; `fluidboxFullscreen`, `fluidboxDownload` and `fluidboxShare`; `fluidboxLoading`, `fluidboxError` and `fluidboxRetry`; the label rule on every control; `fluidboxOverlay` with its flights in place of the thumbnail overlay and frame layer; `fluidboxSheetSnap`; and `[(value)]` as a `model()` in place of the open and index sync. The binding's error messages are development-only, as React's are.

The Angular add-on parts are entries of their own, `angular/embed`, `angular/model` and `angular/spin`. Each consumer imports `FluidboxModule` and the part, as React's do.

The Angular binding then grew by 1,823 B initial, to 19,078 B, with activation following. About 930 B of that is the server's copy of an open viewer, `fluidboxStaticViewerNodes` and its takeover, which React's initial chunk already carried. The rest is `class` and `attributes` on `fluidboxMedia`, a template for `fluidboxCounter`, and the `@defer` hold rewritten onto the slide's `waitUntil`, with a development warning for view data it can't read. The add-on entries moved by the same amount.

A review of the `@defer` hold then added about 190 B to every Angular entry, to 19,297 B initial. The hold now tells a block that is loading from one that waits on its placeholder for a press, a timer or a condition, holds the open only for the first, and walks only the slide's media content, which it collects as each `fluidboxMedia` mounts. Its frame loop and the viewer commands run outside Angular's zone.

The custom elements' redesign moved their initial chunk by 744 B, to 14,690 B, and their activation by 2,549 B, to 49,936 B, against 13,946 B and 47,387 B at the start of step 2:

- Initial: the gallery's `value` attribute and its sync, the slide lookup (the `slides` property, `<template data-fluidbox-slide>`, then the page's registry), `defineSlide` and `defineMarkup` with their page-wide registry, the `dismiss`, `wheel` and `shareUrl` options, the `setFullscreen`, `download` and `share` commands, `data-zoom-src` and the `caption` and `type` attributes on items, and the loader that holds a slide template's commit until the parts arrive.
- Activation: the parts, 1,865 B in a chunk of their own. A gallery loads it only once it holds a viewer or slide template, or a `viewer` property, so a gallery without templates never does: `<fluidbox-toolbar>`, `<fluidbox-zoom-controls>`, `<fluidbox-counter>`, `<fluidbox-caption>`, `<fluidbox-loading>`, `<fluidbox-error>`, `<fluidbox-fullscreen>`, `<fluidbox-download>`, `<fluidbox-share>`, `data-fluidbox-text`, and the slide template's stamping into the box and layer. With a static import the parts cost 1,306 B more in the initial chunk.

The custom elements' add-ons are entries of their own, `elements/embed`, `elements/model` and `elements/spin`. Each registers its slide and reads its markup (a YouTube or Vimeo `<iframe>`, `<model-viewer>`, `<img data-spin-frames>`), and measures the gallery, the add-on and its registration together, about 2.3–2.8 KB over the gallery's initial chunk, as the React parts are over React's.

After review, a starting `value` that waits for its items, as server HTML whose items arrive later has, and a gallery moved in the page that keeps the viewer's value instead of asking it again, added about 70 B to the custom elements' initial chunk.

A `type` that wins over what an item's content reads as, and a gallery that makes a new viewer when its slides change (the `slides` property, a slide template added or removed, or `defineSlide`), added about 90 B to the custom elements' initial chunk.

These are artifact-size regression limits, not loading-time or frame-rate claims. Browser caching, HTTP compression settings, framework peer bytes, host application code, images, and fonts affect real transfer and paint time. The check counts all statically reachable dynamic chunks as a conservative activation total even if a particular viewer interaction does not load every branch. It does not measure network requests or execution cost. Latency and frame budgets need device measurements on a stable runner.

On 2026-10-25 the Solid binding took the redesign's parts (step 4), moving Solid by 1,910 B initial, to 15,521 B, and 1,895 B activation, against 13,611 B and 47,206 B. The binding's own code went from 3,401 B to 5,734 B gzip minified (React's is 6,530 B, with its server viewer): `Slides` with a slide host that renders each slide under `<Suspense>` and reports its commit from an `onMount` the boundary holds, `Media` with `render`, attributes and children, `Image`, `Video` and `Iframe`, `Toolbar`, `ZoomControls`, `Counter`, `Caption`, `Fullscreen`, `Download`, `Share`, `Loading`, `Error` and `Retry`, the label rule on every control, `Overlay` in place of `ThumbnailOverlay` and `FrameLayer`, `SheetSnap`, `useFluidboxSlide`, the dismiss, wheel, share and media-error props, and `value` in place of the open and index sync. Its error messages are development only, as React's are. The spec estimated 900–1,900 B for Vue's and Solid's initial chunks. The Solid add-on parts (`solid/embed`, `solid/model`, `solid/spin`) are each the binding plus their plain-JS slide and a few dozen bytes.

Later on 2026-10-25 the Solid Root took React's server viewer: a Root whose first value names an image draws the viewer's static copy after its children and takes it over as it mounts. The copy's builder (`fluidboxStaticViewerNodes`) and `takeOverFluidbox` are now in Solid's initial chunk, as they are in React's, moving Solid by 1,366 B initial, to 16,887 B, and 1,384 B activation, to 50,485 B. The add-on parts move by the same. Limits are the measurement plus 40 B, rounded up to 50 B.

The review fixes after the Vue merge (the controlled value synced in a microtask, Thumbnails following its children, Media skipping function values) add 44 B to Solid's initial chunk, to 16,955 B; the limits move by the rule.

Keeping an opening's full picture while it still loads, in place of writing its source again (Firefox loads an image in a `<picture>` asynchronously even from the cache), moved every entry's activation by about 15 B. The limits it crossed moved by the rule above.

On 2026-10-25 the live 3D thumbnail moved every core entry by about 240 B initial and 410 B activation:

- **Initial, in the trigger.** A press on content that owns its input (`model-viewer`, `[data-fluidbox-owns-input]`) that moves past 6 px is a drag: the click it ends in doesn't open, and the press's preload is let go. `resolveOrigin` takes a `<model-viewer>` as the trigger's picture. Add-ons can see each trigger and its later content through `triggerHooks`, observed only when an add-on registered one. The kit, which carries the trigger, grew 249 B.
- **Activation, in the viewer.** `slide.origin.model`, `slide.onClose` with the landing trigger's origin on every close path, and finding the trigger's live model at open and close.
- **The model add-on** grew 795 B, to 2,300 B: it copies the trigger's camera into the slide's first frame (the zoom converted out of `<model-viewer>`'s widened field of view), flies a snapshot of the trigger's view and, on close, of the slide's, turns the landing card's camera to the slide's view, and takes a live model in a trigger out of the tab order and the accessibility tree. That last part lives in the add-on, not the trigger, so a page without models doesn't carry it; in the trigger it had cost every core entry about 175 B initial. React model and Vue model grew about 940 B initial with it.

The fixes after the live thumbnail's review moved every core entry by about 70 B initial and 80 B activation, and the model add-on by 188 B, to 2,488 B:

- **Initial, in the trigger.** A bound trigger's origin is read as the viewer measures it, so a `<model-viewer>`, or any picture, rendered into the trigger after bind is the one the flight and the camera sync use; a press ends as the pointer lifts, and a drag lets go of the click it swallows after that click's task, so a later `click()`, label click or screen reader activation opens; and a trigger hook may return what undoes it, called on unbind. The kit grew 83 B.
- **The model add-on** gives a live model its own accessibility back when its trigger is unbound or it leaves the trigger, undoing exactly what it changed, and drops a slide's snapshot when the slide leaves, so a slide that comes back shows its own view, not a stale picture. React model and Vue model grew about 270 B initial with it and the core's change.

Merging the live 3D thumbnail into the redesign with every binding moved each entry by what that branch measured on its own base: about 310 B initial and 450 B activation in the core (the trigger's origin getters, the drag slop and the trigger hooks), and about 1.2 KB more in each model entry (the model add-on's quieting, its undo and the snapshot). The limits moved by the rule.
