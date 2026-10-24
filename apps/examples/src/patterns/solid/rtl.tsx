/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/thumbnails.css";
import { arabic, photos } from "../shared";

export function Rtl() {
  return (
    // The viewer takes dir and lang from the trigger's surroundings.
    <div dir="rtl" lang="ar">
      <Fluidbox.Root items={photos} labels={arabic}>
        <div class="pattern-grid">
          <For each={photos}>
            {(photo) => (
              <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
                <img src={photo.src} alt={itemLabel(photo)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
        <Fluidbox.Thumbnails />
      </Fluidbox.Root>
    </div>
  );
}
// #endregion example
