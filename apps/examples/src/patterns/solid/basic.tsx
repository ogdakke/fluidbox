/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { photos } from "../shared";

export function Basic() {
  return (
    <Fluidbox.Root items={photos}>
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger value={photo.id} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
      {/* Without a Viewer, the viewer has these same three buttons. */}
      <Fluidbox.Viewer>
        <Fluidbox.Previous />
        <Fluidbox.Next />
        <Fluidbox.Close />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
