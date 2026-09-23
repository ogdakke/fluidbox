import type { AppGallery, LightboxGallerySource } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
import "./playground.css";

const gallery = document.querySelector<AppGallery>("#virtual-gallery")!;
const origins = new Map<string, HTMLButtonElement>();
const count = 100_000;
const source: LightboxGallerySource = {
  count,
  getItem(index) {
    return {
      id: String(index),
      src: index % 2 ? "/second.svg" : "/first.svg",
      thumbnailSrc: index % 2 ? "/second.svg" : "/first.svg",
      alt: `Gallery item ${index + 1}`,
      width: 600,
      height: 400,
    };
  },
  getOrigin(id) {
    return origins.get(id) ?? null;
  },
};
gallery.source = source;

function renderWindow(start: number) {
  for (const button of origins.values()) button.remove();
  origins.clear();
  for (let index = start; index < Math.min(start + 12, count); index++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "virtual-card";
    button.setAttribute("aria-label", `Open gallery item ${index + 1}`);
    const image = document.createElement("img");
    image.src = index % 2 ? "/second.svg" : "/first.svg";
    image.alt = "";
    image.width = 600;
    image.height = 400;
    const caption = document.createElement("span");
    caption.textContent = `Item ${index + 1}`;
    button.append(image, caption);
    button.addEventListener("click", () => gallery.open(index));
    gallery.insertBefore(button, gallery.querySelector("app-filmstrip"));
    origins.set(String(index), button);
  }
}
renderWindow(0);

document.querySelector<HTMLFormElement>("#jump-form")!.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#jump-index")!;
  const index = Math.max(0, Math.min(count - 1, Number(input.value) - 1));
  if (!Number.isFinite(index)) return;
  renderWindow(Math.max(0, Math.min(count - 12, index)));
  gallery.open(index);
});
