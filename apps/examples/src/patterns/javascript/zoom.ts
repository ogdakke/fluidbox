// #region example
import {
  createFluidbox,
  itemLabel,
  type FluidboxImageItem,
  type FluidboxOptions,
} from "@ogdakke/fluidbox";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

function gallery(
  root: HTMLElement,
  items: FluidboxImageItem[],
  options: Omit<FluidboxOptions<FluidboxImageItem>, "items">,
) {
  const fluidbox = createFluidbox({ items, ...options });
  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  items.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: thumbnailSrc(photo), alt: itemLabel(photo) }));
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
  const disposers = [
    // Double-click zooms to 3x; pinch, wheel and the controls stop at 6x.
    gallery(root, zoomPhotos, {
      zoom: { step: 3, max: 6 },
      controls: ["previous", "next", "close", "zoomIn", "zoomOut", "zoomReset"],
      // The zoom the image on show rests at, from the viewer's state.
      viewer({ target, fluidbox }) {
        const level = document.createElement("output");
        level.className = "pattern-zoom-level";
        level.dataset.test = "zoom-level";
        target.append(level);
        return fluidbox.subscribe(({ zoom }) => {
          level.textContent = zoom ? `${Math.round(zoom.scale * 100)}%` : "";
        });
      },
    }),
    gallery(root, photos, { zoom: false }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
// #endregion example
