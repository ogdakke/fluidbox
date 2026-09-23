import "@dw/lightbox/elements";
import "@dw/lightbox/styles.css";
import "./site.css";

const root = document.querySelector<HTMLElement>("#fixture")!;
const params = new URLSearchParams(location.search);
const count = Math.min(20_000, Math.max(1, Number(params.get("count")) || 3));
const shadow = params.has("shadow");
const filmstrip = !params.has("no-filmstrip");
const target = shadow ? root.attachShadow({ mode: "open" }) : root;
if (shadow) {
  const style = document.createElement("style");
  style.textContent =
    "app-gallery { display: flex; gap: 16px } app-lightbox { display: block; width: 120px } app-lightbox img { width: 100%; height: auto }";
  target.append(style);
}
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
  gallery.append(lightbox);
}
if (filmstrip) gallery.append(document.createElement("app-filmstrip"));
target.append(gallery);
(document.documentElement as HTMLElement).dataset.fixtureReady = "";
