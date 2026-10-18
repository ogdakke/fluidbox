import "@angular/compiler";
import {
  type AfterViewInit,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  provideZonelessChangeDetection,
  signal,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { useFluidboxGallery } from "@ogdakke/fluidbox/angular";
import type { AppGallery, LightboxItem } from "@ogdakke/fluidbox";
import {
  artSrc,
  formatCount,
  frameworkCollections,
  indexedArt,
  windowSize,
  windowStart,
} from "../art";
import { originsWithin } from "./origins";

const collections = frameworkCollections("angular");

/** Shared host wiring: find the rendered gallery and resolve origins from its cards. */
abstract class GalleryHost implements AfterViewInit {
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    const gallery = this.gallery();
    if (gallery) gallery.origins = originsWithin(() => this.gallery());
  }

  gallery(): AppGallery | null {
    return this.host.nativeElement.querySelector<AppGallery>("app-gallery");
  }
}

@Component({
  selector: "fluidbox-angular-gallery",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<article class="framework-panel">
    <header class="framework-panel__head">
      <h3>Angular</h3>
      <button type="button" class="fb-button fb-button--small" (click)="switchSource()">
        Switch source <span aria-hidden="true">→ {{ nextLabel() }}</span>
      </button>
    </header>
    <app-gallery class="thumb-row" aria-label="Angular gallery">
      @for (item of collection().items; track item.id; let index = $index) {
        <button
          type="button"
          class="fb-thumb"
          [attr.data-origin-id]="item.id"
          [attr.aria-label]="'Open ' + label(item)"
          (click)="open(index)"
        >
          <img [src]="item.thumbnail?.src" alt="" />
        </button>
      }
      <app-filmstrip></app-filmstrip>
    </app-gallery>
    <code class="framework-panel__api">useFluidboxGallery(() =&gt; gallery, source)</code>
  </article>`,
})
class AngularGallery extends GalleryHost {
  readonly current = signal(0);
  readonly collection = computed(() => collections[this.current()]!);
  readonly nextLabel = computed(() => collections[1 - this.current()]!.label);
  readonly source = computed(() => this.collection().source);

  constructor() {
    super();
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  label(item: LightboxItem): string {
    return item.media.type === "image" ? item.media.alt : item.id;
  }

  open(index: number): void {
    void this.gallery()?.open({ index });
  }

  switchSource(): void {
    this.current.update((index) => 1 - index);
  }
}

const indexed = indexedArt(100_000);

@Component({
  selector: "fluidbox-angular-indexed",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<div>
    <form class="jump" (submit)="submit($event)">
      <label class="fb-label" for="angular-jump">Open item</label>
      <input
        id="angular-jump"
        class="fb-input"
        type="number"
        min="1"
        [attr.max]="count"
        [value]="requested()"
        (input)="requested.set($any($event.target).value)"
      />
      <button type="submit" class="fb-button fb-button--primary">Open</button>
      <output class="jump__window">{{ windowLabel() }}</output>
    </form>
    <app-gallery class="virtual-grid" aria-label="Angular indexed gallery">
      @for (index of indices(); track index) {
        <button
          type="button"
          class="virtual-card"
          [attr.data-origin-id]="index"
          [attr.aria-label]="'Open gallery item ' + (index + 1)"
          (click)="open(index)"
        >
          <img [src]="src(index)" alt="" data-lightbox-origin />
          <span>#{{ format(index + 1) }}</span>
        </button>
      }
      <app-filmstrip></app-filmstrip>
    </app-gallery>
  </div>`,
})
class AngularIndexed extends GalleryHost {
  readonly count = indexed.count;
  readonly source = signal(indexed.source);
  readonly start = signal(0);
  readonly requested = signal("50000");
  readonly indices = computed(() =>
    Array.from(
      { length: Math.min(windowSize, this.count - this.start()) },
      (_, offset) => this.start() + offset,
    ),
  );
  readonly windowLabel = computed(
    () =>
      `Showing ${formatCount(this.start() + 1)}–${formatCount(this.start() + this.indices().length)} of ${formatCount(this.count)}`,
  );
  constructor() {
    super();
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  src(index: number): string {
    return artSrc(indexed.sceneAt(index));
  }

  format(value: number): string {
    return formatCount(value);
  }

  open(index: number): void {
    void this.gallery()?.open({ index });
  }

  submit(event: Event): void {
    event.preventDefault();
    const index = Math.max(0, Math.min(this.count - 1, Number(this.requested()) - 1));
    this.start.set(windowStart(index, this.count));
    // Zoneless change detection renders on the next frame; open once the window is mounted.
    requestAnimationFrame(() => this.open(index));
  }
}

function bootstrap(root: HTMLElement, selector: string, component: new () => unknown): void {
  root.append(document.createElement(selector));
  void bootstrapApplication(component, { providers: [provideZonelessChangeDetection()] });
}

export function mount(root: HTMLElement): void {
  bootstrap(root, "fluidbox-angular-gallery", AngularGallery);
}

export function mountIndexed(root: HTMLElement): void {
  bootstrap(root, "fluidbox-angular-indexed", AngularIndexed);
}
