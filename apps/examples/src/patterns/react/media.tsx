// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { Embed } from "@ogdakke/fluidbox/react/embed";
import { Model } from "@ogdakke/fluidbox/react/model";
import { Spin } from "@ogdakke/fluidbox/react/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

// <model-viewer> loads when a model first comes on show.
const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);

export function Media() {
  return (
    <Fluidbox.Root items={productMedia}>
      <div className="pattern-grid">
        {productMedia.map((item) => (
          <Fluidbox.Trigger
            key={item.id}
            value={item.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* The photo is built in; the other items' types name these slides. */}
      <Fluidbox.Slides
        embed={() => <Embed />}
        spin={() => <Spin />}
        model={() => <Model load={loadModelViewer} />}
      />
    </Fluidbox.Root>
  );
}
// #endregion example
