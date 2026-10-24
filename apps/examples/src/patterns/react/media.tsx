// #region example
import { useLayoutEffect, useRef } from "react";
import { itemLabel, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { renderEmbed } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer } from "@ogdakke/fluidbox/model";
import {
  Fluidbox,
  type FluidboxReactRenderContext,
  type FluidboxReactRenderer,
} from "@ogdakke/fluidbox/react";
import { createSpinRenderer } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";
import { addonSlide } from "../../addon-slide";

/**
 * The add-ons draw into an element. A React renderer gets the slide's item,
 * signal and activity, so give the add-on an element of the component's own.
 */
function AddonSlide({
  render,
  context,
}: {
  render: FluidboxSlideRenderer;
  context: FluidboxReactRenderContext;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const target = ref.current!;
    const controller = new AbortController();
    const dispose = render(
      addonSlide(context, target, AbortSignal.any([context.signal, controller.signal])),
    );
    return () => {
      controller.abort();
      dispose?.();
      target.replaceChildren();
    };
  }, [render, context]);
  return <span ref={ref} style={{ display: "contents" }} />;
}

const addon =
  (render: FluidboxSlideRenderer): FluidboxReactRenderer =>
  (context) => <AddonSlide render={render} context={context} />;

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
      <div className="pattern-grid">
        {productMedia.map((item) => (
          <Fluidbox.Trigger key={item.id} item={item} className="pattern-thumb" data-test="trigger">
            <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
          </Fluidbox.Trigger>
        ))}
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
