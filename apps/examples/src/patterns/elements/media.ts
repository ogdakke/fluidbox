// #region example
import { renderEmbed } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer } from "@ogdakke/fluidbox/model";
import { createSpinRenderer } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia } from "../shared";

export function media(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // Items from JS; the buttons marked data-fluidbox-value open them.
  gallery.items = productMedia;
  // The items' `render` names these: "embed", "spin" and "model".
  gallery.renderers = {
    embed: renderEmbed,
    spin: createSpinRenderer(),
    // <model-viewer> loads when a model first comes on show.
    model: createModelRenderer({ load: () => import(/* @vite-ignore */ modelViewerUrl) }),
  };
}
// #endregion example
