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
    /** Each reachend the growing gallery heard: its value, index and count. */
    reachEnds: [string, number, number][];
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

/** Append photos to the growing gallery, up to `count` items. */
const growing = document.querySelector<HTMLElementTagNameMap["fluidbox-gallery"]>("#growing")!;
const grow = (count: number) => {
  for (let index = growing.children.length; index < count; index++) {
    const src = index % 2 ? "/photo-portrait.svg" : "/photo-square.svg";
    const item = document.createElement("fluidbox-item");
    item.setAttribute("value", `grow-${index}`);
    item.innerHTML = `<button slot="trigger" type="button" data-item="grow-${index}"><img src="${src}" alt="Photo grow-${index}" width="160" height="160" /></button><template slot="content"><img src="${src}" alt="Photo grow-${index}" width="800" height="800" /></template>`;
    growing.append(item);
  }
};
grow(4);
window.reachEnds = [];
growing.addEventListener("reachend", (event) => {
  const { value, index, count } = event;
  window.reachEnds.push([value, index, count]);
  grow(count + 4);
});
