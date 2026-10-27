# Fluidbox styling contract

How the package's CSS is split, what is public, and where the list of public hooks lives. The
user documentation is [Styling](../apps/docs/content/styling.md) and the
[CSS reference](../apps/docs/content/css-reference.md); this page is the contract they follow.

## The stylesheets

| File             | Holds                                                                                                  | Layer               |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------- |
| `styles.css`     | What makes the viewer work: layout, the strip, flights, zoom, hotspots, hidden states, reduced motion. | none                |
| `thumbnails.css` | The thumbnails' mechanics.                                                                             | none                |
| `sheet.css`      | The sheet's mechanics.                                                                                 | none                |
| `baseline.css`   | The default look, opt-in: controls and their glyphs, focus rings, fades, the add-ons' look.            | `fluidbox-baseline` |

- The functional files are unlayered, so a site's resets can't break the mechanics. Their rules
  sit in `:where([data-fluidbox-viewer], [data-fluidbox-flight])` and weigh about one attribute.
- `baseline.css` is wholly in `:where()` and in its layer, so any unlayered app rule, or a rule in
  a later layer, beats it. It never sets a property the functional CSS sets on the same element;
  where both have a say, the functional rule reads a token with a fallback (`Canvas` on the
  backdrop) and the baseline sets the token.
- The package draws no icons. A control without content shows its label as text and gets
  `data-fluidbox-default`; `baseline.css` masks a glyph over it from a `--fluidbox-icon-*` token.
  A control with content of the page's is left alone.
- `!important` appears only in the functional files, to hide a thumbnail during a flight, keep a
  flight's source hidden and hand touches back after a dismiss. `baseline.css` has none.
- Every transition in `baseline.css` is inside `@media (prefers-reduced-motion: no-preference)`.

`@ogdakke/fluidbox/elements` installs no CSS: pages import the stylesheets they use. None needs
CSS `@scope`.

## What is public

The public hooks are the ones the [CSS reference](../apps/docs/content/css-reference.md) lists.
It is generated:

- custom properties a page sets, from `@input` doc comments in the stylesheets;
- the baseline's tokens, from its doc comments;
- the properties the runtime publishes, the parts and the state attributes, from
  `packages/fluidbox/src/css-api.ts`.

`bun run build:docs` fails when the stylesheets or the runtime use a `--fluidbox-*` or
`data-fluidbox-*` name that is neither documented nor listed in `internal` in `css-api.ts`, or
when a documented name is used nowhere. Anything not listed (generated nodes, inline
properties, internal `--fluidbox-*` variables, other data attributes) can change without notice.

## Names

- Parts of the viewer, and markers a page puts on its own elements, are `data-fluidbox-*`:
  `[data-fluidbox-dialog]`, `data-fluidbox-origin`, `data-fluidbox-hotspot`.
- State on the viewer's own elements is a plain flag: `data-open`, `data-zoomed`,
  `data-active`, `data-busy`.
- State on the page's elements, a trigger or a trigger overlay, is `data-fluidbox-*`, so it never
  clashes with the page's own attributes. `data-fluidbox-status` is on both, as the active trigger
  mirrors the viewer.
- The runtime adds no class names.

## Values the runtime owns

The runtime writes measurements and motion state as custom properties and inline styles: the
flight's pose, the drag, the zoom (`--fluidbox-zoom-scale`), the sheet's progress, a trigger
overlay's `--fluidbox-closed`. A page reads the published ones for its own effects and never sets
them; Web Animations and inline values drive the pose.

Inputs a page sets, such as `--fluidbox-motion-speed` and the stage insets, are read where the
reference says. When the viewer opens, it copies every `--fluidbox-*` property computed on the
trigger onto the overlay, so a page can set them on `:root`, on a section or on one trigger, and a
change applies from the next open.

## Ownership

The runtime owns the body-level viewer, measured frames, transforms, clipping, the strip, gesture
surfaces, focus containment and the inert background. Pages own the controls' content, captions,
hotspot content, trigger decorations and everything a framework renders into the viewer.
Geometry, scrolling, clipping, touch behaviour, focus visibility and modal isolation stay
structural however the look is replaced.
