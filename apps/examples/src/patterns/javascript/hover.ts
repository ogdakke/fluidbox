// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { productPhoto, thumbnailSrc } from "../shared";

export function mountHover(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: [productPhoto] });
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-product";
  button.dataset.test = "product";
  const image = Object.assign(new Image(640, 640), {
    src: thumbnailSrc(productPhoto),
    alt: itemLabel(productPhoto),
  });
  button.append(image);
  root.append(button);
  fluidbox.bind(button, productPhoto);
  // Magnifies the photo inside its own box under a resting mouse.
  const stopHoverZoom = hoverZoom(image, productPhoto);

  return () => {
    stopHoverZoom();
    fluidbox.destroy();
    button.remove();
  };
}
// #endregion example
