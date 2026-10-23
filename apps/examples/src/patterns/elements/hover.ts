// #region example
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { productPhoto } from "../shared";

export function hover(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  gallery.items = [productPhoto];
  // Magnifies the photo inside its own box under a resting mouse. Returns its cleanup.
  return hoverZoom(gallery.querySelector("img")!, productPhoto);
}
// #endregion example
