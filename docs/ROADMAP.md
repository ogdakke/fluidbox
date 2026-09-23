# Roadmap to 1.0

This is the proposed contract and order of work, not a description of APIs that already ship.

Fluidbox is a headless lightbox interaction library. Its purpose is to provide exceptionally fluid opening, closing, navigation, zoom, and media handoff across touch, trackpad, mouse, and keyboard. Applications compose their own viewer UI on the same runtime. Framework bindings must make that composition idiomatic without reimplementing interaction behavior.

The first public beta targets plain JavaScript, custom elements, and composed React parts/hooks. The 1.0 target also includes composed Solid, Vue, and Angular bindings. Responsive media support is core work; named CDN adapters follow demonstrated consumer needs. A preset viewer or simpler all-in-one React component is not a prerequisite.

## Where the project stands

The package is private at `0.0.0`. It already has a body-level custom portal, animated image handoff, interrupted transitions, gestures, zoom, native gallery scrolling, a virtualized slide window and filmstrip, an indexed source for galleries with unmounted thumbnails, CSS hooks, and SSR-safe root and framework imports. Browser tests exercise Chromium, Firefox, WebKit, and device profiles. The four framework entries build and have example pages. The portfolio consumes a sibling `file:` package and keeps its own Markdown plugins and media registry.

The public model is still centered on custom elements. The root exports registration, `bindGallerySource`, and types; `./elements` registers `<app-gallery>`, `<app-lightbox>`, and `<app-filmstrip>`. React and Vue wrap a gallery element. Solid and Angular offer setup helpers. These integrations are not yet the intended headless composition APIs.

Indexed sources currently require synchronous lookups and stable count and IDs for the open session. Their descriptors contain image URLs and dimensions; richer picture, video, iframe, and custom content uses the DOM/template path. The stylesheet mixes structural rules and appearance. SSR checks establish import safety, not full framework hydration correctness.

The tests establish bounded DOM size, navigation, and selected visual states. The synchronous `open()` timing gate detects gallery-size-dependent work; it does not measure first paint, decode stalls, or gesture latency. Exact DOM cleanup does not prove bounded heap, decoded-image memory, or listener cleanup. The broader matrix in [TESTING.md](TESTING.md) remains unfinished. Comparative interaction superiority and real-device release readiness still need evidence.

## Implementation checkpoint

Work has started in bounded, reviewed parts. Stage 0 is still incomplete.

- Added the first headless API contract in [PUBLIC_API.md](PUBLIC_API.md), exported its source,
  controller, renderer, origin, and overlay types, and implemented the SSR-safe `arraySource()`
  snapshot helper. `createLightbox()` and composed framework values remain implementation work;
  the package does not expose a non-functional stub.
- Began the runtime extraction behind the compatibility elements. Origin marker resolution,
  clipping visibility, abortable host reveal ownership, and crop/radius transition geometry now
  live in independent modules, with the existing motion and virtualized-source suites protecting
  their behavior.
- Added the internal plain TypeScript viewer session behind a motion-driver boundary. Unit tests now
  cover synchronous validation, immutable state, event order, prevention, command sharing and
  supersession, external abort, source reconciliation, host-reveal cancellation, overlay ownership,
  runtime failure, and teardown.
- Extracted body-portal construction and modal background isolation into a runtime-owned module;
  the compatibility element now consumes that shell. Single-active-viewer ownership is also an
  independent token-safe coordinator, so stale close cleanup cannot release a replacement viewer.
  An abort-aware semantic completion channel and three-command compatibility driver now bridge
  element motion without DOM polling or adding element APIs. Connecting that bridge to the viewer
  session, then exposing the public factory, remains the next extraction work.
- Added deterministic open/close interruption geometry checks, focus/inert restoration checks, and trace/video evidence in `tests/browser/motion.spec.ts`. This protects pose continuity at command handoff, not gesture velocity or compositor performance.
- Fixed indexed-source opening preparation to resolve mounted thumbnails before the gallery becomes active; added opening-pose and missing-origin scale/fade regressions.
- Fixed rounded indexed origins to honor explicit preview/target markers, with screen-space corner checks through opening, closing, and reversal.
- Added the React/TanStack Virtual photo-library pilot with 10k and 100k datasets, responsive rows, and a filmstrip toggle. Its source can reveal the selected item in the background. Closing uses an available target immediately or falls back without waiting. See [virtualized host integration](VIRTUALIZATION.md).
- Added total activation bundle accounting, including lazy chunks and `unlazy`, with separate CSS and combined budgets. See [bundle baseline](../baseline/bundle-budget.md).
- Removed stylesheet dependence on `@scope`. Viewer selectors use data-attribute roots, with tests for outside-element isolation, stylesheet override order, and host theme copying. [Styling documentation](LIGHTBOX.md) distinguishes author inputs from runtime-published motion values.
- Recorded the recent-browser target and available physical devices in [browser support policy](BROWSER_SUPPORT.md). Exact supported versions and physical-device results remain pending.

The immediate milestone is to prove the proposed public API before extracting the whole viewer session. The source, controller, origin, renderer, event, overlay, and React-part signatures now have concrete type fixtures and documentation. Runtime lifecycle tests, plain-JavaScript and composed-React examples, renderer ownership tests, and a declaration/export baseline still gate the lock. Existing custom-element APIs remain usable during migration.

Internal extraction has begun now that the interaction patch passes its browser checks. Origin resolution, abortable host scrolling, and transition geometry are the first completed seams. Next, move viewer lifecycle and interaction coordination into a plain TypeScript session, with custom elements as adapters. Each part must preserve existing behavior and pass its affected regression tests. The plain JavaScript runtime must work without custom-element registration before claiming decoupling is complete.

Stage 0 measurement work continues alongside that extraction: pinch-to-pan and wheel ownership coverage, broader recycled-origin cases, a second independent host virtualizer, and cold-media/first-useful-paint measurements. Pending physical-device checks and performance benchmarks do not block a bounded internal extraction. They remain release gates and are required before making comparative performance claims.

## Next milestone: public API lock

Lock the supported contract before moving the viewer lifecycle into the new session. Internal helper extraction may proceed without adding exports. A split into smaller files alone does not establish a headless API.

Deliver one reviewed API specification with these concrete artifacts:

1. An export list for the root, custom-element adapter, each framework binding, and styles. Mark current compatibility exports separately from new APIs. Do not treat every existing class member, internal `GalleryItem` field, DOM node, or CSS variable as a permanent extension point.
2. Type signatures and examples for `createLightbox`, source creation/replacement, origin registration, host reveal, subscriptions, commands, and destruction. Specify synchronous validation, command results, cancellation, event order, and accepted versus settled selection. Closing must never wait for host reveal.
3. A source contract covering image, video, iframe, and custom-content identity, responsive media metadata, stable IDs, synchronous lookup, missing origins, and source replacement. Keep remote fetching and CDN-specific URL generation outside metadata lookup. Separate the supported initial source model from later asynchronous pagination.
4. A renderer ownership table and working plain-JavaScript and composed-React examples. Identify runtime-owned measurement/portal nodes, framework-owned descendants, ref attachment and disposal, and the lifecycle of virtualized content. Application code in either example must use only the proposed public interfaces, without custom-element registration or private runtime fields. The contract spike may adapt the existing runtime internally; complete internal decoupling is the subsequent extraction milestone.
5. Exact names, types, defaults, and event semantics for the composed parts and hooks. Prove controlled open/selection with delayed acceptance, rejection, interrupted motion, and teardown before locking those props. Keep the existing element wrappers working during this migration.
6. An explicit public list of data attributes and CSS variables. Give each variable its publishing part, units, lifetime, and input/output ownership. Specify required structural styles and optional appearance styles, selector specificity, and supported override behavior without `@scope`.

The lock is complete when the examples run through the proposed public interfaces, positive and invalid consumer type fixtures pass, lifecycle tests assert the specified event and command outcomes, and the generated declaration/export baseline matches the specification. Record the agreed contract as the implementation target. Any later breaking change must update the contract and migration notes explicitly rather than emerging from refactoring.

After that gate, extract a plain TypeScript viewer session and make custom elements adapters over it. Keep the existing interaction tests active throughout. SSR import safety, framework-native rendering ownership, and body-level portal behavior are acceptance criteria for the decoupled runtime.

## Product and ownership contract

### What headless means

- The runtime owns interaction state, gesture arbitration, zoom, transition geometry, gallery windowing, the body-level portal, media scheduling, and accessibility mechanics.
- Applications own visual design, icons, control placement, captions, toolbars, and framework-authored content. No default toolbar, filmstrip, or visual theme is mandatory.
- Framework bindings connect composed parts to the runtime and render framework content through native portals or equivalent facilities. They do not implement separate gesture or animation systems.
- Per-frame transforms and gesture samples stay inside the runtime. Framework subscriptions expose discrete semantic state, not a render for every pointer move.
- Headless does not mean arbitrary markup can replace every internal node. Publish supported parts and their layout constraints; keep scroll tracks, flight layers, and measurement nodes private.
- Public data attributes and engine-driven CSS custom properties are the primary styling API. Document variable units, ranges, which part publishes each value, and whether it is an author input or runtime output. Let applications consume motion outputs in their own effects without subscribing to every gesture frame. Do not require CSS `@scope`; use ordinary selectors with deliberate specificity and data-attribute isolation.
- Structural styles required for positioning, sizing, touch behavior, scroll snapping, and visibility are part of the behavior contract. Separate them from optional appearance CSS. Consumers can restyle supported parts without copying interaction code.

Preserve the body-level custom portal. Do not replace it with a native `dialog`. Keep root and framework imports safe without browser globals; constructing a browser session may require the DOM. Keep all bindings as subpath exports in the same package, with no framework dependency entering the runtime.

### Public composition points

The initial parts are `Root`, `Item`, `Trigger`, `Portal`, `Content`, `Close`, `Previous`, `Next`, and optional `Filmstrip`. Provide a caption/description association and state hooks for application-authored controls. Exact names are validated in the contract spike.

`Portal` places application-authored viewer controls/content into the runtime-owned body portal. `Content` connects media or framework-rendered content to the runtime's measured frame. Navigation and close parts supply command wiring and applicable accessibility/disabled state; consumers supply appearance and children. `Filmstrip` uses the runtime's bounded rendering and selection behavior rather than requiring one thumbnail component per source item.

Document which element receives refs, state attributes, accessible relationships, and required styles for every part. Do not expose every internal node as a public component or promise unrestricted replacement of geometry-critical markup.

## Browser support

Target recent browsers with an explicit, versioned release matrix. The proposed window is current/previous stable desktop browsers and current/previous macOS/iOS major releases on their latest updates, subject to the capability audit. Keep legacy compatibility optional and deferred. See [browser support policy](BROWSER_SUPPORT.md) for exact scope, fallback requirements, and manual test records.

Physical devices currently available are an iPhone 15 Pro and an M1 MacBook. Their OS/browser versions and test results still need recording. Android remains a target with an explicit physical-validation gap; it does not block independent automated work or a clearly labeled image beta. Do not claim verified Android interaction quality before obtaining device evidence.

## Interaction quality is a release contract

Capture the current behavior before extraction, then add assertions for the cases that distinguish this library. Existing settled screenshots remain useful but are not sufficient motion tests.

| Scenario                                 | Required behavior and evidence                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grab or reverse an unfinished open/close | Continue from the painted pose without a position or scale jump. Assert timestamped geometry around interruption and retain motion recordings.                                                    |
| Dismiss, reverse, and release            | Preserve continuity through direction changes and settlement; avoid an abrupt velocity reset where the current interaction supports continuous handoff.                                           |
| Pinch to one-finger pan                  | Retain the focal point and pose when a finger lifts; do not restart the gesture from the fitted image.                                                                                            |
| Zoomed pan versus gallery navigation     | Define boundary ownership and prevent accidental item changes while the image owns the gesture.                                                                                                   |
| Trackpad and mouse wheel                 | Cover diagonal input, momentum tails, ctrl-wheel zoom, and line/pixel delta modes. Dismissal must not unintentionally transfer residual momentum into page scrolling.                             |
| Native slide-window rebase               | Cross boundaries in both directions, reverse rapidly, and jump far away without a blank frame or incorrect selection. Test animated motion on all supported engines, not only instant navigation. |
| Preview to decoded image                 | Keep geometry and zoom pose stable; retain a usable preview until replacement is ready.                                                                                                           |
| Recycled or missing origin               | Never animate to or focus an element now representing another item. Use the documented fallback transition and focus target.                                                                      |
| Viewport changes                         | Resize, rotate, and change mobile browser chrome while open or zoomed without stranding controls or losing the active item.                                                                       |
| Input cancellation and teardown          | Handle pointer cancellation, window blur, unmount, and destroy during any phase without stuck capture, inert background, or pending commands.                                                     |

Use deterministic geometry assertions for continuity, browser automation for state and input routing, and physical iOS Safari/Android Chrome plus desktop trackpad checks for native behavior. Record device, OS, browser, refresh rate, and scenario. Include 60 Hz and 120 Hz hardware where available. Emulated devices do not satisfy the physical-device gate.

Before setting numeric budgets, collect raw samples on a stable runner for 1, 1,000, 10,000, and 100,000 items, plus a realistic 12-image gallery on a slower phone. Measure cold/warm first useful paint, interaction frame gaps, decode/upgrade work, network requests, and repeated-session retention. Keep synchronous opening cost and DOM bounds as separate checks. Track initial import bytes and total viewer activation bytes, including required dependencies and behavior CSS.

Stage 0 must check in the baseline report, measurement definitions, runner configuration, and calibrated regression thresholds. Until this happens, frame/latency budgets are explicitly unresolved rather than claimed to pass. Repeated interrupted sessions must be checked for retained media, listeners, observers, timers, animations, and background loading as well as DOM cleanup. Compare selected scenarios with other lightboxes using the same assets and devices before making public superiority claims.

## Long photo-library example and benchmark

Build a Photos-style example with a genuinely scrollable, virtualized host grid. The current indexed example mounts 12 cards and replaces their window through a jump form; it does not exercise continuous host scrolling or thumbnail recycling under normal browsing.

Use [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction) for the first host implementation, through its core or appropriate framework adapter. Use stable item keys and its documented measurement/scrolling APIs. The example application owns grid layout and virtualization. Fluidbox consumes its indexed source and resolves currently mounted origins by stable ID. Do not add a photo-grid engine or virtualizer dependency to the runtime package.

Define the integration checks against public source/origin APIs so they can be repeated with a second independent library, such as [React Virtuoso Grid](https://virtuoso.dev/react-virtuoso/), before claiming broad virtualizer compatibility. Test actual library behavior, not a mock with our preferred recycling semantics. Framework adapters must not need private Fluidbox DOM or library-specific branches in the interaction engine.

- Default to 10,000 items with a 100,000-item stress option, date sections, mixed portrait/landscape dimensions, and responsive columns. Keep host and viewer DOM independently bounded.
- Provide a deterministic local fixture mode for CI and a documented varied-photo mode for manual decode/memory testing. Repeated SVGs are useful for geometry but cannot establish realistic image-memory or transfer behavior. Use redistributable assets or caller-supplied photos; record the dataset and candidate dimensions with results.
- Lazy-load thumbnails within a bounded host overscan range. Record host thumbnail requests separately from viewer preview/full-image requests. Exercise slow and failed media without making CI depend on a remote image service.
- Open from a visible image after scrolling deep into the library; assert the opening pose matches that thumbnail. Navigate beyond the mounted host range and jump far away through the filmstrip while keeping the viewer mounted.
- Change the host window programmatically while the modal is open to simulate recycling/source updates; do not unlock background scrolling merely for the benchmark. A recycled node must never become another item's close target.
- Follow the selected item in the background by default in this example, including distant filmstrip navigation. Ask the host virtualizer to reveal it through an explicit public source hook, then re-resolve the mounted origin for closing and focus. Coalesce rapid navigation and cancel stale reveal work so an older request cannot move the host away from the final selection. Closing never waits for the host. Abort pending reveal work and use a matching visible origin immediately, or use the fallback transition.
- Test repeated open/navigate/close sessions, reverse scroll direction, viewport/column changes, keyboard use, and physical touch/trackpad input. Assert selected IDs, visible ranges, focus, DOM bounds, and request cleanup; record first useful paint, frame gaps, and retained memory separately.

Deliver a linked playground route, reproducible dataset/seed, browser scenarios, and raw measurements for both item counts. This is the next substantial example/benchmark part after the initial transition and bundle checks; it contributes evidence to Stage 0 without claiming that all performance gates are complete.

## Source, state, and lifecycle contract

### One source for DOM and indexed galleries

Use synchronous metadata lookup for the initial contract. Media loading remains asynchronous. A source snapshot provides:

- A finite `count`, unique stable item IDs, and `getItem(index)` returning a normalized descriptor.
- `getIndex(id)` returning an index or a missing result. Opening by ID must not require scanning an arbitrary indexed source. `arraySource` may construct an ID map once per snapshot.
- Optional origin resolution returning an element associated with an item ID. Revalidate that association, connection, and usable geometry before close handoff or focus restoration.
- An optional host reveal hook for scrolling the actual gallery container or asking a virtualizer to mount the selected item. Keep source metadata synchronous; revealing an origin may complete asynchronously. Define cancellation, failure, and rapid-close behavior explicitly. A plain DOM adapter can scroll its item into view; an indexed adapter delegates scrolling to the host.

`Item`/`Trigger` parts register origins, not a second copy of source metadata. The full source remains available when only a few triggers are mounted. DOM-authored galleries may build a source through an adapter; they must obey the same runtime contract.

Start live updates with explicit `setSource(snapshot)`, not observation of arbitrary mutable arrays. Preserve the active ID if it still exists. If it was removed, select the item at the previous index clamped to the new count. If the new source is empty, close with reason `source-empty`. Reordering preserves identity, not the old index. A snapshot change invalidates stale item loads and lookups; responses from an older revision cannot replace current content.

Invalid indices, duplicate IDs in array sources, and failed metadata lookups need documented errors. A provider lookup failure must leave a recoverable session and must not leak the portal or background inertness. Define the failure behavior in the contract tests before adding provider integrations.

Unknown-length pagination and asynchronous item lookup are deferred. Applications can fetch data separately and replace a known-count snapshot.

### Commands and semantic state

Proposed commands are `open({ id } | { index })`, `close()`, `goTo({ id } | { index })`, `next()`, `previous()`, `setSource(source)`, `subscribe(listener)`, and `destroy()`. Readonly state includes `status: closed | opening | open | closing`, current ID/index, count, and requested destination while navigation is pending. Publish a separate settled notification so consumers do not confuse accepted navigation with completed motion.

Adopt these proposed rules in the contract spike:

- Motion commands resolve after their requested state settles. Return a discriminated result for completed, superseded, prevented, or aborted work. Invalid arguments reject. No promise remains pending after interruption or destruction.
- A newer incompatible command supersedes the old command and continues from the painted pose. Repeated requests for the same pending destination share its outcome. `destroy()` is immediate and idempotent, cancels pending work, and releases all session resources.
- Before-events are synchronous and cancelable for application-requested or user-requested actions. They cannot veto mandatory cleanup on destroy or prevent recovery from an empty source.
- Carry reasons through commands and notifications, including trigger, keyboard, pointer, wheel, filmstrip, API, source update, and teardown as applicable.
- Separate accepted selection changes from settlement; specify event order for prevention, interruption, no-op requests, source replacement, and reduced motion with trace-based tests.
- Accept an `AbortSignal` for commands/loading that may outlive the caller. Aborting a command must settle it and leave a documented valid viewer state; it is not synonymous with destroying the viewer.

Controlled framework state must use request callbacks and committed props without feedback loops. An uncontrolled root accepts requests immediately. A controlled root waits for the owning prop update before committing an open/close or item change; gesture tracking stays local and immediate, and unaccepted gestures settle back to committed state. The spike must prove parent acceptance, rejection, delayed updates, and teardown. Do not publish controlled props until their callback order and interrupted-motion behavior are tested.

### Proposed plain JavaScript API

Names and exact types remain drafts. Importing `createLightbox` is SSR-safe; calling it creates browser behavior. The final API must not require custom-element registration.

```ts
import { createLightbox, arraySource } from "@ogdakke/fluidbox";

const viewer = createLightbox({
  source: arraySource(photos),
  getOrigin: (id) => document.querySelector(`[data-photo-id="${CSS.escape(id)}"]`),
  onChange: ({ id, index, reason }) => console.log(id, index, reason),
});

await viewer.open({ id: "photo-1" });
await viewer.next();
await viewer.close();
viewer.destroy();
```

The spike must also demonstrate attaching application-authored controls and custom content to the body portal using public APIs alone. Specify attachment/disposal handles for plain JS parts alongside framework parts; the command-only example above is not the whole headless contract.

Keep `registerLightboxElements()` and `./elements` as the declarative adapter. Decide final tag names and attribute/event mapping before beta. Existing `app-*` names are provisional. Preserve live-content movement and template-based content options for DOM-owned content.

## Framework composition

### React

Composed parts and hooks are the primary React API. Do not replace them with a mandatory preset viewer. The following illustrates the target composition, not working code. `photos` contains normalized media descriptors; `Content` resolves its item from that source rather than declaring a conflicting second `src`.

```tsx
import { Lightbox, useLightbox, useLightboxState } from "@ogdakke/fluidbox/react";

function PhotoGallery({ photos }) {
  return (
    <Lightbox.Root items={photos}>
      {photos.map((photo) => (
        <Lightbox.Item key={photo.id} id={photo.id}>
          <Lightbox.Trigger asChild>
            <button>
              <img src={photo.thumbnailSrc} alt={photo.alt} />
            </button>
          </Lightbox.Trigger>
        </Lightbox.Item>
      ))}
      <Lightbox.Portal>
        <Lightbox.Content />
        <GalleryControls />
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}

function GalleryControls() {
  const { next, previous, close } = useLightbox();
  const currentIndex = useLightboxState((state) => state.currentIndex);
  const count = useLightboxState((state) => state.count);
  return (
    <nav aria-label="Gallery controls">
      <button onClick={() => void previous()}>Previous</button>
      <span>
        {currentIndex === null ? 0 : currentIndex + 1}/{count}
      </span>
      <button onClick={() => void next()}>Next</button>
      <button onClick={() => void close()}>Close</button>
    </nav>
  );
}
```

The composed `Previous`, `Next`, and `Close` parts offer equivalent wiring for consumers who prefer parts over command hooks. Their examples must include finite-gallery disabled states. A `Content` render function receives item metadata and a runtime-provided mounting target for each retained custom-content slide; its exact signature is a stage 1 deliverable.

A virtualized host supplies the full indexed source to `Root` and mounts only visible `Item`/`Trigger` parts. `Content` must render the runtime's bounded slide set without requiring a component for every item. Implement `useLightboxState(selector)` with stable `useSyncExternalStore` snapshots and selector behavior; `useLightbox()` exposes stable commands.

The framework owns custom-content descendants. The runtime owns the outer measured frame and transforms. Render React content through React portals into stable targets for its mounted lifetime; do not manually reparent React-owned descendants. Eviction unmounts through React, and revisiting may remount. Persisting state across eviction is an application responsibility unless a bounded retention policy is explicitly added later. Test context, local state while mounted, events, refs, cleanup, Strict Mode, and hydration before freezing this shape.

`asChild` must compose refs and handlers, honor consumer prevention of the part action, and document its single-child and accessibility requirements. Include a styled custom button and an anchor trigger with progressive fallback in the examples.

### Thumbnail overlay composition

Include a `ThumbnailOverlay` part in the contract spike. It inherits the item identity from `Item` and hosts application-authored badges, captions, play icons, counts, or other content over the thumbnail. Provide an equivalent plain-DOM attachment through the same runtime. The typed `host` and `travel` behaviors are the implementation target; they become supported runtime values only after the renderer ownership spike passes.

Publish `data-lightbox-phase` and `--lightbox-progress` on the overlay's animation target. Keep the existing progress convention: `1` at the thumbnail pose and `0` at the fully open pose. Applications can use `opacity: var(--lightbox-progress, 1)` for a continuous fade, phase selectors for immediate hiding, or their own transforms. Reversal and gesture cancellation must continue from the painted progress. These effects must not require per-frame framework state updates or independent CSS animation timers.

The spike must distinguish a decoration that stays on the host card from content that travels with the opening/closing image. Define clipping, scaling, pointer-event and accessibility behavior for each. Framework-owned descendants must be rendered and disposed through their framework rather than manually reparented. Demonstrate what happens when the host virtualizer unmounts the originating `Item`, another item becomes selected, or closing falls back without an origin. If traveling overlay content needs a renderer owned by `Root`, make that registration explicit before freezing the component signature.

### Other bindings

| Binding         | Native shape                                                                        | Required proof                                                                              |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Solid           | Composed parts and hooks using signals/accessors                                    | Controlled state, trigger composition, context in portal content, virtualized host, cleanup |
| Vue             | Components, slots, composable commands/state, `v-model:open` and `v-model:activeId` | Slot forwarding, trigger composition, SSR hydration, portal context, source replacement     |
| Angular         | Root/provider, item/trigger directives, content templates, signals and outputs      | Existing-element composition, projected content, hydration, updates, focus return           |
| Custom elements | Tags, attributes, properties, DOM events                                            | Explicit registration, DOM/template content, same controller state and events               |

Build one demanding example per binding using only public runtime APIs. Include DOM and indexed sources, source replacement while open, missing origins, and custom content. Framework-specific fixes must remain in bindings; gesture and portal behavior must remain shared. Keep current integrations usable during migration, with an explicit compatibility/deprecation path before release.

## Media and CDN contract

### Responsive images first

Define a discriminated media descriptor shared by DOM adapters, indexed sources, and framework bindings. First implement image descriptors with stable ID, intrinsic dimensions, fallback URL, preview/thumbnail metadata, responsive width candidates, optional picture sources for format/art direction, alt text, and separate caption/description metadata.

Define how picture-source dimensions affect the measured aspect ratio. Freeze handoff geometry during an active transition, then reconcile a changed ratio without a discontinuous gesture pose. Preserve the decoded preview until replacement is ready. Resolution upgrades must preserve zoom focal point and pan position.

The runtime owns candidate selection inputs, decode scheduling, active-item priority, bounded adjacent preload, retries, and stale-result suppression. Prefer browser `srcset`/`sizes` selection for supplied candidates. Derive displayed size from viewport and zoom, cap it by source resolution, and use discrete upgrade thresholds rather than requesting a unique URL on every pinch event. Document that cancellation invalidates results and performs best-effort request cleanup; do not promise immediate browser decode or GPU-memory cancellation.

Test slow, failed, retried, cached, and out-of-order loads; rapid direction changes; close during decode; DPR/viewport changes; and large images on a constrained device. Assert both visible continuity and bounded requests. The opening frame must not wait for a full-resolution image when a usable preview exists.

### Video, iframe, and custom content

Prove these through the same descriptor and renderer lifecycle before claiming media parity between DOM and indexed sources. Distinguish mount, activate, deactivate, and dispose. Make zoom eligibility and gesture ownership explicit per content kind.

- Video retains native control interaction, pauses on deactivation, and has tested playback/fullscreen behavior on physical mobile devices. A renderer may provide provider-specific control later.
- Iframes have dimensions, an accessible title, explicit embedding attributes, and an external close control. Cross-origin frame interiors are not a universal drag/keyboard interception area. Define whether eviction reloads content; do not promise persistence merely because an element is reused.
- Custom content can contain forms and nested scroll regions. It must be able to reserve native interaction areas. Framework renderers retain ownership of descendants and receive lifecycle notifications without being manually moved by the runtime.

Image beta can precede full mixed-media support, but the renderer ownership prototype must exist before extraction. Existing DOM media behavior must not regress during migration.

### URL adapters and distribution

Arbitrary URLs and precomputed responsive candidates work without an adapter. Define a pure, SSR-safe adapter that converts provider input into normalized descriptors/candidates; the runtime retains loading policy. Pilot one provider required by a real consumer after responsive images work end to end.

Provider-specific tests cover width/DPR, format, crop/aspect ratio, URL encoding, existing query parameters, and signed URLs. Signing secrets never enter browser code. Accept pre-signed candidates; defer token refresh and server-specific signing helpers until required. Provider imports must not enter the default runtime bundle.

Loading the library itself from a CDN is a separate release requirement. Test a plain HTML page using a version-pinned browser module and required behavior CSS, with documented dependency resolution and no bundler. Do not assume npm package publication alone proves this path.

## Accessibility and styling gates

Accessibility mechanics belong to the headless contract. Custom appearance must not remove required dialog semantics, naming, focus handling, background inertness, keyboard behavior, or reduced-motion support. Provide accessible parts and document consumer responsibilities for labels and arbitrary content.

Audit keyboard routing before advertising arbitrary content. Editing text or operating a native media/form control must not trigger gallery shortcuts. Test Escape ownership, focus traversal, nested scroll containers, open shadow roots, disabled/hidden controls, recycled-origin focus fallback, and teardown. Provide configurable UI/status labels and test RTL, high contrast, reduced motion, and screen reader announcements. Reduced motion must preserve correct state and event ordering, not just shorten animation duration.

Audit every current CSS rule into required behavior, optional appearance, or portfolio-specific presentation. Replace `@scope` dependence with explicit data-attribute isolation; test both stylesheet orders against application overrides. Preserve accessible state hooks and document motion variables so consumers can customize appearance and coordinated effects without replacing the engine. Keep the existing `./styles.css` path during migration; settle the behavior/appearance export names before beta. Verify two substantially different application-designed viewers using the same parts and behavior styles, including custom captions, controls, and filmstrip placement. Both must pass interaction and accessibility checks without relying on an example theme.

## Delivery order and exit criteria

| Stage                             | Work                                                                                                                                                                | Exit condition                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Protect interactions           | Add motion/ownership regression scenarios, physical-device baseline, supported-browser policy, and calibrated performance measurements                              | Baseline artifacts and thresholds checked in; automated continuity tests cover interruptions, zoom handoff, rebasing, and stale origins; physical-device results recorded                                                                      |
| 1. Contract spike                 | Write source, media, state, command-result, renderer, and part attachment types; runnable JS and composed React prototypes                                          | Both consume the same responsive-image source; demonstrate portal controls, framework context, bounded custom-content mounting, source replacement, interrupted commands, and failed loading; unresolved decisions below have recorded answers |
| 2. Incremental runtime extraction | Introduce controller behind existing elements, transfer session/portal ownership, then connect existing gesture/zoom/gallery modules and expose direct construction | Existing DOM interactions and media remain usable; stage 0 gates pass; no physics rewrite bundled into extraction; SSR imports, cleanup, and dependency boundaries pass                                                                        |
| 3. Headless image beta            | Complete responsive loading, composed JS/React/element APIs, source updates, accessibility, structural CSS, labels, captions, and documentation                     | Two distinct custom UIs pass without a theme; hydration/Strict Mode and virtualized-source examples pass; cold/warm loading and total activation budgets pass; publish a prerelease                                                            |
| 4. Integration and media          | Use beta in portfolio and an independent consumer; complete video/iframe/custom renderer lifecycle; pilot one demanded CDN provider                                 | Consumer feedback resolves API ownership issues; mixed-media lifecycle/native-input tests and physical-device checks pass; adapter has provider tests and remains optional                                                                     |
| 5. Framework parity               | Implement idiomatic composed Solid, Vue, and Angular APIs over the proven contract                                                                                  | Each binding passes the same source/lifecycle/portal scenarios plus framework-specific hydration, context, updates, and teardown checks                                                                                                        |
| 6. Stable release                 | Finalize names, license, exports, migration guide, browser support, docs, clean installs, CDN module example, changelog, and semver                                 | CI and physical-device gates pass; clean consumer installs and portfolio integration pass; public claims match measured evidence; tag 1.0                                                                                                      |

Stages 0–3 define the image beta. All listed framework bindings remain the 1.0 target; they do not delay image-beta feedback. Named CDN provider count and a registry recipe are not release gates. A later shadcn recipe should install editable composition/style code depending on the maintained runtime, never a copied gesture implementation.

## Decisions to close in the contract spike

These need runnable evidence, not only names in a type definition:

1. Exact part attachment and renderer signatures, including how portal controls and bounded custom-content targets are exposed consistently to plain JS and frameworks.
2. Controlled-state callback order and the point at which an unaccepted gesture returns to committed state. Test delayed acceptance without positional jumps. Specify proactive host reveal timing and cancellation. Closing must remain immediate and fall back when the matching origin is unavailable.
3. Abort behavior for each command and metadata lookup failure recovery. Supply event traces for all terminal outcomes and interruption combinations.
4. Origin registration/identity validation across recycled DOM and open shadow roots, including caller-selected focus fallback.
5. Responsive picture art direction, missing dimensions, and source changes while zoomed. Document fallback sizing and when geometry can change.
6. Finite gallery boundaries, optional looping scope, and the semantics of previous/next during pending navigation. Finite navigation is the initial implementation; looping requires separate rebase/continuity proof.
7. Multiple viewers and application overlays. Define active-session ownership, focus/inert restoration, and stacking without replacing the body portal.
8. Required behavior styles, supported customization constraints, final part/element names, and migration from current tags.

## Deferred work

Unknown-length async pagination, arbitrary provider fetching in navigation, persistent offscreen custom-content trees, enormous-image tiling, a general plugin framework, numerous CDN providers, preset viewers, slideshow, fullscreen/share/download utilities, URL-history integration, and a shadcn registry recipe are not prerequisites for the headless image beta. Preserve enough commands, state, and composition points for applications to implement optional controls without depending on private DOM. Add dedicated runtime behavior only when a proven use case and interaction tests justify it.

## Framework and registry references

These are design references, not selected dependencies: [Kobalte's Solid dialog parts](https://kobalte.dev/docs/core/components/dialog/), [Reka UI's Vue composition](https://www.reka-ui.com/docs/guides/composition), [spartan/ui's Angular dialog and directives](https://www.spartan.ng/components/dialog), and [shadcn's registry format](https://ui.shadcn.com/docs/registry/getting-started). Use separate native APIs over one runtime rather than forcing identical component syntax on every framework.
