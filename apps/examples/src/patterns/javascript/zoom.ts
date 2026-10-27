// #region example
import {
  createFluidbox,
  itemLabel,
  type FluidboxImageItem,
  type FluidboxOptions,
} from "@ogdakke/fluidbox";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** Your own icon: the package ships none. The buttons take their names from the labels. */
const icon = (path: string) => () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<path d="${path}" fill="none" stroke="currentColor" stroke-width="2" />`;
  return svg;
};

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
      icons: {
        zoomIn: icon("M12 5v14M5 12h14"),
        zoomOut: icon("M5 12h14"),
        zoomReset: icon("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"),
      },
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
