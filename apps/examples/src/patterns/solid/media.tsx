/** @jsxImportSource solid-js */
// #region example
import { For, onCleanup, onMount } from "solid-js";
import { itemLabel, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { renderEmbed } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer } from "@ogdakke/fluidbox/model";
import { Fluidbox, type FluidboxSolidRenderer } from "@ogdakke/fluidbox/solid";
import { createSpinRenderer } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";
import { addonSlide } from "../../addon-slide";

/**
 * The add-ons draw into an element. A Solid renderer returns one, and hands
 * the add-on the slide's item, signal and activity.
 */
const addon =
  (render: FluidboxSlideRenderer): FluidboxSolidRenderer =>
  (context) => {
    const target = (<span style={{ display: "contents" }} />) as HTMLSpanElement;
    onMount(() => {
      const controller = new AbortController();
      const dispose = render(
        addonSlide(context, target, AbortSignal.any([context.signal, controller.signal])),
      );
      onCleanup(() => {
        controller.abort();
        dispose?.();
      });
    });
    return target;
  };

// The items' `render` names these: "embed", "spin" and "model".
const renderers = {
  embed: addon(renderEmbed),
  spin: addon(createSpinRenderer()),
  // <model-viewer> loads when a model first comes on show.
  model: addon(createModelRenderer({ load: () => import(/* @vite-ignore */ modelViewerUrl) })),
};

export function Media() {
  return (
    <Fluidbox.Root items={productMedia} renderers={renderers}>
      <div class="pattern-grid">
        <For each={productMedia}>
          {(item) => (
            <Fluidbox.Trigger item={item} class="pattern-thumb" data-test="trigger">
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
