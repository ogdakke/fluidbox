/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { Fluidbox, type FluidboxRootProps } from "@ogdakke/fluidbox/solid";
import { label, photos } from "../shared";

function Gallery(props: { zoom: FluidboxRootProps["zoom"] }) {
  return (
    <Fluidbox.Root items={photos} zoom={props.zoom}>
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={label(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
    </Fluidbox.Root>
  );
}

export function Zoom() {
  return (
    <>
      <Gallery zoom={{ step: 3, max: 6 }} />
      <Gallery zoom={false} />
    </>
  );
}
// #endregion example
