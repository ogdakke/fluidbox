/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { Embed } from "@ogdakke/fluidbox/solid/embed";
import { Model } from "@ogdakke/fluidbox/solid/model";
import { Spin } from "@ogdakke/fluidbox/solid/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

// <model-viewer> loads when a model first comes on show.
const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);

export function Media() {
  return (
    <Fluidbox.Root items={productMedia}>
      <div class="pattern-grid">
        <For each={productMedia}>
          {(item) => (
            <Fluidbox.Trigger value={item.id} class="pattern-thumb" data-test="trigger">
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          )}
        </For>
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
