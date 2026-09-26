import type {
  AppGallery,
  LightboxItem,
  LightboxOriginAdapter,
  LightboxSource,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
import "./site.css";

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
    "app-gallery { display: flex; gap: 16px } app-lightbox { display: block; width: 120px } app-lightbox > button { all: unset; display: block; cursor: pointer } app-lightbox img { width: 100%; height: auto }";
  target.append(style);
}
if (params.has("virtual")) {
  const gallery = document.createElement("app-gallery") as AppGallery;
  gallery.setAttribute("aria-label", "Virtual source gallery");
  target.append(gallery);
  const origins = new Map<string, HTMLElement>();
  const source: LightboxSource<LightboxItem> = {
    count,
    getItem(index) {
      const src = index % 2 ? "/second.svg" : "/first.svg";
      return {
        id: String(index),
        media: {
          type: "image",
          src,
          alt: `Virtual item ${index + 1}`,
          width: 600,
          height: 400,
        },
        thumbnail: { src, width: 600, height: 400 },
      };
    },
    getIndex(id) {
      const index = Number(id);
      return Number.isInteger(index) && index >= 0 && index < count ? index : null;
    },
  };
  const originAdapter: LightboxOriginAdapter = {
    getOrigin(id) {
      const trigger = origins.get(id);
      return trigger ? { trigger, visual: trigger } : null;
    },
  };
  gallery.source = source;
  gallery.origins = originAdapter;
  function renderWindow(start: number) {
    for (const button of origins.values()) button.remove();
    origins.clear();
    for (let index = start; index < Math.min(start + 12, count); index++) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.virtualIndex = String(index);
      button.textContent = `Item ${index + 1}`;
      button.addEventListener("click", () => gallery.open({ index }));
      gallery.append(button);
      origins.set(String(index), button);
    }
  }
  renderWindow(0);
  Object.assign(window, { __renderVirtualWindow: renderWindow });
  if (filmstrip) gallery.append(document.createElement("app-filmstrip"));
} else {
  const gallery = document.createElement("app-gallery");
  gallery.setAttribute("aria-label", "Test gallery");
  for (let index = 0; index < count; index++) {
    const lightbox = document.createElement("app-lightbox");
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
  if (filmstrip) gallery.append(document.createElement("app-filmstrip"));
  target.append(gallery);
}
(document.documentElement as HTMLElement).dataset.fixtureReady = "";
