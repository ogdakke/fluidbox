// #region example
import { zoomPhotos } from "../shared";

export function zoom(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const content = root.querySelector<HTMLTemplateElement>(":scope > template")!;
  // Items from JS, for their srcset and zoomSrc; the buttons marked data-fluidbox-item-id open them.
  gallery.items = zoomPhotos;
  gallery.viewer = ({ target, fluidbox }) => {
    target.append(content.content.cloneNode(true));
    const level = target.querySelector("output")!;
    // The zoom the image on show rests at, from the viewer's state.
    return fluidbox.subscribe(({ zoom }) => {
      level.textContent = zoom ? `${Math.round(zoom.scale * 100)}%` : "";
    });
  };
}
// #endregion example
