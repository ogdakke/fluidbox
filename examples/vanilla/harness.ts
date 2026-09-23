import type { LightboxGallerySource } from "@dw/lightbox";
import "@dw/lightbox/elements";
import "@dw/lightbox/styles.css";
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
    "app-gallery { display: flex; gap: 16px } app-lightbox { display: block; width: 120px } app-lightbox img { width: 100%; height: auto }";
  target.append(style);
}
if (params.has("virtual")) {
  const gallery = document.createElement("app-gallery") as HTMLElement & {
    source: LightboxGallerySource;
    open(index: number): void;
  };
  gallery.setAttribute("aria-label", "Virtual source gallery");
  target.append(gallery);
  const origins = new Map<string, HTMLElement>();
  gallery.source = {
    count,
    getItem(index) {
      return {
        id: String(index),
        src: index % 2 ? "/second.svg" : "/first.svg",
        thumbnailSrc: index % 2 ? "/second.svg" : "/first.svg",
        alt: `Virtual item ${index + 1}`,
        width: 600,
        height: 400,
      };
    },
    getOrigin(id) {
      return origins.get(id) ?? null;
    },
  };
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
  if (filmstrip) gallery.append(document.createElement("app-filmstrip"));
} else {
  const gallery = document.createElement("app-gallery");
  gallery.setAttribute("aria-label", "Test gallery");
  for (let index = 0; index < count; index++) {
    const lightbox = document.createElement("app-lightbox");
    lightbox.setAttribute("src", index % 2 ? "/second.svg" : "/first.svg");
    lightbox.setAttribute("alt", `Gallery item ${index + 1}`);
    lightbox.setAttribute("close-button", "");
    lightbox.dataset.testIndex = String(index);
    const image = document.createElement("img");
    image.src = index % 2 ? "/second.svg" : "/first.svg";
    image.alt = `Gallery item ${index + 1}`;
    image.width = 120;
    image.height = 80;
    lightbox.append(image);
    if (params.has("iframes")) {
      const template = document.createElement("template");
      template.setAttribute("slot", "content");
      template.innerHTML = `<iframe title="Frame ${index + 1}" srcdoc="<p>Frame ${index + 1}</p>"></iframe>`;
      lightbox.append(template);
    }
    if (params.has("iframe") && index === 1) {
      const content = document.createElement("section");
      content.setAttribute("slot", "content");
      content.setAttribute("width", "600");
      content.setAttribute("height", "400");
      const iframe = document.createElement("iframe");
      iframe.title = "Test embedded content";
      iframe.srcdoc = '<button type="button">Inside iframe</button>';
      content.append(iframe);
      lightbox.append(content);
    }
    gallery.append(lightbox);
  }
  if (filmstrip) gallery.append(document.createElement("app-filmstrip"));
  target.append(gallery);
}
(document.documentElement as HTMLElement).dataset.fixtureReady = "";
