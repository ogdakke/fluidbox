// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import { embedSlide } from "@ogdakke/fluidbox/embed";
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { createSpinSlide } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

export function mountMedia(root: HTMLElement) {
  const fluidbox = createFluidbox({
    items: productMedia,
    // The items' types name these slides: "embed", "spin" and "model".
    slides: {
      embed: embedSlide,
      spin: createSpinSlide(),
      // <model-viewer> loads when a model first comes on show.
      model: createModelSlide({ load: () => import(/* @vite-ignore */ modelViewerUrl) }),
    },
  });

  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  productMedia.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: thumbnailSrc(item), alt: itemLabel(item) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });
  root.append(grid);

  return () => {
    fluidbox.destroy();
    grid.remove();
  };
}
// #endregion example
