import "@angular/compiler";
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  provideZonelessChangeDetection,
  signal,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { useFluidboxGallery } from "@ogdakke/fluidbox/angular";
import type { AppGallery, LightboxGallerySource } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./site.css";

@Component({
  selector: "fluidbox-harness",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<main>
    <h1>Angular gallery</h1>
    <button type="button" (click)="switchSource()">Switch source</button>
    <app-gallery>
      <button type="button" (click)="open()">Open gallery</button>
    </app-gallery>
  </main>`,
})
class App {
  readonly source = signal<LightboxGallerySource | null>(source);
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    useFluidboxGallery(
      () => this.host.nativeElement.querySelector<AppGallery>("app-gallery"),
      this.source,
    );
  }

  open(): void {
    this.host.nativeElement.querySelector<AppGallery>("app-gallery")?.open(0);
  }

  switchSource(): void {
    this.source.set(alternateSource);
  }
}

void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });
