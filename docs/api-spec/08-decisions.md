# 8. Open decisions

(a)–(d) are the four the brief names. §8.5 onwards are smaller decisions made while writing the spec,
listed so they can be overturned on purpose. Each has a recommendation; the rest of the spec
assumes it.

## 8.1 (a) Is `value` the open item's id?

**Recommendation: yes. `value: string | null`, a request rather than a lock.**

Options:

1. `value` = id or `null` (the default in the brief).
2. ramka's split: `open: boolean` plus `value: number` (an index), with `onOpenChange` and
   `onValueChange(value, source)`.
3. Today's split: `open` plus `index`.

For (1):

- **One change, one call.** Today an open fires `onOpenChange(true)` and `onIndexChange(i)`, and the
  URL example has to ignore one of them (`apps/examples/src/patterns/react/url.tsx`). With one value
  an open is one call with `details.action === "open"`. ramka has the same double call.
- **Ids survive data changes.** An index into `items` points at a different photo after a
  filter, a sort or an insert at the top; an id does not. The runtime already keys everything on ids
  (`idOf`, `items.ts:21`; slides are reused across `setItems` by id), so the binding converting an
  index back and forth is extra work in the wrong direction.
- **It matches the controls libraries apps already use.** Radix Tabs, Select and Accordion, and Base
  UI's equivalents, use a string `value`; Radix and Base UI Dialog use `open`. A lightbox is both a
  dialog and a selection, and the selection part is the one with more than two states, so `value`
  with `null` for closed covers both without a second prop.
- **URLs want ids.** `?photo=fjord` is stable; `?photo=3` is not.

Against (1), and what the spec does about it:

- _Closed-but-remembering._ With a split, the Root can know "index 3" while closed, so the viewer
  reopens where it was. With one value, closing loses it. The trigger's `preview` already remembers
  the last item per trigger (the album pattern), which is where that memory is used; nothing else
  in the patterns needs it.
- _Index-based code._ `fluidbox.open(2)` stays in plain JS, and `state.index` stays, so a counter
  or "open the third" button needs no lookup (§2.4). Only the controlled prop is an id.
- _Lists without ids._ Items without `id` get a derived one (`src`, then `src#2`…,
  `items.ts:140`), so `value` always exists. The docs say: give items ids if you control `value`.

**Request, not lock.** A controlled `value` asks the viewer to go there; the viewer moves on Escape,
swipe, Back, or arrow keys without waiting for the app, and calls `onValueChange` first so the app
can `details.cancel()`. Base UI does the same: `onOpenChange` with `eventDetails.cancel()`, rather
than React's strict controlled-input model. A strict lock would make the viewer wait a render
before each move, and the flight, focus trap and history entry all start in the same frame as the
gesture. Current behaviour (`controlled.ts:21`) is already a request; the change is the cancel.

## 8.2 (b) Does the namespace stay `Fluidbox`?

**Recommendation: yes. `Fluidbox.Root`, `Fluidbox.Trigger`… in React, Vue and Solid; `fluidbox*`
selectors in Angular; `<fluidbox-*>` elements.**

The alternatives were a generic name (`Lightbox.Root`, as ramka uses) or flat exports (`Root`,
`Trigger`, as Radix's packages export alongside the namespace). A generic name collides with every
other lightbox in a codebase being migrated, which is exactly the user the library wants. Flat
exports can be added later without breaking anything.
The cost is length (`Fluidbox.ZoomControls`), which `import { Fluidbox as F }` solves for anyone
who minds.

Today the React binding exports only the namespace object (`react/src/index.ts:1097`), and the
spec keeps it that way. The parts are small and nearly always used together, so flat names would
save little, and one spelling keeps the docs and autocompletion consistent.

## 8.3 (c) One `Slides` prop per type, or one render function?

**Recommendation: one prop per type, plus `default`.**

```tsx
<Fluidbox.Slides note={() => <Note />} model={() => <Model load={load} />} />
// against
<Fluidbox.Slides>{(item) => item.type === "note" ? <Note /> : item.type === "model" ? … : null}</Fluidbox.Slides>
```

For props per type:

- **Lookup and narrowing.** `FluidboxSlides` is a mapped type over `FluidboxItemTypes`
  (§2.7), so each prop's slide is typed to that item: `note` gets `NoteItem`. A single function
  narrows only with a `switch` the app writes.
- **The built-ins stay built in.** A type with no prop falls through to the built-in slide (image,
  video, iframe), then `default`, then the error slide. A single function has to return `null` for
  "use the built-in", and forgetting that case drops every photo.
- **The runtime can tell which types are framework-rendered without calling anything.** That
  matters for preparing a slide before it mounts (the strip loads one either side, §5.1): the
  runtime knows a `note` slide needs a portal, and knows an image doesn't.
- **It matches plain JS and the elements.** `slides: { note, model }` in `createFluidbox`;
  `<template data-fluidbox-slide="note">` in markup; `<ng-template fluidboxSlide="note">` in Angular.
  yet-another-react-lightbox takes a single `render.slide` function and custom slide types by
  declaration merging (`SlideTypes`); the spec takes the merging and not the single function,
  because its users end up writing the type switch in every app.

`default` covers the "one function" case for apps that want it: `<Fluidbox.Slides default={…} />`
is called for every type without a prop, built-ins excepted. Vue gets the same as named slots
(`<template #note>`), which is how Vue writes "one render per key".

## 8.4 (d) `Model`, `Embed`, `Spin`, or `ModelViewer`, `EmbedViewer`…?

**Recommendation: `Model`, `Embed`, `Spin`, imported from `@ogdakke/fluidbox/<framework>/<addon>`.**

They are slide content, not viewers; `Fluidbox.Viewer` is the viewer. The names match the item
types (`type: "model"` → `<Model />`) and the entries (`/model`). `ModelViewer` would also be read
as a wrapper of Google's `<model-viewer>`, which the part loads but is not. In Angular the
selectors are `fluidbox-model`, `fluidbox-embed`, `fluidbox-spin` for the same reason (§4.4).

They are not members of the `Fluidbox` namespace: the namespace comes from the core entry, and
putting add-on parts on it would pull the add-ons into every page.

## 8.5 Plain JS: one event family

**Recommendation: `beforevaluechange`, `valuechange`, `valuechangecomplete` replace `beforetoggle`,
`toggle`, `beforeitemchange`, `itemchange` and `settle`.**

Plain JS could have kept open and item events separate (they are DOM-like: `<dialog>` has
`beforetoggle`/`toggle`). But the bindings would then translate two families into one `value`
again, and the reason they exist is that an open is both. Each event carries `action`
(`"open" | "move" | "close"`), so code that cared only about toggling checks `action`. The names
mirror the bindings' `onValueChange` and `onValueChangeComplete`, so the docs teach one set.
`zoomchange` and `sheetchange` stay as they are: they are other state.

Cost: listeners that used `toggle` to lazy-load something change to
`event.action === "open"` (getting-started.md:85-91 is the one docs case, §6.14).

## 8.6 Waiting for the slide is the default

**Decided (the user's call, replacing the opt-in this spec first proposed): every open waits for
the opened slide to be ready, at most 3 s. `slide.waitUntil(promise)` covers what the engine
can't see.**

The brief's sketch was a bare `ready()` on the slide. That can't work alone: a slide that might
call `ready()` later can't be told apart from one that never will. The first draft of this spec
made the hold opt-in (`holdOpen`). The user asked for waiting to be the default instead, and that
works because the engine doesn't need to be told whether to wait. Every slide's content lands in
a mount window the engine waits through anyway: a React microtask, Vue's `nextTick`, Solid
synchronously, Angular's `detectChanges()`, a renderer's return. The bindings report the commit.
After it the engine reads the box: images decoded, videos able to show a frame. Then it waits for
any `waitUntil` promises.

Compared with ramka's `onBeforeOpen` (a root callback, no time limit): the wait sits on the slide,
where the canvas and its "painted" signal live, and keeps the 3 s cap, so a slide that never
settles still opens. A root-level hook can be added later on top of the same wait.

The trade is latency for custom slides. A slide whose own `<img>` hasn't decoded used to fly an
empty box at once; now it waits for the image. Photos are unaffected, because built-in media keeps
today's rules. The pointerdown preparation starts the wait before the click. §5.3 has the details
and the costs, and §9.4 has the latency test.

## 8.7 Two layers in a slide, and Media holds framework content

**Recommendation: as in §5.1. The runtime owns the media box; `Fluidbox.Media` portals content into
it. Content outside `Media` goes in the slide layer and fades.**

The brief asked for `Media` to be the flight and zoom target. The spike (§5.1) showed React cannot
own a node the zoom moves into its scroller: unmount throws `removeChild` and leaves the node. So the
target is the runtime's box and the framework renders into it. The visible API is what the brief
wanted (`<Fluidbox.Media>` marks what flies); only the ownership differs.

## 8.8 The `preload` name

**Recommendation: keep `preload` for the option (the brief's name), and document the overlap.**

`preload` now names three things: the option (`"intent" | "press" | "eager"`), the
`fluidbox.preload(target)` method that warms one item, and a video item's `preload` field. They
mean the same thing at three scopes (the whole viewer, one item, one video's bytes), so the
overlap reads as consistent rather than confusing. The alternative, `load` (as on today's
`load()` method) or `loading` (today's name, which clashes with `<img loading>` and means
something else there), is worse. If reviewers disagree, `loadViewer` is the fallback name.

## 8.9 The `Overlay` name

**Recommendation: keep `Fluidbox.Overlay` for the trigger decoration that flies, and rename the
viewer root's attribute to `data-fluidbox-viewer`.**

In Radix and Base UI, `Dialog.Overlay`/`Backdrop` is the dimmed layer behind the dialog. Here it
is a badge on a trigger. The brief named it; the alternatives (`TriggerOverlay`, `Badge`,
`Decoration`) are either long or too narrow (`frame` overlays aren't badges). The docs page for it
says in its first line that the backdrop is `data-fluidbox-backdrop`, styled with CSS, not a part.
The attribute is `data-fluidbox-trigger-overlay` so CSS selectors are unambiguous.

## 8.10 Hook names keep the prefix

**Recommendation: `useFluidbox`, `useFluidboxSlide`, `useFluidboxSheet`; Angular `injectFluidbox`,
`injectFluidboxSlide`, `injectFluidboxSheet`; Vue and Solid the same names as React.**

The brief sketched `useSlide`. The existing hooks have the prefix, and `useSlide` is taken by
Swiper and Embla wrappers in many codebases; an auto-import of the wrong one fails at runtime.

## 8.11 Element slide templates

**Recommendation: `<template data-fluidbox-slide="note">`, not `<template slot="note">`.**

`<fluidbox-gallery>` already uses the slots `trigger`, `content`, `sheet` and `viewer`
(`item.ts:107`, `gallery.ts:682`); an item type named `content` would collide. An attribute also lets a template sit
anywhere inside the gallery, not only as a direct child.

## 8.12 Angular minimum version

**Recommendation: keep Angular 17.3 (signal `input()`, `model()`, `output()`).**

`model()` is what makes `[(value)]` work without a hand-written `valueChange` output, and it landed in
17.2; 17.3 is the binding's current floor. The overlay example (§6.2) would be cleaner with `@let`
(18.1), but one template expression is not worth dropping 17.x. Revisit when 17 leaves LTS.

## 8.13 No deprecation path

**Recommendation: none.** The package is `0.0.0` and unpublished. Old names are removed in the same
change that adds the new ones; the inventory (part 1) is the migration table for the examples and
docs in this repo, and nothing outside it depends on the old names.

## 8.14 The third amendment: ten additions

**Decided (approved by the user):** fullscreen, download and share, a media error event, turning
gestures off, styling by item, motion speed, hotspots, deep zoom (after 1.0, as an add-on), a
slideshow and `reachend`. Items 1–5 are built in steps 1 and 2; items 6–10 in a new step 7, after
React (§9.2). The decisions below are the refinements made while specifying them. Each is
recommended, and can be overturned on its own.

## 8.15 `wheel` names today's behaviour

**Recommendation: `wheel: "dismiss" | "zoom" | "navigate" | "none"`, default `"dismiss"`.**

The sketch had `"zoom" | "navigate" | "none"` with "today's behaviour" as the default. Today a
vertical wheel on an unzoomed slide dismisses the viewer (`#onWheel`,
`dom-viewer-driver.ts:2184`). An option whose default can't be written as one of its values is
hard to document and to set back, so it gets a name.

## 8.16 One `dismiss`

**Recommendation: the Root's `dismiss: { drag, backdrop }` keeps the name; the sheet's
`dismiss: "flight" | "scroll" | "none"` becomes `dismissMotion: "flight" | "scroll"`.**

The two answered different questions: "what may close the viewer" and "how does the photo leave
when it does". The sheet's `"none"` was the first question asked in the wrong place, and it equals
`dismiss: { drag: false }`.

## 8.17 Unavailable controls are hidden

**Recommendation: Fullscreen, Download, Share and Slideshow get `hidden` when they can't work
(iPhone, an item with no file, no Web Share and no clipboard, no `slideshow` option).**

`disabled` suits a control that will work later in the same session, as Previous at the first
slide does. A control that never works on this device or item would be a dead stop in the tab
order. Apps that want a placeholder style `[data-fluidbox-download][hidden]`.

## 8.18 Motion speed is a CSS property

**Recommendation: `--fluidbox-motion-speed`, read when each motion is planned. No JS option.**

That was the user's preference. It varies by breakpoint, theme or container like any custom
property, and costs one `getComputedStyle` per flight, which the planner already pays for layout.
A JS option would need `update()` plumbing and would only duplicate it. The strip's native smooth
scroll can't be timed, so at a speed other than 1 the strip animates the scroll itself (§2.16).

## 8.19 The slideshow never starts by itself

**Recommendation: off until `play()` or `autoplay: true`; any interaction pauses it; the live
region goes quiet while it plays.**

WCAG 2.2.2 requires a way to pause motion that starts automatically and lasts over five seconds.
Starting only on request, pausing on interaction and keeping the control reachable go past the
minimum. Resuming after a tab comes back is limited to pauses the tab caused, so a user's pause
always sticks.

## 8.20 The new parts ship in the binding entries

**Recommendation: as the overseer specified. Fullscreen, Download, Share, Slideshow and Hotspot are
in `@ogdakke/fluidbox/react` (and each binding), with their logic in the lazy viewer chunk.**

Each part is a button or anchor calling a command, 60–120 B gzip, so separate entries would cost
more in import lines than they save. The behaviour (fullscreen dance, fetch-to-blob, share
fallback, slideshow timer, hotspot layout) lives in the viewer chunk, which loads on intent
anyway. The exception is deep zoom, whose tile code is its own add-on entry. If the React initial
measurement comes in over the estimate (§9.3), Slideshow and Hotspot are the two to move to
`@ogdakke/fluidbox/react/slideshow` and `/hotspot`, since step 7 hasn't shipped them yet.

§8.24 revisits this after the fourth amendment.

## 8.21 Headless: no icons, functional CSS only

**Decided (the user, fourth amendment):** "I'm not super into having any icons baked in.
Consumers should bring their own icons. … I would like to lean more into headless, with just the
default styles we need to make things function, and everything else on the consumer."

So the package's JavaScript draws no icons (§2.21). Controls without content render their label as
text. `styles.css`, `thumbnails.css` and `sheet.css` keep only the rules without which layout,
gestures, flights, zoom or structural accessibility break (part 10). This is what Radix and Base UI
do. It is a break from PhotoSwipe and yet-another-react-lightbox, which ship a full skin; the
baseline stylesheet (§8.22) covers the people who want that.

## 8.22 An opt-in baseline stylesheet in the package

**Decided (the user, clarifying):** "ofc we'd provide a baseline, maybe in docs or in a stylesheet
you can import that'd give the default styles (still easily overridable), but the core should be
headless."

The spec first recommended a docs-only starter, with an importable file as the alternative. The
user chose the file. So `@ogdakke/fluidbox/baseline.css` ships, is imported by no entry, and is
also printed in the docs for anyone who would rather copy and own it (§10.4).

- The name is `baseline.css`, not `theme.css`. It is the user's word, and "theme" suggests one of
  several to choose from.
- It is one file covering the viewer, the thumbnails and the sheet. Their look rules are small,
  and rules for parts a page doesn't use match nothing. A companion file per add-on would mean
  three imports to get today's look.
- All of it sits in `@layer fluidbox-baseline` with `:where()` selectors, and its tokens are
  custom properties, so one variable or any unlayered rule overrides it.

## 8.23 The baseline draws its glyphs in CSS

**Recommendation: yes, as the overseer proposed, with two fixes.** The baseline draws today's
glyphs on `[data-fluidbox-default]` controls with `mask-image` and `background-color:
currentColor`, and hides their text visually. Controls carrying the app's own content have no
`data-fluidbox-default`, so they are left alone. The JavaScript stays icon-free.

The two fixes:

1. **Content Security Policy.** A `data:` URI in `mask-image` is fetched as an image, so it is
   governed by `img-src`, not `style-src`. A page with `img-src 'self'` would lose the glyphs, and
   because their text is visually hidden, those buttons would look empty. Each glyph is
   therefore a custom property, `--fluidbox-icon-close: url("data:image/svg+xml,…")`. A strict
   page points them at self-hosted SVG files. Or it adds `data-fluidbox-glyphs="off"` to an
   ancestor (`<html>` works), which shows the text labels instead. This is an attribute rather
   than a custom property because CSS can't branch on a property's value without container
   style queries, which Firefox lacks. `csp.spec.ts` covers both.
2. **Forced colours.** In forced-colours mode `background-color` is forced, so a masked glyph
   would vanish. Under `@media (forced-colors: active)` the baseline drops the mask and shows the
   label text. The text is the accessible name anyway, so nothing else changes.

The alternative was inline SVG in a docs snippet only. It is more robust under CSP, but nobody
gets today's look from one import. That is what the user asked the baseline to give.

## 8.24 Slideshow and Hotspot stay in the binding entries

**Recommendation: keep §8.20.** The overseer asked whether the headless change alters it. It
does, in their favour. The worry behind §8.20's fallback was the React initial chunk growing by
11–17%, and most of that growth was icons: today's six paths plus four new ones, and each
binding's icon builder. With no icons, the React estimate including step 7 drops to 7–12%
(§9.3). `Slideshow` and `Hotspot` are 150–300 B together. Separate entries would add an import
line for every user and two bundle-check consumers per framework, to save less than the icon
removal already did.

The fallback is unchanged: if step 7's measurement exceeds the upper estimate in §9.3, those two
move to their own entries before they ship.
