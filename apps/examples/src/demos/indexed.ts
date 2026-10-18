import type { AppGallery, LightboxItem, LightboxSource } from "@ogdakke/fluidbox";
import { artSrc, scenes } from "../art";

const count = 100_000;
const windowSize = 12;
const sceneAt = (index: number) => scenes[(index * 7) % scenes.length]!;

export function mountIndexed(gallery: AppGallery, form: HTMLFormElement): void {
  const origins = new Map<string, HTMLButtonElement>();
  const output = form.querySelector("output")!;

  const source: LightboxSource<LightboxItem> = {
    count,
    getItem(index) {
      const scene = sceneAt(index);
      const src = artSrc(scene);
      return {
        id: String(index),
        media: {
          type: "image",
          src,
          alt: `${scene.title}, item ${index + 1}`,
          width: scene.width,
          height: scene.height,
        },
        thumbnail: { src, width: scene.width, height: scene.height },
        caption: `${scene.title} · #${(index + 1).toLocaleString("en-US")}`,
      };
    },
    getIndex(id) {
      const index = Number(id);
      return Number.isInteger(index) && index >= 0 && index < count ? index : null;
    },
  };
  gallery.source = source;
  gallery.origins = {
    getOrigin(id) {
      const trigger = origins.get(id);
      if (!trigger) return null;
      const thumbnail = trigger.querySelector("img");
      return { trigger, visual: thumbnail ?? trigger, thumbnail: thumbnail ?? undefined };
    },
  };

  const filmstrip = gallery.querySelector("app-filmstrip");
  function renderWindow(start: number) {
    for (const button of origins.values()) button.remove();
    origins.clear();
    const end = Math.min(start + windowSize, count);
    for (let index = start; index < end; index++) {
      const scene = sceneAt(index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "virtual-card";
      button.setAttribute("aria-label", `Open gallery item ${index + 1}`);
      const image = document.createElement("img");
      image.src = artSrc(scene);
      image.alt = "";
      image.width = scene.width;
      image.height = scene.height;
      const caption = document.createElement("span");
      caption.textContent = `#${(index + 1).toLocaleString("en-US")}`;
      button.append(image, caption);
      button.addEventListener("click", () => void gallery.open({ index }));
      gallery.insertBefore(button, filmstrip);
      origins.set(String(index), button);
    }
    output.textContent = `Showing ${(start + 1).toLocaleString("en-US")}–${end.toLocaleString("en-US")} of ${count.toLocaleString("en-US")}`;
  }
  renderWindow(0);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>("input")!;
    const index = Math.max(0, Math.min(count - 1, Number(input.value) - 1));
    if (!Number.isFinite(index)) return;
    renderWindow(Math.max(0, Math.min(count - windowSize, index - (index % windowSize))));
    void gallery.open({ index });
  });
}
