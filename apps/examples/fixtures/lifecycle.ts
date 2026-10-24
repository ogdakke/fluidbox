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

const findTrigger = (found: { readonly id?: string }) =>
  document.querySelector<HTMLElement>(`[data-photo-id="${found.id}"]`);

declare global {
  interface Window {
    lifecycle: {
      createFluidbox: typeof createFluidbox;
      items: typeof items;
      item: typeof item;
      findTrigger: typeof findTrigger;
    };
  }
}

window.lifecycle = { createFluidbox, items, item, findTrigger };
document.body.dataset.lifecycleReady = "";
