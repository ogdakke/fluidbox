/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { label, photos } from "../shared";

export function Basic() {
  return (
    <Fluidbox.Root items={photos}>
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={label(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
      {/* Without a Viewer, the viewer has these three by default. */}
      <Fluidbox.Viewer>
        <Fluidbox.Previous />
        <Fluidbox.Next />
        <Fluidbox.Close />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
