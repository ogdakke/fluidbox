/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/solid";
import { photos } from "../shared";

function Caption() {
  const fluidbox = useFluidbox();
  return (
    <div class="pattern-caption">
      <button
        type="button"
        data-test="prev"
        disabled={!fluidbox.hasPrevious}
        onClick={() => fluidbox.previous()}
      >
        Previous
      </button>
      <span>
        <strong data-test="title">{fluidbox.item ? itemLabel(fluidbox.item) : ""}</strong>{" "}
        <small data-test="counter">
          {(fluidbox.index ?? 0) + 1} / {fluidbox.count}
        </small>
      </span>
      <button
        type="button"
        data-test="next"
        disabled={!fluidbox.hasNext}
        onClick={() => fluidbox.next()}
      >
        Next
      </button>
      <button type="button" data-test="close" onClick={() => fluidbox.close()}>
        Close
      </button>
    </div>
  );
}

export function Headless() {
  return (
    <Fluidbox.Root items={photos}>
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
      {/* Your own controls and caption, in place of the default controls. */}
      <Fluidbox.Viewer>
        <Caption />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
