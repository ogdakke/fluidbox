import { mountSite } from "../src/site";
import { createFluidbox } from "@ogdakke/fluidbox";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import "./headless.css";

mountSite("fixtures", {
  fixture: "Lifecycle · a fluidbox the browser suite drives through window.lifecycle",
});

const item = (id: string, src: string, width: number, height: number): FluidboxImageItem => ({
  id,
  type: "image",
  src,
  alt: `Study ${id}`,
  width,
  height,
});

const items = [
  item("one", "/photo-square.svg", 800, 800),
  item("two", "/photo-portrait.svg", 600, 900),
  item("three", "/first.svg", 600, 400),
];

const origins = {
  getOrigin(id: string) {
    const trigger = document.querySelector<HTMLElement>(`[data-photo-id="${id}"]`);
    const visual = trigger?.querySelector<HTMLImageElement>("img");
    return trigger && visual ? { trigger, visual, thumbnail: visual } : null;
  },
};

declare global {
  interface Window {
    lifecycle: {
      createFluidbox: typeof createFluidbox;
      items: typeof items;
      item: typeof item;
      origins: typeof origins;
    };
  }
}

window.lifecycle = { createFluidbox, items, item, origins };
document.body.dataset.lifecycleReady = "";
