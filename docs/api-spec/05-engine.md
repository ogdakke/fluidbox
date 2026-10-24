# 5. Engine additions

Two real additions: the media box as the flight and zoom target for content the framework renders
(`Fluidbox.Media`), and making every open wait until the opened slide is ready (`waitUntil` for what the engine
can't see). Everything else in this redesign is naming and binding work on top of the existing
engine.

File and line references are to `packages/fluidbox/src` at `59cb944`.

## 5.1 The media box

### How it works today

A slide is built by `ViewerStrip.#makeSlide` (`viewer-strip.ts:428-557`):

```
[data-fluidbox-slide]                      element
  [data-fluidbox-frame]                    frame: clips and rounds; overflow hidden
    [data-fluidbox-slide-placeholder]      images only
    [data-fluidbox-slide-preview]          images only
    <picture> > <img data-fluidbox-media>  type "img"
    <video data-fluidbox-media>            type "video"
    <iframe data-fluidbox-media> + cover   type "iframe"
    <div data-fluidbox-media data-fluidbox-item-content role=group>   type "custom"
    [data-fluidbox-error]
```

`ViewerSlide.image` holds the `data-fluidbox-media` element, whatever its type
(`viewer-strip.ts:29`, `:547`). It is sized from the item through `--fluidbox-media-aspect` and
`--fluidbox-item-width/height` (`styles.css:344-357`, `:452`), never from its content.

The driver reads the current slide's frame and media through two getters
(`dom-viewer-driver.ts:1024-1030`) and uses them for:

| What                                          | Where                                                                                  | Type-specific?                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opening flight: start pose, motion, keyframes | `#plan`, `#openingStart`, `#applyMediaPose`, `#animatePose` (`:660-701`, `:1137-1180`) | No. Any element: it reads `offsetWidth/Height`, the bounding box and transforms (`image-transition-motion.ts:19-91`).                                                              |
| Closing flight                                | `close` (`:765-930`)                                                                   | Partly. A non-image media element is moved into the body-level flight layer itself (`:1541`); media holding `iframe`, `video` or `audio` closes in its frame instead (`:823-827`). |
| Drag to dismiss                               | `#dragGesture` with `#frame`/`#media`                                                  | No.                                                                                                                                                                                |
| Zoom                                          | `#prepareZoom` (`:1474-1500`)                                                          | **Yes**: returns `null` unless `#media instanceof HTMLImageElement`.                                                                                                               |
| `state.zoom`                                  | `#zoomFor` (`create-fluidbox.ts:482`)                                                  | **Yes**: `null` unless `item.type === "img"`.                                                                                                                                      |
| Sharper image on zoom                         | `ViewerStrip.sharpen` (`viewer-strip.ts:837-905`)                                      | **Yes**: images only.                                                                                                                                                              |
| Media size published as CSS                   | `#trackMedia` (`:1057`)                                                                | No.                                                                                                                                                                                |

So the flight already flies a custom slide's content box. What doesn't exist is: zoom for anything
but an `<img>`, a way for framework content to be _part_ of the box while other content is not,
and the built-in image inside a custom slide.

### The design

Every slide gets two runtime-owned targets:

```
[data-fluidbox-slide]
  [data-fluidbox-frame]
    … placeholder, preview (images) …
    [data-fluidbox-media]          the box: built-in media, or a div for your own
    [data-fluidbox-error]
  [data-fluidbox-slide-layer]      new: over the slide, beside the frame
```

1. **The box stays the runtime's element.** For built-in types it is the `<img>`, `<video>` or
   `<iframe>`, exactly as now. For any other type it is the `div` that is
   `data-fluidbox-item-content` today. The renderer gets it as `slide.media`.
2. **`<Fluidbox.Media>` puts framework content inside the box**, through the binding's portal
   mechanism. It does not render an element that becomes the box. The reason is in "Why the box
   can't be a framework element" below.
3. **The layer** gets everything a slide renders outside `Media`. It is positioned over the slide
   (`position: absolute; inset: 0; pointer-events: none`, its children `pointer-events: auto`), so
   it scrolls with the slide during a swipe. It doesn't fly or zoom. It is hidden during the
   flights and fades in with the controls (`fluidbox-gallery-controls-appear`, the animation
   `open` already waits for at `:714-723`), and fades with `--fluidbox-dismiss-progress` during a
   drag. A zoomed box covers it; `[data-zoomed] [data-fluidbox-slide-layer]` can hide it.
4. **Zoom acts on any zoomable box.** `#prepareZoom` checks `slide.zoomable` instead of
   `instanceof HTMLImageElement`, and returns `{ image: box, frame }`. The zoom engine already
   types its target as `HTMLElement` (`fluidbox-zoom.ts:12`) and only reads `offsetWidth/Height`
   and transforms. Its `carrier()` (`:39`) moves the `<picture>` when the target sits in one, else
   the target itself: for a custom box, that is the runtime `div`, with the framework's nodes
   inside it.
5. **Zoomability is per slide.** Built-in images are zoomable. A custom box is zoomable when its
   renderer calls `slide.zoomable(true)` (the `Media zoom` prop does) or draws a built-in image
   with `slide.drawImage()`. The driver tells the controller when the current slide's zoomability
   changes; `#zoomFor` reads that instead of `item.type`.
6. **`drawImage`, `drawVideo`, `drawIframe` draw built-in media into a custom box.** This needs
   `#makeSlide` and `#load` split so that "build the media for an item" is a function of a
   target box, not of the slide's item type. `ViewerSlide.image` becomes two fields: `media` (the
   box) and `image` (the `<img>`, when one is drawn, by the built-in path or by `drawImage`).
   `sharpen`, `#applyImage`, `#revealImage`, `#painted` and `#showsFull` take `slide.image`.
7. **An empty box doesn't fly.** If the box has no child nodes when the open plans its flight
   (and isn't a built-in media element), the open runs the no-origin path (`#openingStart` with no
   origin: grow and fade from the centre) and the close fades in place. The bindings append their
   mount host to the box synchronously when `Media` mounts, so a slide with a `Media` is never
   "empty" even before the framework has rendered into it.

### Why the box can't be a framework element

The brief asks for `Media` to make "an element the framework rendered the target of the flight and
the zoom". Three things in the code rule that out:

- **The zoom moves its target.** `FluidboxZoom` moves `carrier(image)` into its scroller and puts a
  placeholder in its place (`fluidbox-zoom.ts:175-243`). The close flight moves non-image media
  into the body-level flight layer (`dom-viewer-driver.ts:1541`). If that element is a framework
  node, the framework's own removal later fails. The spike below shows React throwing
  `removeChild` and leaving the node in the page. `docs/PUBLIC_API.md` already states the rule:
  "the runtime never reparents a framework-owned node".
- **The box must be measurable before the framework renders.** The opening flight measures the
  box in the frame after the strip mounts (`:657`, one `requestAnimationFrame`), and a prepared
  open measures it at press time (`prepare`, `:544-572`). Framework rendering lands in a
  microtask at best. The runtime box is sized from `item.width/height`, so it is right from the
  first frame.
- **The virtualised strip and the server copy work from data.** Slides outside the window have no
  framework content, and the static viewer is built without any (`static-viewer.ts:79`). Both
  need the box to exist without the framework.

What the framework element _can_ be is the content that fills the box. Visually the result is what
the brief describes: `<Fluidbox.Media><canvas/></Fluidbox.Media>` flies and zooms the canvas.

### Spike

A throwaway page in `/tmp/fbspike` (React 19 from the workspace, Chromium through Playwright).
A component renders `<canvas>` through `createPortal` into a box, then unmounts:

| Case | What moves before the unmount                    | Result                                                                                                                                            |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | the canvas itself, into another element          | `onUncaughtError`: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node." The canvas stays in the page. |
| B    | the box holding the portal, into another element | unmount succeeds; the canvas is gone.                                                                                                             |

Case A is what the zoom does to its target today. Case B is what this design does. Vue's and
Solid's renderers remove nodes from their recorded parent the same way, so the same holds; the spike
didn't test them.

### Constraints

- **Virtualised slides.** Renderers run when a slide loads (within one of the current slide) and are
  disposed when it unloads (`#load`, `viewer-strip.ts:907`; `#unload`, `:1014`). `media` and `layer` are emptied after the
  disposer, as `target` is today. The bindings keep one mount host per slide mount, so the
  framework removes its nodes from a host the runtime has already detached, which is safe (the
  reason for `data-fluidbox-mount` today, `react/src/index.ts:256-275`).
- **Zoom across unloads.** A box held by the zoom when its slide unloads (a `setItems` while zoomed)
  must be put back before `#unload` empties it. The driver already calls `zoom.release()` on select
  and `zoom.suspend()` on close; `setItems` must call `suspend()` before the strip unloads changed
  slides. Add a test (§9.4).
- **Server-rendered open viewer.** Unchanged: the static copy is built only for image items
  (`static-viewer.ts:91`), with no layer content. A page that starts open on a custom type renders
  no copy and opens once hydrated, as today.
- **Reduced motion.** No flight, as now (`:659-670`). The layer shows at once.
- **Interruptions.** A gesture that interrupts a flight takes the painted pose from the box, as now
  (`#takeInterruptedPose`). Nothing changes, because the box is the same element the flight
  animated.
- **Iframes and video in custom content** still close in their frame (`:823-827`): the check looks
  inside the box, which still holds them.
- **Box attributes.** `Media`'s HTML attributes land on the runtime's box, merged and restored as
  `Sheet` does with its section (`applyAttributes`, `react/src/index.ts:887`). `transform`, `width`, `height` and
  `aspect-ratio` remain the runtime's; a `style` setting them is overwritten.

### Risks

| Risk                                                                                                                                 | Where                      | Mitigation                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Splitting media building from item type touches the most tuned code in the strip (decode staging, preview swap, sharpening).         | `viewer-strip.ts:440-1200` | Keep the built-in path's DOM and order exactly; move code, don't change it. The flight, zoom and media browser suites (§9.4) cover it.                                                                   |
| `prepareOpening` paints the trigger's thumbnail into the slide's preview before the framework has drawn a custom slide's image.      | `viewer-strip.ts:559`      | `drawImage` reads the thumbnail `prepareOpening` stored for that index and paints it on creation. Every open waits for the slide's commit (§5.3), so the `Image` part has drawn before the flight plays. |
| A custom slide matching its trigger: `originMatchesItem` compares image sources only for `img` items, so a product slide crossfades. | `origin-match.ts:41`       | Compare against the drawn image's sources when the slide has one.                                                                                                                                        |
| `state.zoom` arrives a moment after the slide opens for custom zoomable boxes, so a zoom control may flash disabled.                 | controller ↔ driver        | The `Media zoom` prop sets zoomability while the binding mounts, before the open settles; `state.zoom` is only non-null once `status` is `"open"` anyway.                                                |
| The layer sits inside the strip's scroller, so wide layer content could widen the slide.                                             | CSS                        | The layer is `position: absolute; inset: 0; overflow: clip`.                                                                                                                                             |

## 5.2 What zoomable means for state and controls

`state.zoom` is non-null while open on a zoomable slide with the Root's `zoom` on. The zoom
controls disable from it, as now. The `+`, `-` and `0` keys, pinch, double-tap and ctrl-wheel
already go through `#prepareZoom`, so they follow.

Content with `data-fluidbox-owns-input` keeps its gestures inside a zoomable box, as today
(`fluidbox-zoom.ts:52`).

## 5.3 Waiting for the opened slide

Every open waits for the slide being opened to be ready, at most 3 seconds, before its flight
starts. There is no flag to turn it on.

### Need

A live 3D thumbnail that flies into a synced 3D viewer has to paint its first frame in the viewer
before the flight starts, or the flight lands on a blank canvas. The same goes for a custom slide
whose `<img>` hasn't decoded: today it flies an empty box and the picture pops in after. ramka
solves the first case at the root with `onBeforeOpen`, which "runs after the lightbox is mounted
hidden — so destination nodes exist — and before `startViewTransition`". It leaves the timeout to
the app, and aborts `ctx.signal` when a newer open wins (ramka.dev/docs/lightbox/state-lifecycle).

### Why waiting can be the default

A bare `ready()` that a slide may or may not call can't work: the engine can't tell a slide that
will call it from one that never will, so it would wait out the cap on every open. The engine
doesn't need to be told, though. Every slide's content lands in a short mount window the engine
already waits through:

| Content                                                 | Window closes when                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Built-in media (`drawImage`, `drawVideo`, `drawIframe`) | synchronously, as the strip makes the slide                                      |
| A plain-JS renderer                                     | it returns                                                                       |
| React                                                   | the slide's layout effect runs (the mount store's change renders in a microtask) |
| Vue                                                     | the slide's `onMounted` (after `nextTick`)                                       |
| Solid                                                   | the slide's `onMount` (rendering is synchronous)                                 |
| Angular                                                 | after the mount's `detectChanges()` (`angular/src/mount.ts:49-63`)               |
| Custom elements                                         | the slide template is stamped (synchronous)                                      |

Each binding tells the core when the slide's content has committed (§9.2, step 2). The engine waits
for that commit, then reads what is in the media box. A slide that needs nothing more is ready at
commit, which is before the frame the flight would start in anyway.

### Readiness

Once the slide has committed, the engine infers readiness from the media box:

- Every `<img>` in the box has decoded (`decode()` resolves or rejects).
- Every `<video>` has `readyState >= HAVE_CURRENT_DATA`, or its `poster` has decoded.
- Iframes are not waited on. An iframe can take seconds and the slide already covers it, as
  the embed facade does with its poster image, which is waited on.
- Built-in media keeps today's rules exactly. A normal open flies on the trigger's own picture,
  which `prepareOpening` paints into the slide already decoded (`viewer-strip.ts:559`), and the full
  image sharpens after the flight (`sharpen`, `:837`). So a built-in image adds no wait. The
  instant open (server takeover) keeps `#mediaReady` (`dom-viewer-driver.ts:957`). Applying the
  generic `<img>` rule to built-in images would wait for the full-size image and slow every photo
  open, so the drawn image is exempt.
- An empty box is ready at commit. It opens with a fade, as in §5.1.
- Content in the slide layer, outside `Media`, never holds the open.
- `slide.waitUntil(promise)` adds a promise the open also waits for.

### `waitUntil`

For what the engine can't see in the DOM, such as a WebGL canvas having painted. It is modelled on
`ExtendableEvent.waitUntil`.

```ts
// plain JS, in a slide renderer
slide.waitUntil(renderer.render(scene));

// React, Vue, Solid
const { waitUntil } = useFluidboxSlide();
useLayoutEffect(() => waitUntil(firstFrame(canvas)), []);

// Angular
readonly slide = injectFluidboxSlide();
// in ngOnInit or the constructor: this.slide.waitUntil(firstFrame(canvas));
```

- Calls before the slide commits always count: during render, a layout effect, `onMounted`,
  `onMount`, `ngOnInit`, or a renderer's body. A call after commit counts if the flight hasn't
  started yet.
- A call once the flight is under way doesn't delay it. Development builds warn.
- A rejected promise counts as settled. The open goes ahead and the slide shows its own error
  state.
- Outside an open (moving between slides, or a neighbour mounting) the promise is ignored.

The add-ons call it themselves, so app code never does it for them (§4):

| Add-on | Waits for                                                                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model  | `<model-viewer>`'s first rendered frame (its `load`, then one `requestAnimationFrame`); with a live `<model-viewer>` thumbnail as the trigger, a frame drawn with the thumbnail's camera (orbit, target, field of view) copied over |
| Spin   | its first frame's `decode()`                                                                                                                                                                                                        |
| Embed  | its poster's `decode()` (the generic `<img>` rule would cover it; the add-on says so explicitly)                                                                                                                                    |

### Semantics

- Only the slide being opened counts. Neighbours that mount at the same time don't delay it.
- The open waits for commit, then for readiness, at most **3 seconds** in total: the same cap the
  instant open uses (`#mediaReady`). At the cap the flight starts anyway. Development builds warn
  and name what was still pending (an `<img>` src, a `<video>`, or a `waitUntil` promise).
- While waiting, the card keeps its thumbnail painted (`#keepThumbnailVisible`, already called at
  the start of `open`), `state.status` is `"opening"`, and keys work as they do while the viewer's
  code loads (`#whileWaiting`, `:987`): Escape calls the open off, the arrows retarget it.
- Retargeting to another item waits for that slide instead.
- The wait races the open's `signal`. A close, a newer open, `setItems` or `destroy` ends it, and
  the open is abandoned like any other interrupted open (`#abandonOpen`).
- Reduced motion: the open still waits, so the viewer doesn't appear on an unpainted canvas. It
  then appears without a flight.
- The instant open (server takeover) waits too, alongside `#mediaReady`, so the server copy stays
  until the slide is ready.
- A prepared open (pointerdown) builds its plan as now. The box is sized from the item, so the
  plan doesn't need the content. The wait delays playing the plan, not building it.

### Cost

- **Photos: none.** Built-in images open as now: the trigger's decoded picture is the slide's
  first paint, and commit is synchronous. Videos and iframes drawn by the runtime likewise.
- **Custom slides: their content's decode.** A product slide with a `<Fluidbox.Image>` costs
  nothing (it draws through `drawImage`). A slide with its own `<img src="large.jpg">` now waits
  for that image instead of flying an empty box. That is the point of the change, but it is new
  latency.
- **Models: the most.** A cold model open waits for the `<model-viewer>` script, the model file
  and a first frame. On a slow connection that is the 3 s cap; the open then flies on the poster
  as today.

The press hides most of it. `prepare` runs on pointerdown and mounts the slide
(`prepareOpening` → `#load`), so the content starts decoding 50–150 ms before the click that opens
it. The wait begins then, not at the click. With `preload: "intent"` the viewer's code is already
loaded on hover. Apps can also call `fluidbox.preload(target)` on hover to warm a heavy slide.

The plan adds a latency test: image-open latency, from click to the flight's first frame, must not
regress against today's (§9.4).

### Where it goes

In `DomViewerDriver.open`, between the frame wait and the reduced-motion branch (`:657-659`):

```ts
if (!prepared) await nextFrame();
if (abandoned()) return;
await this.#whileWaiting(this.#strip.ready(context.index, 3000), context.signal); // new
if (abandoned()) return;
if (this.#prefersReducedMotion()) { … }
```

and in the instant branch next to `#mediaReady()`. `ViewerStrip` keeps per slide a commit
deferred, resolved by the binding's report (or synchronously for built-in media and plain-JS
renderers), and a list of `waitUntil` promises. `ready(index, cap)` awaits the commit, then reads
the box (`img.decode()`, video `readyState` or poster), adds the `waitUntil` promises, and races
`Promise.allSettled` of them against the cap. `#unload` resolves everything for a slide it drops.

Since the wait already covers commit, the `prepareOpening` gap in the risks table closes: a custom
slide's `Fluidbox.Image` has drawn before the flight plays.
