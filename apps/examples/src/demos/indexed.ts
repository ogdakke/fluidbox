import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";
import { artSrc, formatCount, indexedArt, windowSize, windowStart } from "../art";
import { originsWithin } from "./origins";

/** Vanilla host: renders 12 cards of a 100,000-item source and jumps anywhere in it. */
export function mountIndexed(gallery: FluidboxGalleryElement, form: HTMLFormElement): void {
  const { source, sceneAt, count } = indexedArt(100_000);
  const output = form.querySelector("output")!;
  gallery.source = source;
  gallery.origins = originsWithin(() => gallery);

  const filmstrip = gallery.querySelector("fluidbox-filmstrip");
  function renderWindow(start: number) {
    for (const card of gallery.querySelectorAll(".virtual-card")) card.remove();
    const end = Math.min(start + windowSize, count);
    for (let index = start; index < end; index++) {
      const scene = sceneAt(index);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "virtual-card";
      button.dataset.originId = String(index);
      button.setAttribute("aria-label", `Open gallery item ${index + 1}`);
      const image = document.createElement("img");
      image.src = artSrc(scene);
      image.alt = "";
      image.width = scene.width;
      image.height = scene.height;
      // The image, not the captioned card, is the rounded box the viewer flies from.
      image.dataset.fluidboxOrigin = "";
      const caption = document.createElement("span");
      caption.textContent = `#${formatCount(index + 1)}`;
      button.append(image, caption);
      button.addEventListener("click", () => void gallery.open({ index }));
      gallery.insertBefore(button, filmstrip);
    }
    output.textContent = `Showing ${formatCount(start + 1)}–${formatCount(end)} of ${formatCount(count)}`;
  }
  renderWindow(0);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>("input")!;
    const index = Math.max(0, Math.min(count - 1, Number(input.value) - 1));
    if (!Number.isFinite(index)) return;
    renderWindow(windowStart(index, count));
    void gallery.open({ index });
  });
}
