// #region example
import { createFluidbox, itemLabel, type FluidboxOptions } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/thumbnails";
import "@ogdakke/fluidbox/thumbnails.css";
import { photos } from "../shared";

function gallery(root: HTMLElement, thumbnails: FluidboxOptions["thumbnails"]) {
  const fluidbox = createFluidbox({ items: photos, thumbnails });
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
  root.append(grid);
  return () => {
    fluidbox.destroy();
    grid.remove();
  };
}

export function mountThumbnails(root: HTMLElement) {
  const standard = gallery(root, true);
  // Your own thumbnails. The selected button has data-fluidbox-selected.
  const custom = gallery(root, {
    render({ index, target }) {
      const thumb = document.createElement("span");
      thumb.className = "pattern-thumbnails-thumb";
      thumb.dataset.test = "thumb";
      thumb.textContent = String(index + 1);
      target.append(thumb);
      return () => thumb.remove();
    },
  });

  return () => {
    standard();
    custom();
  };
}
// #endregion example
