// #region example
import { createFluidbox } from "@ogdakke/fluidbox";
import { label, photos } from "../shared";

export function mountBasic(root: HTMLElement) {
  // The viewer has Previous, Next and Close buttons unless you draw your own.
  const fluidbox = createFluidbox({ items: photos });

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
    // Also unbinds the buttons.
    fluidbox.destroy();
    grid.remove();
  };
}
// #endregion example
