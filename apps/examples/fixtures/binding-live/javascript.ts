import "@ogdakke/fluidbox/thumbnails";
import {
  createFluidbox,
  type FluidboxImageItem,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import { album, countText, coverAlt, customViewerText, type MountLive } from "./shared";

export const mount: MountLive = (root) => {
  const fluidbox = createFluidbox({ items: album, thumbnails: true });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-thumb pattern-album";
  button.dataset.test = "trigger";
  const cover = Object.assign(new Image(), { src: album[0]!.src, alt: coverAlt });
  const count = document.createElement("span");
  count.className = "pattern-overlay";
  count.dataset.test = "count";
  const layer = document.createElement("span");
  layer.className = "live-layer";
  layer.dataset.test = "layer";
  count.append(layer, countText);
  button.append(cover, count);
  root.append(button);

  fluidbox.bind(button, album[0]!);
  fluidbox.bindOverlay(count, album[0]!, { flight: "copy" });
  fluidbox.bindOverlay(layer, album[0]!, { flight: "frame" });

  // The same function each time, so update sees no change while it stays on.
  const viewer: FluidboxViewerRenderer<FluidboxImageItem> = ({ target }) => {
    const text = document.createElement("p");
    text.className = "live-viewer";
    text.dataset.test = "custom-viewer";
    text.textContent = customViewerText;
    target.append(text);
    // The layer is yours, so clearing it all is fine: the thumbnails lives beside it.
    return () => target.replaceChildren();
  };

  return {
    setLabels: (labels) => fluidbox.update({ labels }),
    setViewer: (on) => fluidbox.update({ viewer: on ? viewer : undefined }),
    setLoop: (on) => fluidbox.update({ loop: on }),
  };
};
