// #region example
import { embedSlide } from "@ogdakke/fluidbox/embed";
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { createSpinSlide } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia } from "../shared";

export function media(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // Items from JS; the buttons marked data-fluidbox-value open them.
  gallery.items = productMedia;
  // The items' types name these slides: "embed", "spin" and "model".
  gallery.slides = {
    embed: embedSlide,
    spin: createSpinSlide(),
    // <model-viewer> loads when a model first comes on show.
    model: createModelSlide({ load: () => import(/* @vite-ignore */ modelViewerUrl) }),
  };
}
// #endregion example
