import { mountSite } from "../src/site";
import "@ogdakke/fluidbox/baseline.css";
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/elements/embed";
import "@ogdakke/fluidbox/elements/model";
import "@ogdakke/fluidbox/elements/spin";
import "./media.css";
import "./elements-slides.css";
import { growingPhotos, growth, reached } from "./growing";

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

/** The growing gallery: its first `count` photos, as items in its markup. */
const growing = document.querySelector<HTMLElementTagNameMap["fluidbox-gallery"]>("#growing")!;
growth.setCount = (count) => {
  const photos = growingPhotos(count);
  while (growing.children.length > count) growing.lastElementChild!.remove();
  for (const photo of photos.slice(growing.children.length)) {
    const item = document.createElement("fluidbox-item");
    item.setAttribute("value", photo.id!);
    item.innerHTML = `<button slot="trigger" type="button" data-item="${photo.id}"><img src="${photo.src}" alt="${photo.alt}" width="160" height="160" /></button><template slot="content"><img src="${photo.src}" alt="${photo.alt}" width="${photo.width}" height="${photo.height}" /></template>`;
    growing.append(item);
  }
};
growth.setThreshold = (threshold) => (growing.reachEndThreshold = threshold);
growth.setCount(4);
growing.addEventListener("reachend", (event) => {
  const next = reached(event);
  if (next) growth.setCount(next);
});
