---
title: Angular
section: Frameworks
order: 4
description: The Angular binding for fluidbox, with every directive, input, output, template context and inject function, and the Angular-specific behaviour.
---

# Angular

`@ogdakke/fluidbox/angular` is a set of standalone directives. `fluidboxRoot` on any element owns one viewer, `fluidboxTrigger` on an element inside opens it, and `<ng-template fluidboxViewer>` puts your own content in the viewer. It needs `@angular/core` 17 or later, and works with or without zone.js.

## Install

```bash
npm install @ogdakke/fluidbox
```

```ts
import { FluidboxModule, injectFluidbox, injectFluidboxSheet } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/styles.css";
```

Add `@ogdakke/fluidbox/styles.css` once, either as an import or in the `styles` array of `angular.json`. Put `FluidboxModule` in a component's `imports` to get every part, or import the directives you use one by one. The filmstrip and sheet parts load their add-ons the first time a root uses them, so there is nothing else to import for them, except the sheet's stylesheet, `@ogdakke/fluidbox/sheet.css`.

## A gallery

```ts
import { Component } from "@angular/core";
import { FluidboxModule, type FluidboxImageItem } from "@ogdakke/fluidbox/angular";

const photos: FluidboxImageItem[] = [
  {
    type: "img",
    src: "/photos/dune.jpg",
    alt: "Dune at dusk",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/dune-400.jpg", width: 400, height: 267 },
  },
  {
    type: "img",
    src: "/photos/fjord.jpg",
    alt: "Fjord",
    width: 1200,
    height: 1600,
    thumbnail: { src: "/photos/fjord-400.jpg", width: 400, height: 533 },
  },
];

@Component({
  selector: "app-photos",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos">
      @for (photo of photos; track photo.src) {
        <button [fluidboxTrigger]="photo">
          <img [src]="photo.thumbnail?.src" [alt]="photo.alt" />
        </button>
      }
    </div>
  `,
})
export class Photos {
  readonly photos = photos;
}
```

Without a `fluidboxViewer` template, the viewer has the default Previous, Next and Close buttons. With one, you place them: the control parts, or `fluidboxControls` for all three. The same gallery, live, in every framework:

<!-- pattern: basic -->

## Parts

| Selector                                                                    | Class                                                                          | Role                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `[fluidboxRoot]`                                                            | `FluidboxRootDirective`                                                        | Owns one viewer for the items. Every other part must be inside its element.                |
| `[fluidboxTrigger]`                                                         | `FluidboxTriggerDirective`                                                     | Makes its element open an item, and registers it as the item's origin.                     |
| `[fluidboxThumbnailOverlay]`                                                | `FluidboxThumbnailOverlayComponent`                                            | A badge or caption on the thumbnail that fades or flies with the photo.                    |
| `[fluidboxFrameLayer]`                                                      | `FluidboxFrameLayerDirective`                                                  | Inside a travelling overlay, an element that moves into the flying frame for the flight.   |
| `ng-template[fluidboxViewer]`                                               | `FluidboxViewerDirective`                                                      | Renders the template into the viewer's body-level layer, in place of the default controls. |
| `[fluidboxControls]`                                                        | `FluidboxControlsComponent`                                                    | The default Previous, Next and Close buttons, for a `fluidboxViewer` template.             |
| `button[fluidboxPrevious]`, `button[fluidboxNext]`, `button[fluidboxClose]` | `FluidboxPreviousDirective`, `FluidboxNextDirective`, `FluidboxCloseDirective` | Run the command, with the default icon and label, and disable themselves when they can't.  |
| `[fluidboxFilmstrip]`                                                       | `FluidboxFilmstripDirective`                                                   | Turns on the filmstrip; on an `ng-template`, the template fills each thumbnail.            |
| `ng-template[fluidboxSheet]`                                                | `FluidboxSheetDirective`                                                       | Turns on the sheet and fills it for the active item.                                       |
| `button[fluidboxSheetStop]`                                                 | `FluidboxSheetStopDirective`                                                   | Moves the sheet to a stop when clicked.                                                    |

`FluidboxModule` imports and exports all of them, for standalone components and NgModules alike.

### `fluidboxRoot`

Exported as `fluidbox`: `<div fluidboxRoot #fb="fluidbox">`.

| Input       | Type                                           | Default               | Purpose                                                                                          |
| ----------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `items`     | `readonly TItem[] \| FluidboxItemList<TItem>`  | `[]`                  | The gallery's items, or a list read on demand (see [Items and origins](./items-and-origins.md)). |
| `labels`    | `Partial<FluidboxLabels>`                      | English               | Your strings for the viewer and the control parts.                                               |
| `zoom`      | `false \| { step?: number; max?: number }`     | `{ step: 2, max: 4 }` | Zoom steps, or `false` to turn zoom off.                                                         |
| `renderers` | `Record<string, TemplateRef \| Type<unknown>>` | `{}`                  | Draw `custom` items, by the name in their `render`: a template or a component. See below.        |
| `origins`   | `FluidboxOriginAdapter<TItem>`                 | triggers              | Finds origins for items without a mounted trigger, and `revealOrigin` scrolls one into view.     |

| Output               | Payload                          | When                                                                                    |
| -------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `(beforeToggle)`     | `FluidboxToggleEvent`            | Before the viewer opens or closes. `$event.preventDefault()` keeps it as it is.         |
| `(toggle)`           | `FluidboxToggleEvent`            | The opening or closing motion starts.                                                   |
| `(beforeItemChange)` | `FluidboxItemChangeEvent<TItem>` | Before the open viewer moves to another item. `$event.preventDefault()` keeps it still. |
| `(itemChange)`       | `FluidboxItemChangeEvent<TItem>` | The viewer moves to an item, including the one it opens on.                             |
| `(settle)`           | `FluidboxItemChangeEvent<TItem>` | The viewer comes to rest on an item.                                                    |
| `(sheetChange)`      | `FluidboxSheetEvent`             | The sheet comes to rest at another stop: `$event.stop` and `$event.reason`.             |

The events are the plain API's: see [Events](./javascript.md#events) for their fields and reasons.

| Member                            | Type                           | Purpose                                                                                                                                                       |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                           | `Signal<FluidboxState<TItem>>` | `status`, `id`, `index`, `item`, `count`, `hasPrevious` and `hasNext`.                                                                                        |
| `open(target?, options?)`         | `Promise<boolean>`             | Opens an item, by the item, its index or its id, or moves to it while open. Resolves `false` when prevented. A command before the viewer exists waits for it. |
| `close()`, `next()`, `previous()` | `Promise<boolean>`             | The other commands. Each takes `{ signal }` too.                                                                                                              |
| `setItems(items)`                 | `Promise<boolean>`             | Replaces the items, as a new `[items]` does.                                                                                                                  |
| `preload(target)`                 | `() => void`                   | Starts loading an item a press is likely to open. Call the result to let go.                                                                                  |
| `fluidbox`                        | `Fluidbox<TItem>`              | The [plain fluidbox](./javascript.md#the-fluidbox), with `sheet`, `update` and `addEventListener`. Its `destroy()` does nothing: the root owns the viewer.    |

```html
<button type="button" (click)="fb.open(0)">Open</button>
<output>{{ fb.state().status }} {{ fb.state().index ?? "-" }}</output>
<div fluidboxRoot #fb="fluidbox" [items]="photos" (itemChange)="onItemChange($event)">…</div>
```

### `fluidboxTrigger`

Exported as `fluidboxTrigger`.

| Input             | Type                                     | Purpose                                                                                           |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `fluidboxTrigger` | `TItem \| number \| string`              | Required. The item to open: the item, its index or its id.                                        |
| `fluidboxReturns` | `readonly (TItem \| number \| string)[]` | More items that close back onto this trigger, as for an album cover. The opened item always does. |

| Member    | Type                                             | Purpose                                                                                                                                                                                               |
| --------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preview` | `Signal<FluidboxTriggerPreview<TItem>>`          | `{ item, index, status }`: the item the trigger shows. That is the item the viewer is on while it is open, then the last one it showed. `item` is `null` when the trigger's items have left the list. |
| `target`  | `Signal<TItem \| number \| string>`              | The item it opens.                                                                                                                                                                                    |
| `returns` | `Signal<readonly (TItem \| number \| string)[]>` | The other items that return here.                                                                                                                                                                     |

The directive adds `data-fluidbox-trigger`, `aria-haspopup="dialog"` and `aria-expanded` to its element, gives a `<button>` without a `type` `type="button"`, and starts loading the item on pointer down. Put it on an element that can take focus, such as a `<button>` or `<a href>`. A trigger that shows the last viewed item opens on it again, so the flight starts from the picture on it.

```html
<button [fluidboxTrigger]="album[0]" [fluidboxReturns]="album" #cover="fluidboxTrigger">
  <img [src]="(cover.preview().item ?? album[0]).src" alt="Album" />
</button>
```

### `fluidboxThumbnailOverlay` and `fluidboxFrameLayer`

| Input    | Type      | Default | Purpose                                                                                                            |
| -------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `travel` | `boolean` | `false` | Without it, the overlay stays on the page and gets `--fluidbox-closed`. With it, its content flies with the photo. |

It belongs to the enclosing trigger's item and its `fluidboxReturns`, and throws outside a `fluidboxTrigger`. Write the bare attribute for `true`. Give the content as an `ng-template` child: the overlay renders it in place, and with `travel` renders it again into the flying frame, as a live view with DI and change detection, so a bound count or caption stays current in flight. Plain content (no template) works too, and flies as a still copy.

```html
<span fluidboxThumbnailOverlay travel class="badge">
  <ng-template>
    <span fluidboxFrameLayer class="scrim"></span>
    +{{ album.length - 1 }}
  </ng-template>
</span>
```

`fluidboxFrameLayer` marks an element `data-fluidbox-frame-layer`, on the overlay or inside its template. With `travel`, that element itself moves into the flying frame for the flight, scaled with the photo, and goes back after, while a still copy holds its place on the card. So it is left out of the live copy: there it renders with `display: none`, and the scrim never shows twice. See [Thumbnail overlays](./javascript.md#thumbnail-overlays) for what an overlay gets as the viewer moves.

### `fluidboxViewer` and `fluidboxControls`

`<ng-template fluidboxViewer>` has no inputs. Its view is created when the viewer is, inside the root, and its nodes move into the viewer's layer. Everything in it hides during the opening flight and fades as a close or a drag starts, like the default controls. Put `<div fluidboxControls></div>` in it for the default buttons; its element takes no box, so the buttons sit in the layer as if they were its own.

### `fluidboxPrevious`, `fluidboxNext`, `fluidboxClose`

On a `<button>`. A button that is empty after content init (bound text counts as content) gets the default icon and an `aria-label` from `labels`, and every button gets `type="button"` unless it has a `type`. The button is disabled by the viewer's state: Previous and Next at the ends of the gallery, Close while the viewer is closed.

| Input      | Type      | Purpose                                        |
| ---------- | --------- | ---------------------------------------------- |
| `disabled` | `boolean` | Overrides the disabled state the viewer gives. |

A `(click)` on the same button runs first; `$event.preventDefault()` stops the command.

### Renderers

`[renderers]` maps the `render` name of `custom` items to a template or a component. A template gets the context `let-item let-index="index"` (`FluidboxItemContext`). A component gets `item` and `index` inputs, when it declares them.

```html
<div fluidboxRoot [items]="media" [renderers]="{ note: noteTemplate }">…</div>
<ng-template #noteTemplate let-item>
  <article>{{ item.title }}</article>
</ng-template>
```

### `fluidboxFilmstrip`

No inputs. `<ng-container fluidboxFilmstrip />` turns on the strip with its default thumbnails. On an `ng-template`, the template fills each thumbnail button, with the context `let-item let-index="index"`. The strip marks the selected button `data-fluidbox-selected`, so your thumbnail tracks nothing itself.

### `fluidboxSheet` and `fluidboxSheetStop`

| Input        | Type                                | Default              | Purpose                                                  |
| ------------ | ----------------------------------- | -------------------- | -------------------------------------------------------- |
| `snapPoints` | `readonly FluidboxSheetSnapPoint[]` | `["60%", "content"]` | The stops above the resting one, lowest first.           |
| `dismiss`    | `"flight" \| "scroll" \| "none"`    | `"flight"`           | What a swipe down on the photo does with the sheet down. |

The template renders into the sheet, the viewer's `<section data-fluidbox-sheet>` named by `labels.sheet`, for the active item, with the context `let-item let-index="index"` (`FluidboxItemContext`). It renders again when the item changes. `(sheetChange)` on the root, and the `stop` signal of `injectFluidboxSheet()`, follow its stop. `<button fluidboxSheetStop="1">`, in the viewer or in the sheet, moves the sheet to stop 1. [Filmstrip and sheet](./filmstrip-and-sheet.md) has the details of both add-ons.

## Inject functions

Call them in an injection context (a field initializer or constructor) of a component inside the root's element, including the viewer, renderer, filmstrip and sheet templates.

| Function                 | Returns                      | Purpose                                                                                                           |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `injectFluidbox()`       | `Signal<FluidboxApi<TItem>>` | The state of the root above, with `open`, `close`, `next`, `previous`, `setItems` and `preload` on it.            |
| `injectFluidbox(select)` | `Signal<T>`                  | What `select` picks from it, such as `({ index }) => index`.                                                      |
| `injectFluidboxSheet()`  | `FluidboxSheetApi`           | `{ stop, set }`: the stop the sheet rests at, as a signal that follows `sheetchange`, and `set(stop)` to move it. |

Both throw outside a root. The component whose template holds `fluidboxRoot` can't inject it; use the `#fb="fluidbox"` reference or `@ViewChild(FluidboxRootDirective)` there.

```ts
import { Component } from "@angular/core";
import { injectFluidbox } from "@ogdakke/fluidbox/angular";

@Component({
  selector: "app-counter",
  standalone: true,
  template: `
    <button type="button" [disabled]="!fluidbox().hasNext" (click)="fluidbox().next()">
      {{ (fluidbox().index ?? 0) + 1 }} / {{ fluidbox().count }}
    </button>
  `,
})
export class Counter {
  readonly fluidbox = injectFluidbox();
}
```

### Types

The entry exports `FluidboxApi`, `FluidboxSheetApi`, `FluidboxItemContext` (the `{ item, index }` context of the sheet, filmstrip and renderer templates), `FluidboxContent` and `FluidboxTriggerPreview`, and re-exports the item, state and event types and classes of `@ogdakke/fluidbox`. `TItem` comes from `[items]` on the root and from the inputs of each part; pass it to `injectFluidbox<Photo>()` for your own item type.

## Patterns

| Pattern                                            | In Angular                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Gallery](./patterns/basic.md)                     | `[items]`, `[fluidboxTrigger]` per item, and `fluidboxPrevious`, `fluidboxNext` and `fluidboxClose` in `fluidboxViewer`.                                   |
| [One trigger for an album](./patterns/overlay.md)  | `[fluidboxTrigger]="album[0]" [fluidboxReturns]="album" #t="fluidboxTrigger"`, `t.preview()`, and `fluidboxThumbnailOverlay travel` with an `ng-template`. |
| [Rich origins](./patterns/origins.md)              | `data-fluidbox-origin` on an element inside the trigger. The directive goes on your own element, so there is no `asChild`.                                 |
| [Custom content](./patterns/renderers.md)          | `[renderers]="{ note: Note }"` with your component.                                                                                                        |
| [Programmatic control](./patterns/programmatic.md) | `#fb="fluidbox"`, `fb.open(2)`, `fb.state()`, and `(beforeItemChange)` with `$event.preventDefault()`.                                                     |
| [Zoom](./patterns/zoom.md)                         | `[zoom]="{ step: 3, max: 6 }"` or `[zoom]="false"`.                                                                                                        |
| [Filmstrip](./patterns/filmstrip.md)               | `<ng-container fluidboxFilmstrip />`, or `<ng-template fluidboxFilmstrip let-index="index">`.                                                              |
| [Sheet](./patterns/sheet.md)                       | `<ng-template fluidboxSheet [snapPoints]>`, `injectFluidboxSheet()` and `fluidboxSheetStop`.                                                               |
| [Headless controls](./patterns/headless.md)        | Your own component in `fluidboxViewer`, using `injectFluidbox()`.                                                                                          |

## Angular notes

**When the viewer exists.** The root makes the viewer once, right after the first change detection pass, once every part inside has rendered; with a filmstrip or sheet, once its add-on has loaded. It lives as long as the root. Commands made before then wait for it and run once it exists.

**Options apply in place.** New `labels` or `zoom`, and a `fluidboxViewer`, `fluidboxFilmstrip` or `fluidboxSheet` coming, going or changing its inputs, go to the viewer through `fluidbox.update()`, so an open viewer stays open. Each part hands over a renderer that stays the same for its life, so only what changed is drawn again. `origins`, `renderers` and the outputs are read when used. New `items` go through `setItems`, and an open viewer stays on the same item id if the new list still has it.

**Change detection.** The viewer listens to pointer and key events outside the Angular zone, so gestures and animation never trigger change detection. Outputs, state updates and template mounts come back into the zone. `state`, `preview` and the inject functions are signals, so `OnPush` components and zoneless apps update without extra work.

**DI reaches custom content.** Viewer, filmstrip and sheet templates render as embedded views where they are declared, and renderers as views of the root, so their components inject from the surrounding tree, as the [Custom content](./patterns/renderers.md) example does with a theme token.

**Stopping an open.** The trigger adds its listeners after the template's own, so a `(click)` on the same element runs first and `$event.preventDefault()` stops the open. Prevented in `(pointerdown)`, it only skips loading the item early.

**Server rendering.** The parts skip all DOM work on the server (`PLATFORM_ID` is not `"browser"`) and build the viewer in the browser.

**Previews update before the close flight.** When the viewer closes on a different item of a multi-item trigger, a trigger whose `preview()` is read runs change detection synchronously, so the flight lands on the right picture. The trigger finds its image when it registers, so keep the `<img>` in place and bind its `src`; don't swap in a new element.
