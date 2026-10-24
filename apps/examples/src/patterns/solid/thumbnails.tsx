/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

function Grid() {
  return (
    <div class="pattern-grid">
      <For each={photos}>
        {(photo) => (
          <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        )}
      </For>
    </div>
  );
}

export function Thumbnails() {
  return (
    <>
      <Fluidbox.Root items={photos}>
        <Grid />
        <Fluidbox.Thumbnails />
      </Fluidbox.Root>

      <Fluidbox.Root items={photos}>
        <Grid />
        {/* Your own thumbnails. The selected button has data-fluidbox-selected. */}
        <Fluidbox.Thumbnails>
          {(thumb) => (
            <span class="pattern-thumbnails-thumb" data-test="thumb">
              {thumb.index + 1}
            </span>
          )}
        </Fluidbox.Thumbnails>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
