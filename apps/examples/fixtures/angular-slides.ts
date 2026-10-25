import "@angular/compiler";
import { mountSite } from "../src/site";
import {
  Component,
  Input,
  provideZonelessChangeDetection,
  signal,
  ɵDEFER_BLOCK_DEPENDENCY_INTERCEPTOR as DEFER_BLOCK_DEPENDENCY_INTERCEPTOR,
  type OnInit,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxSlideOrigin,
} from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidboxSlide } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";

mountSite("fixtures", {
  fixture: "Angular slides · content that defers, holds the open, or plays on its own",
});

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    lazy: FluidboxCustomItemBase<"lazy">;
    layered: FluidboxCustomItemBase<"layered">;
    tap: FluidboxCustomItemBase<"tap">;
    held: FluidboxCustomItemBase<"held">;
    reel: FluidboxCustomItemBase<"reel">;
  }
}

/**
 * Until the test lets them, every @defer block's dependencies stay loading,
 * as a slow chunk would: the page compiles in the browser, where a block has
 * nothing of its own to load. Angular's development builds take this hook.
 */
let openLoads!: () => void;
const loads = new Promise<void>((resolve) => (openLoads = resolve));
const slowLoads = {
  intercept: (load: (() => Promise<unknown>[]) | null) => (): Promise<unknown>[] => [
    // A loaded dependency is a component, as an import of its chunk gives.
    loads.then(() => LazyCard),
    ...(load?.() ?? []),
  ],
  setInterceptor: () => {},
};

/** What the slides saw, and the gates the tests open. */
const fixture = {
  /** Lets the @defer blocks' dependencies finish loading. */
  resolveLazy: () => openLoads(),
  /** Settles the held slide's waitUntil promise. */
  openGate: undefined as (() => void) | undefined,
  /** Each reel slide's origin, read again whenever the test asks. */
  reels: [] as { index: number; read: () => FluidboxSlideOrigin | null }[],
  /** Each held slide's index, read again whenever the test asks. */
  held: [] as { id: string; read: () => number }[],
  /** What the bound viewer's [(value)] emitted, and the actions its beforeValueChange cancels. */
  values: [] as (string | null)[],
  cancel: [] as string[],
  /** The items of the held viewer, which the test can change. */
  setHeldItems: undefined as ((items: FluidboxItem[]) => void) | undefined,
};
Object.assign(window, { angularSlides: fixture });

const photo = (id: string, src: string): FluidboxImageItem => ({
  type: "image",
  id,
  src,
  alt: `Photo ${id}`,
  width: 800,
  height: 800,
});
const photos = [photo("one", "/photo-square.svg"), photo("two", "/photo-portrait.svg")];

/** A viewer of parts: the second photo's file is missing. */
const parted: FluidboxImageItem[] = [
  { ...photo("ok", "/photo-square.svg"), caption: "A square photo" },
  { ...photo("missing", "/missing-photo.svg"), caption: "A photo that is not there" },
];

const custom = (type: "lazy" | "layered" | "tap" | "held" | "reel", id: string): FluidboxItem => ({
  type,
  id,
  title: `${type} ${id}`,
  width: 800,
  height: 600,
});
const reels = [custom("reel", "reel-a"), custom("reel", "reel-b")];

const gate = new Promise<void>((resolve) => (fixture.openGate = resolve));

@Component({
  selector: "app-grid",
  standalone: true,
  imports: [FluidboxModule],
  host: { class: "media-grid" },
  template: `
    @for (item of items; track item.id) {
      <button [fluidboxTrigger]="item.id!" [attr.data-item]="item.id">
        <img alt="" [src]="item.type === 'image' ? item.src : '/photo-square.svg'" />
      </button>
    }
  `,
})
class Grid {
  @Input({ required: true }) items!: readonly FluidboxItem[];
}

/** The content a @defer block shows once its dependencies have loaded. */
@Component({
  selector: "app-lazy-card",
  standalone: true,
  host: { class: "media-probe", "data-test": "lazy-card" },
  template: `Loaded`,
})
class LazyCard {}

@Component({
  selector: "app-held",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <ng-template
      fluidboxMedia
      [class]="'held-box'"
      [attributes]="{ 'data-test': 'held-box', style: 'outline: 2px solid tomato' }"
    >
      <div class="media-probe" data-test="held-card">
        {{ slide.item().title }} at {{ slide.index() }}
      </div>
    </ng-template>
  `,
})
class Held implements OnInit {
  readonly slide = injectFluidboxSlide<FluidboxCustomItemBase<"held">>();

  ngOnInit(): void {
    this.slide.waitUntil(gate);
    fixture.held.push({ id: this.slide.item().id!, read: () => this.slide.index() });
  }
}

@Component({
  selector: "app-reel",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <ng-template fluidboxMedia>
      <div class="media-probe" data-test="reel">{{ slide.item().title }}</div>
    </ng-template>
  `,
})
class Reel implements OnInit {
  readonly slide = injectFluidboxSlide<FluidboxCustomItemBase<"reel">>();

  ngOnInit(): void {
    const slide = this.slide;
    fixture.reels.push({ index: slide.index(), read: () => slide.origin });
    // As a player of your own would: it hands its time back on close.
    slide.returnPlayback({ currentTime: 2.5, paused: false });
  }
}

@Component({
  selector: "angular-slides",
  standalone: true,
  imports: [FluidboxModule, Grid, LazyCard, Held, Reel],
  template: `
    <p id="outside">The page around the viewers.</p>
    <h2>Built-in images, and the same through a slide of your own</h2>
    <div fluidboxRoot [items]="photos">
      <app-grid [items]="photos" id="builtin" />
    </div>
    <div fluidboxRoot [items]="photos">
      <app-grid [items]="photos" id="custom" />
      <ng-template fluidboxSlide="image"><fluidbox-image /></ng-template>
    </div>
    @if (openOnLoad) {
      <h2>A viewer open on its first render</h2>
      <div fluidboxRoot [items]="photos" [defaultValue]="openOnLoad">
        <app-grid [items]="photos" id="opened" />
      </div>
    }
    <h2>A viewer bound with [(value)] that cancels some changes</h2>
    <div
      fluidboxRoot
      [items]="photos"
      [(value)]="bound"
      (valueChange)="values.push($event ?? null)"
      (beforeValueChange)="cancel.includes($event.action) && $event.preventDefault()"
    >
      <app-grid [items]="photos" id="bound" />
    </div>
    <h2>A viewer of parts</h2>
    <div fluidboxRoot [items]="parted">
      <app-grid [items]="parted" id="parts" />
      <ng-template fluidboxViewer>
        <div fluidboxToolbar></div>
        <button fluidboxFullscreen data-test="fullscreen"></button>
        <button fluidboxZoomIn disabled data-test="zoom-in-off"></button>
        <a fluidboxDownload data-test="download"></a>
        <button fluidboxShare data-test="share">Pass it on</button>
        <span fluidboxCounter data-test="counter"></span>
        <span fluidboxCounter data-test="counter-of"
          ><ng-template let-index="index" let-count="count"
            >Photo {{ index + 1 }} of {{ count }}</ng-template
          ></span
        >
        <p fluidboxCaption data-test="caption"></p>
        <ng-template fluidboxError let-item>
          <p data-test="error">{{ item.alt }} didn't load.</p>
          <button fluidboxRetry data-test="retry"></button>
        </ng-template>
      </ng-template>
    </div>
    <h2>Slides that defer</h2>
    <div fluidboxRoot [items]="lazy">
      <app-grid [items]="lazy" id="lazy" />
      <!-- Loading in the media: the open waits for it. -->
      <ng-template fluidboxSlide="lazy">
        <ng-template fluidboxMedia>
          @defer (on immediate) {
            <app-lazy-card />
          } @placeholder {
            <p data-test="lazy-placeholder">Waiting</p>
          }
        </ng-template>
      </ng-template>
      <!-- Loading in the layer around the media: the open doesn't wait. -->
      <ng-template fluidboxSlide="layered">
        <ng-template fluidboxMedia>
          <div class="media-probe" data-test="layered-card">In the box</div>
        </ng-template>
        @defer (on immediate) {
          <p data-test="layered-note">Beside the box</p>
        } @placeholder {
          <p data-test="layered-placeholder">Waiting</p>
        }
      </ng-template>
      <!-- Waiting for a press: the open doesn't wait either. -->
      <ng-template fluidboxSlide="tap">
        <ng-template fluidboxMedia>
          @defer (on interaction) {
            <app-lazy-card />
          } @placeholder {
            <button type="button" class="media-probe" data-test="tap">Load</button>
          }
        </ng-template>
      </ng-template>
    </div>
    <h2>A slide that holds the open</h2>
    <div fluidboxRoot [items]="held()">
      <app-grid [items]="held()" id="held" />
      <ng-template fluidboxSlide="held"><app-held /></ng-template>
    </div>
    <h2>A player of your own that continues the trigger's video</h2>
    <div fluidboxRoot [items]="reels">
      <div class="media-grid" id="reels">
        <button fluidboxTrigger="reel-a" data-item="reel-a">
          <video
            data-fluidbox-origin
            autoplay
            loop
            [muted]="true"
            playsinline
            src="/video/drift.webm"
          ></video>
        </button>
        <button fluidboxTrigger="reel-b" data-item="reel-b">
          <img alt="" src="/video/drift-poster.jpg" />
        </button>
      </div>
      <ng-template fluidboxSlide="reel"><app-reel /></ng-template>
    </div>
  `,
})
class Slides {
  readonly photos = photos;
  readonly parted = parted;
  // ?open=two opens a viewer on its first render, on the copy it renders.
  readonly openOnLoad = new URLSearchParams(location.search).get("open");
  bound: string | null = null;
  readonly values = fixture.values;
  readonly cancel = fixture.cancel;
  readonly lazy = [custom("lazy", "lazy"), custom("layered", "layered"), custom("tap", "tap")];
  readonly reels = reels;
  readonly held = signal<FluidboxItem[]>([custom("held", "held-a"), custom("held", "held-b")]);

  constructor() {
    fixture.setHeldItems = (items) => this.held.set(items);
  }
}

document.querySelector("#root")!.append(document.createElement("angular-slides"));
void bootstrapApplication(Slides, {
  providers: [
    provideZonelessChangeDetection(),
    { provide: DEFER_BLOCK_DEPENDENCY_INTERCEPTOR, useValue: slowLoads },
  ],
});
