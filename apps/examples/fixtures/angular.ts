import { mountSite } from "../src/site";
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
import type { FluidboxGalleryElement, FluidboxItem, FluidboxSource } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./frameworks.css";

mountSite("fixtures", { fixture: "Angular binding · indexed gallery with source replacement" });

@Component({
  selector: "fluidbox-harness",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<main>
    <h1>Angular gallery</h1>
    <button type="button" (click)="switchSource()">Switch source</button>
    <fluidbox-gallery>
      <button type="button" (click)="open()">Open gallery</button>
    </fluidbox-gallery>
  </main>`,
})
class App {
  readonly source = signal<FluidboxSource<FluidboxItem> | null>(source);
  readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    useFluidboxGallery(
      () => this.host.nativeElement.querySelector<FluidboxGalleryElement>("fluidbox-gallery"),
      this.source,
    );
  }

  open(): void {
    void this.host.nativeElement
      .querySelector<FluidboxGalleryElement>("fluidbox-gallery")
      ?.open({ index: 0 });
  }

  switchSource(): void {
    this.source.set(alternateSource);
  }
}

void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });
