/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { label, photos } from "../shared";

function Thumbnails() {
  return (
    <div class="pattern-grid">
      <For each={photos}>
        {(photo) => (
          <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
            <img src={photo.src} alt={label(photo)} />
          </Fluidbox.Trigger>
        )}
      </For>
    </div>
  );
}

export function Filmstrip() {
  return (
    <>
      <Fluidbox.Root items={photos}>
        <Thumbnails />
        <Fluidbox.Filmstrip />
      </Fluidbox.Root>

      <Fluidbox.Root items={photos}>
        <Thumbnails />
        {/* Your own thumbnails. The selected button has data-fluidbox-selected. */}
        <Fluidbox.Filmstrip>
          {(thumb) => (
            <span class="pattern-filmstrip-thumb" data-test="thumb">
              {thumb.index + 1}
            </span>
          )}
        </Fluidbox.Filmstrip>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
