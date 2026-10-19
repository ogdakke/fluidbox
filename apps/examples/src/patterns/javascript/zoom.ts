// #region example
import { createFluidbox, type FluidboxOptions } from "@ogdakke/fluidbox";
import { label, photos } from "../shared";

function gallery(root: HTMLElement, zoom: FluidboxOptions["zoom"]) {
  const fluidbox = createFluidbox({ items: photos, zoom });
  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: photo.src, alt: label(photo) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });
  root.append(grid);
  return () => {
    fluidbox.destroy();
    grid.remove();
  };
}

export function mountZoom(root: HTMLElement) {
  const disposers = [gallery(root, { step: 3, max: 6 }), gallery(root, false)];
  return () => disposers.forEach((dispose) => dispose());
}
// #endregion example
