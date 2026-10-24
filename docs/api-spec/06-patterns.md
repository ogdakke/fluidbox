# 6. The 13 patterns in the new API

Each pattern from `apps/examples/src/patterns/CONTRACT.md`, rewritten in React and Angular. Angular
is the second framework because it needs the most adapter code today. The code is what the
`#region example` would hold, `data-test` attributes included (the docs strip them).

## 6.0 Shared data changes

`apps/examples/src/patterns/shared.ts` changes with the item types:

- every `type: "img"` → `"image"`;
- `zoomPhotos[*].zoomSrc` → `zoom: { src }`;
- the `media` fixture's note becomes `{ type: "note", id: "note", title, width, height }`, with
  `declare module "@ogdakke/fluidbox" { interface FluidboxItemTypes { note: NoteItem } }` beside
  it;
- `productMedia` keeps calling `youtubeItem`, `spinItem` and `modelItem`, which now return
  `type: "embed"`, `"spin"` and `"model"`.

## 6.0.1 Contract changes

The contract's behaviour stays; these wordings change:

| Pattern      | Today                                                                                                                                                                       | New                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| overlay      | "every album item returns to it (`returns`)"; "a travel thumbnail overlay"                                                                                                  | "its `value` is the whole album"; "an overlay with `flight="live"`"                                                                                                                       |
| renderers    | "custom note"; "the `note` renderer"                                                                                                                                        | "a `note` item"; "the `note` slide"                                                                                                                                                       |
| programmatic | "a `beforeitemchange` listener calls `preventDefault()`"; log "one `<li>` per fluidbox event"; test "log contains `itemchange`"                                             | "a value-change handler cancels moves"; log one `<li>` per value change (`valuechange`) and completion (`valuechangecomplete`); test "log contains `valuechange`"                         |
| zoom         | "`zoomSrc`"; "the framework Controls part with `zoom`"; "`<fluidbox-controls zoom>`"                                                                                        | "`zoom.src`"; "a `Toolbar` and `ZoomControls`"; "`<fluidbox-toolbar>` and `<fluidbox-zoom-controls>`"                                                                                     |
| filmstrip    | name, "the default filmstrip", `filmstrip.css`                                                                                                                              | "thumbnails", `thumbnails.css`; the page is `patterns/thumbnails.md`                                                                                                                      |
| sheet        | "the current stop in `output[data-test="stop"]`"; "`sheet.set(2)` or a sheet-stop button"; "`data-fluidbox-sheet-stop="1"`"                                                 | "the current snap"; "`setSnap(2)` or a `SheetSnap`"; "`data-fluidbox-sheet-snap="1"`"                                                                                                     |
| url          | "Frameworks pass `open` and `index` … (`onOpenChange`/`onIndexChange`, `update:` events, `[(open)]`/`[(index)]`); elements set the gallery's `open` and `index` attributes" | "Frameworks pass `value` from their own state and update it from `onValueChange` (`v-model`, `[(value)]`); elements set the gallery's `value` attribute"                                  |
| media        | "The renderers are the add-ons' own … React, Vue, Solid and Angular wrap each in the framework's renderer API"                                                              | "The slides are the add-ons' parts (`Embed`, `Spin`, `Model`); elements import the add-ons' elements entries; JS passes `embedSlide`, `createSpinSlide()`, `createModelSlide({ load })`." |

The tests in `tests/browser/patterns.spec.ts` change only where they name these (§9.4).

## 6.1 basic

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

export function Basic() {
  return (
    <Fluidbox.Root items={photos}>
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* Without a Viewer, the viewer has these same three buttons. */}
      <Fluidbox.Viewer>
        <Fluidbox.Previous />
        <Fluidbox.Next />
        <Fluidbox.Close />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

@Component({
  selector: "pattern-basic",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Without a viewer template these three are the default; with one, you place them. -->
      <ng-template fluidboxViewer>
        <button fluidboxPrevious></button>
        <button fluidboxNext></button>
        <button fluidboxClose></button>
      </ng-template>
    </div>
  `,
})
export class Basic {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
```

## 6.2 overlay

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { album } from "../shared";

const albumIds = album.map((photo) => photo.id);

export function Overlay() {
  return (
    <Fluidbox.Root items={album}>
      {/* The first item opens; every album item closes back onto this trigger. */}
      <Fluidbox.Trigger
        value={albumIds}
        className="pattern-thumb pattern-album"
        data-test="trigger"
      >
        {({ item }) => (
          <>
            {/* Shows the item the viewer last showed. Keep the img mounted. */}
            <img src={item?.src} alt={item ? itemLabel(item) : ""} data-test="preview" />
            <Fluidbox.Overlay flight="live" className="pattern-overlay" data-test="count">
              +{album.length - 1}
            </Fluidbox.Overlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { album } from "../shared";

@Component({
  selector: "pattern-overlay",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="album">
      <!-- The cover opens the first photo; every one of them closes back onto it. -->
      <button
        [fluidboxTrigger]="albumIds"
        #trigger="fluidboxTrigger"
        class="pattern-thumb pattern-album"
        data-test="trigger"
      >
        @let shown = trigger.preview().item ?? album[0];
        <img [src]="shown.src" [alt]="label(shown)" data-test="preview" />
        <!-- The count flies with the photo, rendered live from its template. -->
        <span fluidboxOverlay flight="live" class="pattern-overlay" data-test="count">
          <ng-template>+{{ album.length - 1 }}</ng-template>
        </span>
      </button>
    </div>
  `,
})
export class Overlay {
  readonly album = album;
  readonly albumIds = album.map((photo) => photo.id);
  readonly label = itemLabel;
}
// #endregion example
```

`@let` needs Angular 18.1. If the minimum stays at 17.3 (§8), the example keeps today's two
`trigger.preview().item ?? album[0]` expressions.

## 6.3 origins

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { product, strip } from "../shared";

const products = [product];

/** Only the photo flies: the card marks it with data-fluidbox-origin. */
export function ProductCard() {
  return (
    <Fluidbox.Root items={products}>
      <Fluidbox.Trigger value={product.id} asChild>
        <button type="button" className="pattern-card" data-test="product">
          <span data-fluidbox-origin>
            <img src={product.src} alt={itemLabel(product)} />
          </span>
          <span>
            <strong>Coral runner</strong>
            <br />
            €120
          </span>
        </button>
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}

/** Moving through the viewer scrolls each trigger into view, so the close lands on it. */
export function Scroller() {
  return (
    <Fluidbox.Root items={strip}>
      <div className="pattern-scroller" data-test="scroller">
        {strip.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { product, strip } from "../shared";

@Component({
  selector: "pattern-origins",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <!-- The photo flies from the element marked data-fluidbox-origin, not the whole card. -->
    <div fluidboxRoot [items]="[product]">
      <button [fluidboxTrigger]="product.id" class="pattern-card" data-test="product">
        <span data-fluidbox-origin>
          <img [src]="product.src" [alt]="label(product)" />
        </span>
        <span><strong>Coral runner</strong><br />€120</span>
      </button>
    </div>
    <!-- Moving through the viewer scrolls each trigger into view, so the close lands on it. -->
    <div fluidboxRoot [items]="strip" class="pattern-scroller" data-test="scroller">
      @for (item of strip; track item.id) {
        <button [fluidboxTrigger]="item.id" class="pattern-thumb" data-test="trigger">
          <img [src]="item.src" [alt]="label(item)" />
        </button>
      }
    </div>
  `,
})
export class Origins {
  readonly product = product;
  readonly strip = strip;
  readonly label = itemLabel;
}
// #endregion example
```

## 6.4 renderers

```tsx
// #region example
import { createContext, useContext } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { media, theme, thumbnailSrc } from "../shared";

const ThemeContext = createContext("light");

/** Slide content renders inside the app, so it reads the app's context. */
function Note() {
  const theme = useContext(ThemeContext);
  return <article className="pattern-note">Theme: {theme}</article>;
}

export function Renderers() {
  return (
    <ThemeContext.Provider value={theme}>
      <Fluidbox.Root items={media}>
        <div className="pattern-grid">
          {media.map((item) => (
            <Fluidbox.Trigger
              key={item.id}
              value={item.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          ))}
        </div>
        {/* Items of type "note" render <Note /> in their media box; the rest are built in. */}
        <Fluidbox.Slides
          note={() => (
            <Fluidbox.Media>
              <Note />
            </Fluidbox.Media>
          )}
        />
      </Fluidbox.Root>
    </ThemeContext.Provider>
  );
}
// #endregion example
```

```ts
// #region example
import { Component, InjectionToken, inject } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { media, theme, thumbnailSrc } from "../shared";

export const THEME = new InjectionToken<string>("THEME");

/** Slide content renders inside the root, so it injects from the app. */
@Component({
  selector: "article[appNote]",
  standalone: true,
  host: { class: "pattern-note" },
  template: `Theme: {{ theme }}`,
})
export class Note {
  readonly theme = inject(THEME);
}

@Component({
  selector: "pattern-renderers",
  standalone: true,
  imports: [FluidboxModule, Note],
  providers: [{ provide: THEME, useValue: theme }],
  template: `
    <div fluidboxRoot [items]="media" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
      <!-- Items of type "note" render <article appNote> in their media box. -->
      <ng-template fluidboxSlide="note">
        <ng-template fluidboxMedia><article appNote></article></ng-template>
      </ng-template>
    </div>
  `,
})
export class Renderers {
  readonly media = media;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
```

The pattern says the note _renders_ `.pattern-note` in the dialog; with `Media` it also flies. A
note without `Media` would fade instead (§5.1); the example uses `Media` because that is the case
to teach.

## 6.5 programmatic

```tsx
// #region example
import { useRef, useState, type RefObject } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Toolbar({ lock }: { lock: RefObject<HTMLInputElement | null> }) {
  const open = useFluidbox(({ open }) => open);
  const status = useFluidbox(({ status, index }) => `${status} ${index ?? "-"}`);
  return (
    <div className="pattern-toolbar">
      <button type="button" data-test="open-third" onClick={() => open(2)}>
        Open the third photo
      </button>
      <label>
        <input ref={lock} type="checkbox" name="lock" data-test="lock" /> Lock navigation
      </label>
      <output data-test="status">{status}</output>
    </div>
  );
}

export function Programmatic() {
  const lock = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const record = (type: string) => setLog((types) => [...types, type].slice(-20));
  return (
    <Fluidbox.Root
      items={photos}
      // Called before every open, move and close; canceling a move keeps the viewer still.
      onValueChange={(_, details) => {
        if (lock.current?.checked && details.action === "move") details.cancel();
        record("valuechange");
      }}
      onValueChangeComplete={() => record("valuechangecomplete")}
    >
      <Toolbar lock={lock} />
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      <ol className="pattern-log" data-test="log">
        {log.map((type, index) => (
          <li key={index}>{type}</li>
        ))}
      </ol>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import { Component, signal } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, type FluidboxValueChangeEvent } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

@Component({
  selector: "pattern-programmatic",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div class="pattern-toolbar">
      <button type="button" data-test="open-third" (click)="fb.open(2)">
        Open the third photo
      </button>
      <label>
        <input
          type="checkbox"
          name="lock"
          data-test="lock"
          #lock
          (change)="locked.set(lock.checked)"
        />
        Lock navigation
      </label>
      <output data-test="status">{{ fb.state().status }} {{ fb.state().index ?? "-" }}</output>
    </div>
    <div
      fluidboxRoot
      #fb="fluidbox"
      [items]="photos"
      class="pattern-grid"
      (beforeValueChange)="guard($event)"
      (valueChangeComplete)="log('valuechangecomplete')"
    >
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
    <ol class="pattern-log" data-test="log">
      @for (type of events(); track $index) {
        <li>{{ type }}</li>
      }
    </ol>
  `,
})
export class Programmatic {
  readonly photos = photos;
  readonly label = itemLabel;
  readonly locked = signal(false);
  readonly events = signal<string[]>([]);

  log(type: string): void {
    this.events.update((events) => [...events, type].slice(-20));
  }

  // Comes before every open, move and close; canceling a move keeps the viewer still.
  guard(event: FluidboxValueChangeEvent): void {
    this.log("valuechange");
    if (this.locked() && event.action === "move") event.preventDefault();
  }
}
// #endregion example
```

## 6.6 zoom

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** The zoom the image on show rests at, from the viewer's state. */
function ZoomLevel() {
  const zoom = useFluidbox((state) => state.zoom);
  return (
    <output className="pattern-zoom-level" data-test="zoom-level">
      {zoom ? `${Math.round(zoom.scale * 100)}%` : ""}
    </output>
  );
}

export function Zoom() {
  return (
    <>
      {/* Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. */}
      <Fluidbox.Root items={zoomPhotos} zoom={{ step: 3, max: 6 }}>
        <div className="pattern-grid">
          {zoomPhotos.map((photo) => (
            <Fluidbox.Trigger
              key={photo.id}
              value={photo.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(photo)} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          ))}
        </div>
        <Fluidbox.Viewer>
          {/* Previous, Next and Close, then Zoom in, Zoom out and Fit. */}
          <Fluidbox.Toolbar />
          <Fluidbox.ZoomControls />
          <ZoomLevel />
        </Fluidbox.Viewer>
      </Fluidbox.Root>

      <Fluidbox.Root items={photos} zoom={false}>
        <div className="pattern-grid">
          {photos.map((photo) => (
            <Fluidbox.Trigger
              key={photo.id}
              value={photo.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          ))}
        </div>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidbox } from "@ogdakke/fluidbox/angular";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** The zoom the image on show rests at. In the viewer, it injects the root's state. */
@Component({
  selector: "output[appZoomLevel]",
  standalone: true,
  host: { class: "pattern-zoom-level", "data-test": "zoom-level" },
  template: `{{ level() }}`,
})
export class ZoomLevel {
  readonly level = injectFluidbox(({ zoom }) => (zoom ? `${Math.round(zoom.scale * 100)}%` : ""));
}

@Component({
  selector: "pattern-zoom",
  standalone: true,
  imports: [FluidboxModule, ZoomLevel],
  template: `
    <!-- Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. -->
    <div fluidboxRoot [items]="zoomPhotos" [zoom]="{ step: 3, max: 6 }" class="pattern-grid">
      @for (photo of zoomPhotos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(photo)" [alt]="label(photo)" />
        </button>
      }
      <ng-template fluidboxViewer>
        <!-- Previous, Next and Close, then Zoom in, Zoom out and Fit. -->
        <div fluidboxToolbar></div>
        <div fluidboxZoomControls></div>
        <output appZoomLevel></output>
      </ng-template>
    </div>
    <div fluidboxRoot [items]="photos" [zoom]="false" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Zoom {
  readonly zoomPhotos = zoomPhotos;
  readonly photos = photos;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
```

## 6.7 thumbnails (was filmstrip)

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/thumbnails.css";
import { photos } from "../shared";

function Grid() {
  return (
    <div className="pattern-grid">
      {photos.map((photo) => (
        <Fluidbox.Trigger
          key={photo.id}
          value={photo.id}
          className="pattern-thumb"
          data-test="trigger"
        >
          <img src={photo.src} alt={itemLabel(photo)} />
        </Fluidbox.Trigger>
      ))}
    </div>
  );
}

export function Thumbnails() {
  return (
    <>
      <Fluidbox.Root items={photos}>
        <Grid />
        {/* Being there turns the thumbnails on. */}
        <Fluidbox.Thumbnails />
      </Fluidbox.Root>
      <Fluidbox.Root items={photos}>
        <Grid />
        {/* Your own thumbnails. The selected button has data-active. */}
        <Fluidbox.Thumbnails>
          {({ index }) => (
            <span className="pattern-filmstrip-thumb" data-test="thumb">
              {index + 1}
            </span>
          )}
        </Fluidbox.Thumbnails>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/thumbnails.css";
import { photos } from "../shared";

@Component({
  selector: "pattern-thumbnails",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <ng-container fluidboxThumbnails />
    </div>
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Your own thumbnails. The selected button has data-active. -->
      <ng-template fluidboxThumbnails let-index="index">
        <span class="pattern-filmstrip-thumb" data-test="thumb">{{ index + 1 }}</span>
      </ng-template>
    </div>
  `,
})
export class Thumbnails {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
```

## 6.8 sheet

```tsx
// #region example
import { itemLabel, type FluidboxItem } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/sheet.css";
import { photos } from "../shared";

function Details({ item }: { item: FluidboxItem }) {
  const sheet = useFluidboxSheet();
  return (
    <>
      <h3 data-test="sheet-title">{itemLabel(item)}</h3>
      <p>
        Snap <output data-test="stop">{sheet.snap}</output>
      </p>
      <button type="button" data-test="expand" onClick={() => sheet.setSnap(2)}>
        Expand
      </button>
      <input placeholder="Add a note" aria-label="Note" data-test="field" />
    </>
  );
}

export function Sheet() {
  return (
    <Fluidbox.Root items={photos}>
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* Snap 0 rests below the photo; snaps 1 and 2 raise it to 40% and 90% of the screen. */}
      <Fluidbox.Sheet snapPoints={["40%", "90%"]} className="pattern-sheet">
        {({ item }) => <Details item={item} />}
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        <Fluidbox.SheetSnap to={1} className="pattern-sheet-toggle" data-test="peek">
          Details
        </Fluidbox.SheetSnap>
        <Fluidbox.Toolbar />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import { Component, input } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import {
  FluidboxModule,
  injectFluidboxSheet,
  type FluidboxImageItem,
} from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/sheet.css";
import { photos } from "../shared";

@Component({
  selector: "div[appDetails]",
  standalone: true,
  host: { class: "pattern-sheet" },
  template: `
    <h3 data-test="sheet-title">{{ label(photo()) }}</h3>
    <p>
      Snap <output data-test="stop">{{ sheet.snap() }}</output>
    </p>
    <button type="button" data-test="expand" (click)="sheet.setSnap(2)">Expand</button>
    <input data-test="field" placeholder="Add a note" aria-label="Note" />
  `,
})
export class Details {
  readonly photo = input.required<FluidboxImageItem>();
  readonly sheet = injectFluidboxSheet();
  readonly label = itemLabel;
}

@Component({
  selector: "pattern-sheet",
  standalone: true,
  imports: [FluidboxModule, Details],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Snap 0 rests below the photo; snaps 1 and 2 raise it to 40% and 90% of the screen. -->
      <ng-template fluidboxSheet [snapPoints]="['40%', '90%']" let-photo>
        <div appDetails [photo]="photo"></div>
      </ng-template>
      <ng-template fluidboxViewer>
        <div fluidboxToolbar></div>
        <!-- A fluidboxSheetSnap button moves the sheet to that snap. -->
        <button fluidboxSheetSnap="1" class="pattern-sheet-toggle" data-test="peek">Details</button>
      </ng-template>
    </div>
  `,
})
export class Sheet {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
```

## 6.9 headless

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Caption() {
  const { item, hasPrevious, hasNext, previous, next, close } = useFluidbox();
  return (
    <div className="pattern-caption">
      <button type="button" disabled={!hasPrevious} data-test="prev" onClick={() => previous()}>
        Previous
      </button>
      <span>
        <strong data-test="title">{item && itemLabel(item)}</strong>{" "}
        <small data-test="counter">
          <Fluidbox.Counter />
        </small>
      </span>
      <button type="button" disabled={!hasNext} data-test="next" onClick={() => next()}>
        Next
      </button>
      <button type="button" data-test="close" onClick={() => close()}>
        Close
      </button>
    </div>
  );
}

export function Headless() {
  return (
    <Fluidbox.Root items={photos}>
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* Your own controls and caption replace the default ones. */}
      <Fluidbox.Viewer>
        <Caption />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
```

The contract asks for a counter reading `1 / 4`; `Counter` renders `labels.counter`, whose default
is that text. The pattern keeps its own buttons on purpose: it shows the commands, not the parts.

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidbox } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

/** Your own controls and caption. In the viewer, it injects the fluidbox of the root. */
@Component({
  selector: "div[appCaption]",
  standalone: true,
  imports: [FluidboxModule],
  host: { class: "pattern-caption" },
  template: `
    <button
      type="button"
      data-test="prev"
      [disabled]="!fluidbox().hasPrevious"
      (click)="fluidbox().previous()"
    >
      Previous
    </button>
    <span>
      <strong data-test="title">{{ title() }}</strong>
      <small data-test="counter"><span fluidboxCounter></span></small>
    </span>
    <button
      type="button"
      data-test="next"
      [disabled]="!fluidbox().hasNext"
      (click)="fluidbox().next()"
    >
      Next
    </button>
    <button type="button" data-test="close" (click)="fluidbox().close()">Close</button>
  `,
})
export class Caption {
  readonly fluidbox = injectFluidbox();
  readonly title = injectFluidbox(({ item }) => (item ? itemLabel(item) : ""));
}

@Component({
  selector: "pattern-headless",
  standalone: true,
  imports: [FluidboxModule, Caption],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- A viewer template replaces the default controls. -->
      <ng-template fluidboxViewer>
        <div appCaption></div>
      </ng-template>
    </div>
  `,
})
export class Headless {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
```

## 6.10 rtl

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/thumbnails.css";
import { arabic, photos } from "../shared";

export function Rtl() {
  return (
    // The viewer takes dir and lang from the trigger's surroundings.
    <div dir="rtl" lang="ar">
      <Fluidbox.Root items={photos} labels={arabic}>
        <div className="pattern-grid">
          {photos.map((photo) => (
            <Fluidbox.Trigger
              key={photo.id}
              value={photo.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          ))}
        </div>
        <Fluidbox.Thumbnails />
      </Fluidbox.Root>
    </div>
  );
}
// #endregion example
```

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/thumbnails.css";
import { arabic, photos } from "../shared";

@Component({
  selector: "pattern-rtl",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <!-- The viewer takes dir and lang from the trigger's surroundings. -->
    <div dir="rtl" lang="ar">
      <div fluidboxRoot [items]="photos" [labels]="labels" class="pattern-grid">
        @for (photo of photos; track photo.id) {
          <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
            <img [src]="photo.src" [alt]="label(photo)" />
          </button>
        }
        <ng-container fluidboxThumbnails />
      </div>
    </div>
  `,
})
export class Rtl {
  readonly photos = photos;
  readonly labels = arabic;
  readonly label = itemLabel;
}
// #endregion example
```

`arabic` renames its `filmstrip` and `filmstripList` keys to `thumbnails` and `thumbnailsList`.

## 6.11 url

The address keeps `?photo=N` (1-based index), as the contract says; the Root's `value` is an id,
so the example converts between them.

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { useEffect, useState } from "react";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): string | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return photos[photo]?.id ?? null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(id: string | null) {
  const shown = photoInUrl();
  if (id === shown) return;
  const url = new URL(location.href);
  if (id === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photos.findIndex((photo) => photo.id === id) + 1));
  if (shown === null) history.pushState({ photo: true }, "", url);
  else history.replaceState(history.state, "", url);
}

export function Url() {
  // Read the address after the first render, so the server and the browser render the same.
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    const onPopState = () => setPhoto(photoInUrl());
    onPopState();
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);

  return (
    <Fluidbox.Root
      items={photos}
      value={photo}
      onValueChange={(value) => {
        followInUrl(value);
        setPhoto(value);
      }}
    >
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
```

One handler instead of two: today's example needs `onOpenChange` to ignore opens and
`onIndexChange` to catch them, because an open fires both.

```ts
// #region example
import { afterNextRender, Component, HostListener, signal } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): string | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return photos[photo]?.id ?? null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(id: string | null) {
  const shown = photoInUrl();
  if (id === shown) return;
  const url = new URL(location.href);
  if (id === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photos.findIndex((photo) => photo.id === id) + 1));
  if (shown === null) history.pushState({ photo: true }, "", url);
  else history.replaceState(history.state, "", url);
}

@Component({
  selector: "pattern-url",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div
      fluidboxRoot
      [items]="photos"
      [value]="photo()"
      (valueChange)="follow($event)"
      class="pattern-grid"
    >
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Url {
  readonly photos = photos;
  readonly label = itemLabel;
  // Read the address once rendered, so the server and the browser render the same.
  readonly photo = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.onPopState());
  }

  @HostListener("window:popstate")
  onPopState() {
    this.photo.set(photoInUrl());
  }

  follow(value: string | null) {
    followInUrl(value);
    this.photo.set(value);
  }
}
// #endregion example
```

`[value]` + `(valueChange)` rather than `[(value)]` because the change also writes the address.

## 6.12 hover

```tsx
// #region example
import { useEffect, useRef } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { productPhoto, thumbnailSrc } from "../shared";

export function Hover() {
  const image = useRef<HTMLImageElement>(null);
  // Magnifies the photo inside its own box under a resting mouse. Returns its cleanup.
  useEffect(() => hoverZoom(image.current!, productPhoto), []);
  return (
    <Fluidbox.Root items={[productPhoto]}>
      <Fluidbox.Trigger value={productPhoto.id} className="pattern-product" data-test="product">
        <img
          ref={image}
          src={thumbnailSrc(productPhoto)}
          alt={itemLabel(productPhoto)}
          width={640}
          height={640}
        />
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
```

```ts
// #region example
import {
  Directive,
  Component,
  ElementRef,
  inject,
  input,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import { itemLabel, type FluidboxImageItem } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { productPhoto, thumbnailSrc } from "../shared";

/** Magnifies its image inside its own box under a resting mouse. */
@Directive({ selector: "img[appHoverZoom]", standalone: true })
export class HoverZoom implements OnInit, OnDestroy {
  readonly appHoverZoom = input.required<FluidboxImageItem>();
  readonly #image = inject<ElementRef<HTMLImageElement>>(ElementRef);
  #stop?: () => void;

  ngOnInit() {
    this.#stop = hoverZoom(this.#image.nativeElement, this.appHoverZoom());
  }

  ngOnDestroy() {
    this.#stop?.();
  }
}

@Component({
  selector: "pattern-hover",
  standalone: true,
  imports: [FluidboxModule, HoverZoom],
  template: `
    <div fluidboxRoot [items]="[photo]">
      <button [fluidboxTrigger]="photo.id" class="pattern-product" data-test="product">
        <img
          [appHoverZoom]="photo"
          [src]="thumbnailSrc(photo)"
          [alt]="label(photo)"
          width="640"
          height="640"
        />
      </button>
    </div>
  `,
})
export class Hover {
  readonly photo = productPhoto;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
```

Unchanged apart from `value`: hover zoom is not a viewer part (§4.5).

## 6.13 media

```tsx
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { Embed } from "@ogdakke/fluidbox/react/embed";
import { Model } from "@ogdakke/fluidbox/react/model";
import { Spin } from "@ogdakke/fluidbox/react/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

// <model-viewer> loads when a model first comes on show.
const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);

export function Media() {
  return (
    <Fluidbox.Root items={productMedia}>
      <div className="pattern-grid">
        {productMedia.map((item) => (
          <Fluidbox.Trigger
            key={item.id}
            value={item.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* The photo is built in; the other items' types name these slides. */}
      <Fluidbox.Slides
        embed={() => <Embed />}
        spin={() => <Spin />}
        model={() => <Model load={loadModelViewer} />}
      />
    </Fluidbox.Root>
  );
}
// #endregion example
```

73 lines today, 30 here; the `AddonSlide` adapter and the `addon()` wrapper are gone.

```ts
// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { FluidboxEmbed } from "@ogdakke/fluidbox/angular/embed";
import { FluidboxModel } from "@ogdakke/fluidbox/angular/model";
import { FluidboxSpin } from "@ogdakke/fluidbox/angular/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

@Component({
  selector: "pattern-media",
  standalone: true,
  imports: [FluidboxModule, FluidboxEmbed, FluidboxSpin, FluidboxModel],
  template: `
    <div fluidboxRoot [items]="media" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
      <!-- The photo is built in; the other items' types name these slides. -->
      <ng-template fluidboxSlide="embed"><fluidbox-embed /></ng-template>
      <ng-template fluidboxSlide="spin"><fluidbox-spin /></ng-template>
      <ng-template fluidboxSlide="model"><fluidbox-model [load]="loadModelViewer" /></ng-template>
    </div>
  `,
})
export class Media {
  readonly media = productMedia;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
  // <model-viewer> loads when a model first comes on show.
  readonly loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);
}
// #endregion example
```

106 lines today, 33 here; the abstract directive and the three slide classes are gone.

## 6.14 Docs snippets

Every snippet outside the embedded patterns, checked against the new API. "Yes" means it can be
rewritten with the names in parts 1–3; the notes say how where it isn't a rename.

| Page                                         | Snippet                                                                    | Expressible | Notes                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| getting-started.md:32-45                     | an items array                                                             | yes         | `type: "image"`                                                                                                         |
| getting-started.md:77-91                     | `loading` table, `load()` in a `toggle` listener                           | yes         | `preload`; listen for `valuechange` with `action === "open"`                                                            |
| getting-started.md:97-102                    | add-on imports                                                             | yes         | `thumbnails`, `thumbnails.css`                                                                                          |
| getting-started.md:110-127                   | link trigger; guarded elements import                                      | yes         |                                                                                                                         |
| api.md:26-31                                 | `update({ labels, zoom })`                                                 | yes         |                                                                                                                         |
| api.md:61-71                                 | `labels`                                                                   | yes         |                                                                                                                         |
| react.md:27-62                               | gallery                                                                    | yes         | `value` on triggers                                                                                                     |
| react.md:143-147                             | `ThumbnailOverlay travel` + `FrameLayer`                                   | yes         | two `Overlay`s: `flight="frame"` (scrim) and `flight="live"` (count)                                                    |
| react.md:176-180                             | `Sheet`                                                                    | yes         |                                                                                                                         |
| react.md:196-207                             | `useFluidbox()` counter                                                    | yes         | or `<Fluidbox.Counter />`                                                                                               |
| nextjs.md:35-62                              | `imageItem(full.props, thumb.props)`                                       | yes         | unchanged; `type: "image"`                                                                                              |
| nextjs.md:74-105                             | client gallery with `Filmstrip`                                            | yes         | `Thumbnails`                                                                                                            |
| nextjs.md:151-188                            | page per photo with `open`/`index`                                         | yes         | `value` = the photo's id; the slug can be the id, which removes the index lookup                                        |
| nextjs.md:117-141, :190-207                  | pages router, page component                                               | yes         |                                                                                                                         |
| vue.md:27-60                                 | SFC gallery                                                                | yes         |                                                                                                                         |
| vue.md:116-122                               | root slot `{ status, index, count, open }`                                 | yes         |                                                                                                                         |
| vue.md:150-158                               | album trigger with overlay and frame layer                                 | yes         | two `Overlay`s                                                                                                          |
| vue.md:172-176                               | `Filmstrip` slot                                                           | yes         | `Thumbnails`                                                                                                            |
| vue.md:187-195                               | `@sheetchange`, `Sheet`, `SheetStop :stop`                                 | yes         | `<Fluidbox.Sheet @snap-change>`, `SheetSnap :to`                                                                        |
| vue.md:209-220                               | composables                                                                | yes         |                                                                                                                         |
| solid.md:27-65, :130-134, :151-155, :196-207 | gallery, album, overlay, counter                                           | yes         | as React                                                                                                                |
| angular.md:27-67, :132-136                   | component, `#fb="fluidbox"`, `(itemChange)`                                | yes         | `(valueChange)`                                                                                                         |
| angular.md:155-176                           | album with overlay and frame layer                                         | yes         | two `[fluidboxOverlay]`                                                                                                 |
| angular.md:198-203                           | `[renderers]="{ note: noteTemplate }"`                                     | yes         | `<ng-template fluidboxSlide="note">`                                                                                    |
| angular.md:230-246                           | `injectFluidbox()` counter                                                 | yes         |                                                                                                                         |
| custom-elements.md:31-50                     | gallery markup                                                             | yes         | `value` instead of `item-id`                                                                                            |
| custom-elements.md:151-156                   | `itemchange`, `subscribe`, `open("fjord")`                                 | yes         | `valuechange`                                                                                                           |
| custom-elements.md:181-189                   | viewer template with `<fluidbox-controls>` and a stop button               | yes         | `<fluidbox-toolbar>`, `data-fluidbox-sheet-snap`                                                                        |
| custom-elements.md:202-207                   | `strip.render` on `<fluidbox-filmstrip>`                                   | yes         | `<fluidbox-thumbnails>`                                                                                                 |
| javascript.md:27-56                          | `createFluidbox` + `bind(button, index)`                                   | yes         |                                                                                                                         |
| javascript.md:111-117                        | `update`                                                                   | yes         |                                                                                                                         |
| javascript.md:131-142                        | `FluidboxState`                                                            | yes         | `value` instead of `id`                                                                                                 |
| javascript.md:173-180                        | `beforeitemchange` with `reason === "wheel"`; `settle` with `replaceState` | yes         | `beforevaluechange` (check `action === "move"`), `valuechangecomplete`                                                  |
| javascript.md:198-205                        | `bind(cover, album[0], { returns, onPreviewChange })`                      | yes         | `bind(cover, album, { onPreviewChange })`                                                                               |
| javascript.md:222-235                        | `bindOverlay(…, { returns, travel: true })`; `travel: renderer`            | yes         | `flight: "copy"`; `flight: { live: renderer }`                                                                          |
| javascript.md:253-271                        | `viewer` + `data-fluidbox-description` + `subscribe(({ id }) …)`           | yes         | `({ value })`; or `caption` on items and `controls` keeps the defaults                                                  |
| javascript.md:296-313                        | `filmstrip: true`, `sheet: { snapPoints, render }`                         | yes         | `thumbnails: true`                                                                                                      |
| items-and-origins.md:22-64                   | items, `createItemList`, `FluidboxItemList`                                | yes         | unchanged                                                                                                               |
| items-and-origins.md:108-115                 | card with `data-fluidbox-origin`                                           | yes         | unchanged                                                                                                               |
| items-and-origins.md:127-134                 | `bind(cover, "dune", { returns, onPreviewChange })`                        | yes         | `bind(cover, ["dune", "canyon", "coast"], { onPreviewChange })`                                                         |
| items-and-origins.md:142-151                 | `FluidboxOriginAdapter` interface                                          | yes         | becomes the two option signatures                                                                                       |
| items-and-origins.md:155-168                 | `getOrigin(id)` returning `{ trigger, visual: img, thumbnail: img }`       | yes         | `findTrigger(item)` returning the button; `resolveOrigin` finds the same `img`                                          |
| items-and-origins.md:180-190                 | `revealOrigin(id, index, { signal })`                                      | yes         | `revealTrigger(item, index, { signal })`                                                                                |
| items-and-origins.md:201-216                 | `gallery.items` + `dataset.fluidboxItemId`                                 | yes         | `dataset.fluidboxValue`                                                                                                 |
| media.md:39-126                              | image, video, iframe items                                                 | yes         | `type: "image"`                                                                                                         |
| media.md:159-175                             | custom note through `renderers`                                            | yes         | `slides: { note }`; the renderer draws into `slide.media`                                                               |
| media.md:204-218                             | `imageItem`                                                                | yes         |                                                                                                                         |
| media.md:226-245                             | `createFluidbox<Photo>` with `viewer` + `subscribe`                        | yes         |                                                                                                                         |
| product-media.md:26-57                       | add-on items + `renderers`                                                 | yes         | `slides: { embed: embedSlide, spin: createSpinSlide(), model: createModelSlide({ load }) }`                             |
| product-media.md:98-100                      | `createModelRenderer({ load })`                                            | yes         | `createModelSlide`                                                                                                      |
| product-media.md:127-136                     | a slide renderer using `active` / `onActiveChange`                         | yes         | `target` → `slide.media`                                                                                                |
| styling.md (all)                             | CSS                                                                        | yes         | `data-fluidbox-overlay` → `data-fluidbox-viewer` in selectors; `:where([data-fluidbox-viewer], [data-fluidbox-flight])` |
| filmstrip-and-sheet.md:12-29, :41-69         | add-ons, `--fluidbox-filmstrip-axis`, `filmstrip: { render }`              | yes         | renamed                                                                                                                 |
| filmstrip-and-sheet.md:114-118               | `sheetchange` with `{ stop, reason }`                                      | yes         | `{ snap, reason }`                                                                                                      |
| filmstrip-and-sheet.md:140-169               | stop button, sheet CSS                                                     | yes         | `data-fluidbox-sheet-snap`                                                                                              |
| languages.md:187-261                         | labels, react-i18next, vue-i18n                                            | yes         |                                                                                                                         |
| patterns/index.md:32-223                     | example data                                                               | yes         | §6.0                                                                                                                    |
| patterns/zoom.md:23-28                       | `zoomTo`, `zoomIn`, `zoomOut`, `resetZoom`                                 | yes         | `zoomReset()`                                                                                                           |
| patterns/zoom.md:49-51                       | a `data-fluidbox-zoom-in` button                                           | yes         | unchanged                                                                                                               |
| patterns/zoom.md:67-77                       | `zoomSrcset`, `zoomSrc`                                                    | yes         | `zoom: { srcset, src }`                                                                                                 |
| patterns/zoom.md:85-89                       | `hoverZoom(card, photo, { scale })`                                        | yes         | unchanged                                                                                                               |

Not expressible: none. Two snippets change meaning slightly and the docs should say so:

- `media.md:159-175` (a custom note): with `slide.media` it now flies; drawing into `slide.layer`
  instead would make it fade. The page should show `media`.
- `getting-started.md:85-91` (`load()` on the first `toggle`): there is no "toggle" any more; the
  same code checks `event.action === "open"` on `valuechange`.
