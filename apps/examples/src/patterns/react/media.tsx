// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { Embed } from "@ogdakke/fluidbox/react/embed";
import { Model } from "@ogdakke/fluidbox/react/model";
import { Spin } from "@ogdakke/fluidbox/react/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

// The model's card draws <model-viewer> too, so it loads with the page.
const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);
void loadModelViewer();

export function Media() {
  return (
    <Fluidbox.Root items={productMedia}>
      <div className="pattern-grid">
        {productMedia.map((item) =>
          item.type === "model" ? (
            // A live model: a drag turns it, and a click opens the viewer on the same view.
            <Fluidbox.Trigger
              key={item.id}
              value={item.id}
              className="pattern-thumb"
              data-test="trigger"
              aria-label={itemLabel(item)}
            >
              <model-viewer
                src={item.src}
                poster={thumbnailSrc(item)}
                camera-controls=""
                touch-action="pan-y"
                interaction-prompt="none"
              />
            </Fluidbox.Trigger>
          ) : (
            <Fluidbox.Trigger
              key={item.id}
              value={item.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          ),
        )}
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
