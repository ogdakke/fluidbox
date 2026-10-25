import "@angular/compiler";
import { mountSite } from "../src/site";
import {
  Component,
  Input,
  provideZonelessChangeDetection,
  signal,
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
    held: FluidboxCustomItemBase<"held">;
    reel: FluidboxCustomItemBase<"reel">;
  }
}

/** Whether the lazy slide's @defer block may show. */
const lazyReady = signal(false);

/** What the slides saw, and the gates the tests open. */
const fixture = {
  /** Lets the lazy slide's @defer block show. */
  resolveLazy: () => lazyReady.set(true),
  /** Settles the held slide's waitUntil promise. */
  openGate: undefined as (() => void) | undefined,
  /** Each reel slide's origin, read again whenever the test asks. */
  reels: [] as { index: number; read: () => FluidboxSlideOrigin | null }[],
  /** Each held slide's index, read again whenever the test asks. */
  held: [] as { id: string; read: () => number }[],
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

const custom = (type: "lazy" | "held" | "reel", id: string): FluidboxItem => ({
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

/** The content a @defer block shows once the test lets it. */
@Component({
  selector: "app-lazy-card",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <ng-template fluidboxMedia>
      <div class="media-probe" data-test="lazy-card">Loaded</div>
    </ng-template>
  `,
})
class LazyCard {}

@Component({
  selector: "app-held",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <ng-template fluidboxMedia>
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
    <h2>A viewer of parts</h2>
    <div fluidboxRoot [items]="parted">
      <app-grid [items]="parted" id="parts" />
      <ng-template fluidboxViewer>
        <div fluidboxToolbar></div>
        <button fluidboxFullscreen data-test="fullscreen"></button>
        <a fluidboxDownload data-test="download"></a>
        <button fluidboxShare data-test="share">Pass it on</button>
        <span fluidboxCounter data-test="counter"></span>
        <p fluidboxCaption data-test="caption"></p>
        <ng-template fluidboxError let-item>
          <p data-test="error">{{ item.alt }} didn't load.</p>
          <button fluidboxRetry data-test="retry"></button>
        </ng-template>
      </ng-template>
    </div>
    <h2>A slide that defers</h2>
    <div fluidboxRoot [items]="lazy">
      <app-grid [items]="lazy" id="lazy" />
      <ng-template fluidboxSlide="lazy">
        @defer (when lazyReady()) {
          <app-lazy-card />
        } @placeholder {
          <p data-test="lazy-placeholder">Waiting</p>
        }
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
  readonly lazy = [custom("lazy", "lazy")];
  readonly lazyReady = lazyReady;
  readonly reels = reels;
  readonly held = signal<FluidboxItem[]>([custom("held", "held-a"), custom("held", "held-b")]);

  constructor() {
    fixture.setHeldItems = (items) => this.held.set(items);
  }
}

document.querySelector("#root")!.append(document.createElement("angular-slides"));
void bootstrapApplication(Slides, { providers: [provideZonelessChangeDetection()] });
