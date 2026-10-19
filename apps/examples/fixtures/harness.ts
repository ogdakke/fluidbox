import { mountSite } from "../src/site";
import type { FluidboxItemList, FluidboxOriginAdapter } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/elements";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox/elements";
import "./site.css";

mountSite("fixtures", {
  fixture:
    "Harness · query flags: count, virtual, shadow, no-filmstrip, iframe, iframes, pictures, viewer-template",
});

const root = document.querySelector<HTMLElement>("#fixture")!;
const params = new URLSearchParams(location.search);
const count = Math.min(
  params.has("virtual") ? 1_000_000 : 20_000,
  Math.max(1, Number(params.get("count")) || 3),
);
const shadow = params.has("shadow");
const filmstrip = !params.has("no-filmstrip");
const target = shadow ? root.attachShadow({ mode: "open" }) : root;
if (shadow) {
  const style = document.createElement("style");
  style.textContent =
    "fluidbox-gallery { display: flex; gap: 16px } fluidbox-item { display: block; width: 120px } fluidbox-item > button { all: unset; display: block; cursor: pointer } fluidbox-item img { width: 100%; height: auto }";
  target.append(style);
}
if (params.has("virtual")) {
  const gallery = document.createElement("fluidbox-gallery") as FluidboxGalleryElement;
  gallery.setAttribute("aria-label", "Virtual source gallery");
  target.append(gallery);
  const origins = new Map<string, HTMLElement>();
  const items: FluidboxItemList = {
    count,
    get(index) {
      const src = index % 2 ? "/second.svg" : "/first.svg";
      return {
        id: String(index),
        type: "img",
        src,
        alt: `Virtual item ${index + 1}`,
        width: 600,
        height: 400,
        thumbnail: { src, width: 600, height: 400 },
      };
    },
    indexOf(id) {
      const index = Number(id);
      return Number.isInteger(index) && index >= 0 && index < count ? index : -1;
    },
  };
  const originAdapter: FluidboxOriginAdapter = {
    getOrigin(id) {
      const trigger = origins.get(id);
      return trigger ? { trigger, visual: trigger } : null;
    },
  };
  gallery.items = items;
  gallery.origins = originAdapter;
  function renderWindow(start: number) {
    for (const button of origins.values()) button.remove();
    origins.clear();
    for (let index = start; index < Math.min(start + 12, count); index++) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.virtualIndex = String(index);
      button.textContent = `Item ${index + 1}`;
      button.addEventListener("click", () => gallery.open(index));
      gallery.append(button);
      origins.set(String(index), button);
    }
  }
  renderWindow(0);
  Object.assign(window, { __renderVirtualWindow: renderWindow });
  if (filmstrip) gallery.append(document.createElement("fluidbox-filmstrip"));
} else {
  const gallery = document.createElement("fluidbox-gallery");
  if (params.has("viewer-template")) {
    const viewer = document.createElement("template");
    viewer.setAttribute("slot", "viewer");
    viewer.innerHTML = `<button type="button" data-fluidbox-next data-test-next>Next</button>`;
    gallery.append(viewer);
  }
  gallery.setAttribute("aria-label", "Test gallery");
  for (let index = 0; index < count; index++) {
    const lightbox = document.createElement("fluidbox-item");
    lightbox.setAttribute("item-id", String(index));
    lightbox.dataset.testIndex = String(index);
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.setAttribute("slot", "trigger");
    const image = document.createElement("img");
    image.src = index % 2 ? "/second.svg" : "/first.svg";
    image.alt = `Gallery item ${index + 1}`;
    image.width = params.has("pictures") ? (index % 2 ? 3024 : 1200) : 120;
    image.height = params.has("pictures") ? (index % 2 ? 4032 : 800) : 80;
    trigger.append(image);
    lightbox.append(trigger);
    const template = document.createElement("template");
    template.setAttribute("slot", "content");
    template.innerHTML = `<picture><img src="${image.src}" width="${image.width}" height="${image.height}" alt="Full-size item ${index + 1}"></picture>`;
    if (params.has("pictures")) {
      template.innerHTML = `<picture><source type="image/svg+xml" srcset="${image.src} 1x, ${image.src}?large 2x" sizes="100vw"><img src="${image.src}" srcset="${image.src} 1x, ${image.src}?large 2x" sizes="100vw" width="${image.width}" height="${image.height}" alt="Full-size item ${index + 1}"></picture>`;
    }
    if (params.has("iframes")) {
      template.innerHTML = `<iframe title="Frame ${index + 1}" width="600" height="400" srcdoc="<p>Frame ${index + 1}</p>"></iframe>`;
    }
    if (params.has("iframe") && index === 1) {
      template.innerHTML = `<section width="600" height="400"><iframe title="Test embedded content" srcdoc='<button type="button">Inside iframe</button>'></iframe></section>`;
    }
    lightbox.append(template);
    gallery.append(lightbox);
  }
  if (filmstrip) gallery.append(document.createElement("fluidbox-filmstrip"));
  target.append(gallery);
}
(document.documentElement as HTMLElement).dataset.fixtureReady = "";
