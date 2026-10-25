// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import { embedSlide } from "@ogdakke/fluidbox/embed";
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { createSpinSlide } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);

export function mountMedia(root: HTMLElement) {
  const fluidbox = createFluidbox({
    items: productMedia,
    // The items' types name these slides: "embed", "spin" and "model".
    slides: {
      embed: embedSlide,
      spin: createSpinSlide(),
      // The model's card draws <model-viewer> too, so it loads with the page.
      model: createModelSlide({ load: loadModelViewer }),
    },
  });

  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  productMedia.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    if (item.type === "model") {
      // A live model: a drag turns it, and a click opens the viewer on the same view.
      void loadModelViewer();
      button.setAttribute("aria-label", itemLabel(item));
      const model = document.createElement("model-viewer");
      model.setAttribute("src", item.src);
      model.setAttribute("poster", thumbnailSrc(item) ?? "");
      model.setAttribute("camera-controls", "");
      model.setAttribute("touch-action", "pan-y");
      model.setAttribute("interaction-prompt", "none");
      button.append(model);
    } else {
      button.append(Object.assign(new Image(), { src: thumbnailSrc(item), alt: itemLabel(item) }));
    }
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
