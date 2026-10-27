import resets from "./site-resets.css?raw";
import { mountSite } from "../src/site";
import {
  createFluidbox,
  itemLabel,
  type FluidboxControlName,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
  type FluidboxItem,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/thumbnails";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import "./resets.css";

const params = new URLSearchParams(location.search);

// Typical unlayered resets, ahead of every other stylesheet, as a site loads them.
if (params.has("resets")) {
  const style = document.createElement("style");
  style.dataset.siteResets = "";
  style.textContent = resets;
  document.head.prepend(style);
}
if (params.has("rtl")) document.documentElement.dir = "rtl";

mountSite("fixtures", { fixture: "Resets · the viewer's geometry under unlayered site resets" });

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    map: FluidboxCustomItemBase<"map">;
  }
}

const photo = (id: string, src: string, fields: Partial<FluidboxImageItem> = {}) =>
  ({
    type: "image",
    id,
    src,
    alt: `Photo ${id}`,
    width: 800,
    height: 800,
    thumbnail: { src },
    ...fields,
  }) satisfies FluidboxImageItem;

const items: FluidboxItem[] = [
  photo("square", "/photo-square.svg"),
  photo("portrait", "/photo-portrait.svg", { width: 800, height: 1200, download: false }),
  {
    type: "video",
    id: "video",
    src: "/video/drift.webm",
    poster: "/video/drift-poster.jpg",
    title: "Drift",
    width: 640,
    height: 360,
    muted: true,
    thumbnail: { src: "/video/drift-poster.jpg" },
  },
  { type: "map", id: "map", title: "Map", fit: "fill", width: 600, height: 600 },
];

const controls = params.get("controls")?.split(",") as FluidboxControlName[] | undefined;

const fluidbox = createFluidbox({
  items,
  ...(controls ? { controls } : {}),
  thumbnails: params.has("thumbnails"),
  shareUrl: (item) => `/resets.html#${item.id}`,
  slides: {
    map: ({ media }) => {
      const art = document.createElement("div");
      art.className = "resets-map";
      media.append(art);
    },
  },
});

const root = document.querySelector<HTMLElement>("#resets")!;
for (const item of items) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.item = item.id;
  button.setAttribute("aria-label", `Open ${itemLabel(item)}`);
  const image = document.createElement("img");
  image.alt = "";
  image.src =
    item.type === "image" ? item.src : item.type === "video" ? item.poster! : "/map-preview.svg";
  button.append(image);
  root.append(button);
  fluidbox.bind(button, item);
}

Object.assign(window, { resetsFixture: { fluidbox, items } });
document.documentElement.dataset.fixtureReady = "";
