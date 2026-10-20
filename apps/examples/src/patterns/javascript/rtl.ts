// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/filmstrip.css";
import { arabic, photos } from "../shared";

export function mountRtl(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: photos, labels: arabic, filmstrip: true });
  // The viewer takes dir and lang from the trigger's surroundings.
  const section = Object.assign(document.createElement("div"), { dir: "rtl", lang: "ar" });
  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: photo.src, alt: itemLabel(photo) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });
  section.append(grid);
  root.append(section);
  return () => {
    fluidbox.destroy();
    section.remove();
  };
}
// #endregion example
