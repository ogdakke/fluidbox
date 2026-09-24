# Custom-element behavior parity

This is the migration ledger for the custom-element implementation at commit `769b397`. The audit
covers `lightbox.ts`, `gallery-strip.ts`, `filmstrip.ts`, and `gallery.ts`. It tracks behavior rather
than preserving the old class layout. The headless runtime must own each interaction rule. The
custom elements may translate attributes, events, and DOM-authored content into that runtime.

## Gallery host

| Old responsibility                                                          | Headless owner                                       | Status                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover DOM-authored children and adapt their media/content                | Custom-element adapter                               | Compatibility-only and still implemented by `AppLightbox.#prepareGallery()`                                                                                                         |
| Read an indexed source without mounting every thumbnail                     | `LightboxSource`, `arraySource()`, and `ViewerStrip` | Migrated                                                                                                                                                                            |
| Validate an indexed open and select an item in an existing session          | `ViewerSession.open()` and `goTo()`                  | Migrated                                                                                                                                                                            |
| Keep stable item identity across source changes                             | `ViewerSession.setSource()`                          | Migrated and covered by command tests                                                                                                                                               |
| Reveal the settled thumbnail in its scroll container                        | `LightboxOriginAdapter.revealOrigin()`               | Migrated. Filmstrip previews defer reveal until final touch/scroll settlement; reveal is abortable and never delays close.                                                          |
| Focus the gallery when a virtualizer has removed the selected trigger       | `DomViewerDriver` focus-host fallback                | Migrated when the original trigger had a connected focusable ancestor. Originless opens have no caller-selected fallback.                                                           |
| Redirect and warm a hidden teaser tile through `data-lightbox-preview-more` | Host origin/overlay adapter                          | Partial. The engine does not encode a gallery layout convention, and no direct example yet recreates the old proxy source, picture hiding, alt update, warming, and reset behavior. |

`AppGallery` remains a declarative compatibility adapter. It is not the gallery engine for
`createLightbox()` or the React binding.

## Full-image strip

| Old responsibility                                                                         | Headless owner                                                       | Status                                                                                                             |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Keep a 31-slide native horizontal scroll window                                            | `ViewerStrip`                                                        | Migrated; 100,000-item browser coverage                                                                            |
| Rebase the window around distant selections without changing the visible item              | `ViewerStrip.#renderWindow()` and instant alignment                  | Migrated                                                                                                           |
| Let native touch scrolling choose the active item and retain momentum                      | `ViewerStrip` scroll/settle handling plus `DomViewerDriver.select()` | Migrated                                                                                                           |
| Freeze the strip during dismiss and compensate for residual native scroll                  | `ViewerStrip.freeze()` and `resume()`                                | Migrated                                                                                                           |
| Load only the active item and adjacent items                                               | `ViewerStrip.#loadWindow()`                                          | Migrated                                                                                                           |
| Keep the last decoded thumbnail painted until the full image decodes                       | `decoded-preview.ts`, `prepareOpening()`, and `completeOpening()`    | Migrated, including a lazy loader changing `currentSrc` before the next source decodes                             |
| Defer full-image work until a decoded preview finishes the opening flight                  | `ViewerStrip`                                                        | Migrated                                                                                                           |
| Abort stale loads, show a retry action, and keep errors focusable only on the active slide | `ViewerStrip` request ownership and error UI                         | Migrated                                                                                                           |
| Move DOM-authored custom content into a slide and restore it on eviction                   | Renderer mount/dispose contract                                      | Replaced with explicit ownership. DOM renderers may move DOM; framework renderers retain ownership of descendants. |
| Pause outgoing video and preserve native media interaction                                 | `ViewerStrip` and `DomViewerDriver` native-interaction routing       | Migrated; physical mobile fullscreen checks remain a release gate                                                  |

The direct runtime treats filmstrip selection as an immediate preview scrub. It does not animate a
second full-image transition while the filmstrip continues under native momentum.

## Filmstrip

| Old responsibility                                                               | Headless owner                                            | Status                                                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Render a bounded thumbnail window based on viewport width                        | `FilmstripRuntime` layout callback and framework renderer | Migrated for React                                                                                                                |
| Keep native touch and trackpad momentum                                          | `FilmstripRuntime`                                        | Migrated. Automation covers held-touch settlement and native scrolling; physical touch and trackpad momentum remain manual gates. |
| Distinguish commanded centering from user scrolling                              | `FilmstripRuntime`                                        | Migrated                                                                                                                          |
| Select the centered item while scrolling and settle after `scrollend` or timeout | `FilmstripRuntime` and internal settled command           | Migrated, including a final settle when the centered index is unchanged                                                           |
| Abort thumbnail loads when an item leaves the window                             | `filmstrip-thumbnail.ts` and React item cleanup           | Migrated                                                                                                                          |
| Derive `/media/*-160w.webp` by filename convention                               | Source metadata                                           | Intentionally removed. Applications declare thumbnail candidates; the runtime does not rewrite arbitrary URLs.                    |

React and the compatibility element now render items into the window reported by
`FilmstripRuntime`; touch, wheel, commanded centering, resize, provisional selection, and settlement
live in one runtime. `FilmstripSession` retains only element DOM, thumbnail loading, selection
painting, and the legacy `/media/*-160w.webp` URL convention.

## Viewer lifecycle and portal

| Old responsibility                                                                               | Headless owner                                                                      | Status                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Create the body-level portal and isolate the background                                          | `viewer-portal.ts`                                                                  | Migrated                                                                                                            |
| Enforce one active viewer and hand ownership to a new viewer                                     | `viewer-ownership.ts`                                                               | Migrated; close veto is honored                                                                                     |
| Track closed, opening, open, and closing state                                                   | `ViewerSession` and `DomViewerDriver`                                               | Migrated                                                                                                            |
| Prepare opening geometry before the portal becomes visible                                       | `DomViewerDriver.open()`                                                            | Migrated                                                                                                            |
| Prebuild and measure opening on primary pointerdown, then cancel on pointer cancellation         | `LightboxController.prepare()` and trigger bindings                                 | Migrated. Preparation keeps state/background ownership unchanged, pauses the opening animations, and is disposable. |
| Reverse an unfinished open or close from the painted pose                                        | `DomViewerDriver` plus `image-transition-motion.ts`                                 | Migrated with timestamped geometry coverage                                                                         |
| Copy theme variables from the scoped trigger into the body portal                                | `DomViewerDriver.#applyTheme()`                                                     | Migrated for all `--lightbox-*` inputs and legacy aliases                                                           |
| Keep filmstrip controls hidden until the opening backdrop is ready                               | `DomViewerDriver.#waitForFilmstripReveal()`                                         | Migrated                                                                                                            |
| Keep video action controls hidden until their delayed reveal animation finishes                  | `ThumbnailOverlayRuntime`                                                           | Migrated for traveling overlay renderers; opening settlement waits for the application control reveal.              |
| Publish trigger state and `aria-expanded`                                                        | `DomViewerDriver.#setActiveTrigger()`                                               | Migrated                                                                                                            |
| Restore focus, thumbnail visibility, inert state, animations, observers, renderers, and requests | `ViewerSession.destroy()`, `DomViewerDriver.destroy()`, and `ViewerStrip.destroy()` | Migrated with teardown coverage                                                                                     |

## Transition geometry

| Old responsibility                                                                | Headless owner                                            | Status                                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Measure the marked visual rather than assuming the trigger box                    | `origin-geometry.ts` and `LightboxOrigin.visual`          | Migrated                                                                  |
| Preserve cover-crop continuity through open, close, and reversal                  | `transition-geometry.ts` and `image-transition-motion.ts` | Migrated                                                                  |
| Interpolate asymmetric corner radii in screen space                               | `mapRadii()` and the radius animation channel             | Migrated; iPhone emulation coverage exists, physical iOS remains required |
| Fall back to scale/fade when no visible origin exists                             | `DomViewerDriver` fallback poses                          | Migrated                                                                  |
| Retarget a close flight while the document scrolls or layout changes              | `DomViewerDriver` document flight and resize observer     | Migrated                                                                  |
| Keep image, video, iframe, or custom renderer state alive during the close flight | Image clone or live-node document flight                  | Migrated                                                                  |
| Hide the active background thumbnail throughout the viewer session                | `OriginRegistry`                                          | Migrated, including after host reveal and recycled registration           |
| Drive host and traveling thumbnail decorations from the same progress             | `ThumbnailOverlayRuntime`                                 | Migrated                                                                  |

The old `data-lightbox-preview-more` transition layer mixed a particular teaser layout with viewer
motion. `LightboxOrigin.visual` plus a host or traveling thumbnail overlay supplies the necessary
composition points, but the gallery demo still needs a migration example proving the same teaser
crop, radius, and decoration behavior.

## Input, zoom, and accessibility

| Old responsibility                                                                   | Headless owner                                               | Status   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| Touch drag dismissal and cancellation                                                | Shared `LightboxGestureController` used by `DomViewerDriver` | Migrated |
| Trackpad wheel ownership, acceleration handoff, momentum suppression, and settlement | `DomViewerDriver`                                            | Migrated |
| Pinch, pan, double-click/tap, and zoom suspension during navigation                  | Shared `lightbox-zoom.ts` used by `DomViewerDriver`          | Migrated |
| Release and restore overlay edges during mobile browser-chrome gestures              | `DomViewerDriver`                                            | Migrated |
| Route keyboard navigation while excluding native form/media interaction              | `DomViewerDriver`                                            | Migrated |
| Trap focus, restore focus, label slides, and announce item position                  | Portal, strip, and driver accessibility code                 | Migrated |
| Honor reduced motion without changing command/event settlement                       | `DomViewerDriver` and `ViewerSession`                        | Migrated |

## Loading and media

| Old responsibility                                                        | Headless owner                               | Status                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Warm a small preview before full media                                    | Explicit `thumbnail` and `preview` resources | Migrated without URL conventions                                                           |
| Apply `srcset`, `sizes`, and picture sources after preview handoff        | `ViewerStrip`                                | Migrated                                                                                   |
| Avoid loading full media before first open or after cancelled preparation | `ViewerStrip` mount/load lifecycle           | Migrated. A completed session currently retains its bounded active window for fast reopen. |
| Honor declarative eager loading while closed                              | Custom-element adapter                       | Compatibility-only. The headless source has no eager-load policy yet.                      |
| Retry failed media without losing the opening preview                     | `ViewerStrip`                                | Migrated                                                                                   |
| Support video, iframe, and custom content through one indexed source      | Media descriptors and renderer contract      | Migrated                                                                                   |
| Preserve live non-image state through close                               | Live-node document flight                    | Migrated                                                                                   |

## Compatibility boundary

The target boundary allows custom-element files to contain only declarative compatibility behavior:
attribute/property translation, DOM-content adaptation, element registration, and legacy event
names. The current `lightbox.ts` still owns gesture, zoom, transition, and gallery orchestration, so
the compatibility binding has not reached that boundary. New interaction behavior belongs in the
headless runtime first.

The dedicated `headless.html`, photo-library, and React examples use no custom elements. The main
vanilla playground still demonstrates the compatibility elements. Compatibility-specific tests may
keep element fixtures, but shared motion, gallery, filmstrip, media, focus, and teardown regressions
must run against `createLightbox()` or a composed binding. Solid, Vue, and Angular still use the old
element adapter today; migrating those bindings is required before 1.0.
