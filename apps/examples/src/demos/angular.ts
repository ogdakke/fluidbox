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
import { frameworkCollections } from "../art";
import { originsWithin } from "./origins";

const collections = frameworkCollections("angular");

@Component({
  selector: "fluidbox-angular-demo",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<article class="framework-panel">
    <header class="framework-panel__head">
      <h3>Angular</h3>
      <button type="button" class="chip" (click)="switchSource()">
        Switch source <span aria-hidden="true">→ {{ nextLabel() }}</span>
      </button>
    </header>
    <app-gallery class="thumb-row" aria-label="Angular gallery">
      @for (item of collection().items; track item.id; let index = $index) {
        <button
          type="button"
          class="thumb"
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
class AngularDemo implements AfterViewInit {
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly current = signal(0);
  readonly collection = computed(() => collections[this.current()]!);
  readonly nextLabel = computed(() => collections[1 - this.current()]!.label);
  readonly source = computed(() => this.collection().source);

  constructor() {
    useFluidboxGallery(() => this.gallery(), this.source);
  }

  ngAfterViewInit(): void {
    const gallery = this.gallery();
    if (gallery) gallery.origins = originsWithin(() => this.gallery());
  }

  gallery(): AppGallery | null {
    return this.host.nativeElement.querySelector<AppGallery>("app-gallery");
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

export function mount(root: HTMLElement): void {
  root.append(document.createElement("fluidbox-angular-demo"));
  void bootstrapApplication(AngularDemo, { providers: [provideZonelessChangeDetection()] });
}
