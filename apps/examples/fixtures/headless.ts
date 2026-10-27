import { mountSite } from "../src/site";
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/thumbnails";
import type {
  Fluidbox,
  FluidboxCustomItemBase,
  FluidboxItem,
  FluidboxSlides,
} from "@ogdakke/fluidbox";
import "./headless.css";

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    demo: FluidboxCustomItemBase<"demo">;
  }
}

mountSite("fixtures", {
  fixture: "Headless runtime · custom renderers, a protected viewer, and a secondary viewer",
});

type DemoItem = FluidboxItem;

const items: readonly DemoItem[] = [
  {
    id: "one",
    type: "image",
    src: "/photo-square.svg",
    alt: "Blue square study",
    width: 800,
    height: 800,
    srcset: "/photo-square.svg 400w, /photo-square.svg 800w",
    sizes: "min(100vw, 800px)",
    sources: [
      {
        media: "(min-width: 1px)",
        srcset: "/photo-square.svg 800w",
        sizes: "min(100vw, 800px)",
      },
    ],
    placeholder: "/photo-square.svg",
    thumbnail: { src: "/photo-square.svg" },
  },
  {
    id: "two",
    type: "image",
    src: "/photo-portrait.svg",
    alt: "Orange portrait study",
    width: 600,
    height: 900,
  },
];

const findTrigger = (item: DemoItem) =>
  document.querySelector<HTMLElement>(`[data-photo-id="${item.id}"]`);
const increment = (name: string) => {
  document.body.dataset[name] = String(Number(document.body.dataset[name] ?? 0) + 1);
};
const slides = {
  demo({ media: target, item, signal }) {
    increment("customMounts");
    const content = document.createElement("button");
    content.type = "button";
    content.dataset.testCustomMedia = "";
    content.textContent = `Custom ${item.id}`;
    target.append(content);
    signal.addEventListener("abort", () => increment("customAborts"), { once: true });
    return () => increment("customDisposals");
  },
} satisfies FluidboxSlides<DemoItem>;

const viewer: Fluidbox<DemoItem> = createFluidbox({
  items,
  findTrigger,
  slides,
  viewer({ target, fluidbox, signal }) {
    const controls = document.createElement("div");
    controls.dataset.demoControls = "";
    controls.innerHTML = `
      <button type="button" data-demo-previous aria-label="Previous image">Previous</button>
      <p data-demo-caption></p>
      <button type="button" data-demo-next aria-label="Next image">Next</button>
      <button type="button" data-demo-close aria-label="Close viewer">Close</button>
    `;
    const caption = controls.querySelector<HTMLElement>("[data-demo-caption]")!;
    const sync = () => {
      const state = fluidbox.state;
      caption.textContent = state.value ?? "";
      controls.querySelector<HTMLButtonElement>("[data-demo-previous]")!.disabled =
        !state.hasPrevious;
      controls.querySelector<HTMLButtonElement>("[data-demo-next]")!.disabled = !state.hasNext;
    };
    const disposeState = fluidbox.subscribe(sync);
    controls
      .querySelector("[data-demo-previous]")!
      .addEventListener("click", () => void fluidbox.previous(), { signal });
    controls
      .querySelector("[data-demo-next]")!
      .addEventListener("click", () => void fluidbox.next(), { signal });
    controls
      .querySelector("[data-demo-close]")!
      .addEventListener("click", () => void fluidbox.close(), { signal });
    target.append(controls);
    sync();
    return () => {
      disposeState();
      controls.remove();
    };
  },
});
const secondaryViewer: Fluidbox<DemoItem> = createFluidbox({
  items,
  findTrigger,
  slides,
});
// The thumbnails is an option: its code loads only with the side-effect import.
const thumbnailsViewer: Fluidbox<DemoItem> = createFluidbox({
  items,
  findTrigger,
  slides,
  thumbnails: true,
});
const protectedViewer: Fluidbox<DemoItem> = createFluidbox({
  items,
  findTrigger,
  slides,
});
protectedViewer.addEventListener("beforevaluechange", (event) => {
  if (event.action === "close") event.preventDefault();
});

for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo-id]")) {
  viewer.bind(trigger, trigger.dataset.photoId!);
}

declare global {
  interface Window {
    headlessViewer: typeof viewer;
    headlessSecondaryViewer: typeof secondaryViewer;
    headlessProtectedViewer: typeof protectedViewer;
    headlessThumbnailsViewer: typeof thumbnailsViewer;
    loadSheet: () => Promise<unknown>;
  }
}

window.headlessViewer = viewer;
window.headlessSecondaryViewer = secondaryViewer;
window.headlessThumbnailsViewer = thumbnailsViewer;
window.headlessProtectedViewer = protectedViewer;
// The sheet add-on loads on demand, so the other headless tests run without it.
window.loadSheet = () =>
  Promise.all([import("@ogdakke/fluidbox/sheet"), import("@ogdakke/fluidbox/sheet.css")]);
