// #region example
import "@ogdakke/fluidbox/elements/embed";
import "@ogdakke/fluidbox/elements/model";
import "@ogdakke/fluidbox/elements/spin";
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { modelViewerUrl } from "../shared";

export function media(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // <model-viewer> loads when a model first comes on show. A page that loads
  // it with its own <script> needs no slide of its own.
  gallery.slides = {
    model: createModelSlide({ load: () => import(/* @vite-ignore */ modelViewerUrl) }),
  };
}
// #endregion example
