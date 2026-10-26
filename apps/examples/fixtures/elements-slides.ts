import type { FluidboxGalleryElement } from "@ogdakke/fluidbox/elements";
import { mountSite } from "../src/site";
import "@ogdakke/fluidbox/baseline.css";
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/elements/embed";
import "@ogdakke/fluidbox/elements/model";
import "@ogdakke/fluidbox/elements/spin";
import "./media.css";
import "./elements-slides.css";

mountSite("fixtures", {
  fixture: "Custom elements · slide templates, the parts, and the add-ons read from markup",
});

declare global {
  interface Window {
    /** Defines the page's own `<model-viewer>`, as a page loading Google's script would. */
    defineModelViewer: () => void;
    /** The gallery events, in order: `type value`. */
    galleryEvents: string[];
  }
}

// A stand-in for Google's element: it loads as soon as it has a src.
window.defineModelViewer = () => {
  if (customElements.get("model-viewer")) return;
  customElements.define(
    "model-viewer",
    class extends HTMLElement {
      connectedCallback() {
        requestAnimationFrame(() => this.dispatchEvent(new Event("load")));
      }
    },
  );
};

window.galleryEvents = [];
for (const gallery of document.querySelectorAll("fluidbox-gallery")) {
  for (const type of ["beforevaluechange", "valuechange", "mediaerror"]) {
    gallery.addEventListener(type, (event) => {
      const { value, item } = event as Event & { value?: string | null; item?: { id: string } };
      window.galleryEvents.push(`${type} ${value ?? item?.id ?? null}`);
    });
  }
}

// A slideshow slow enough that the test sees it play without it moving on.
document.querySelector<FluidboxGalleryElement>("#slideshow")!.slideshow = { interval: 60_000 };
