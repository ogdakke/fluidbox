/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { Fluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/solid";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/sheet.css";
import { label, photos } from "../shared";

function Details(props: { photo: FluidboxImageItem }) {
  const sheet = useFluidboxSheet();
  return (
    <div class="pattern-sheet">
      <h3 data-test="sheet-title">{label(props.photo)}</h3>
      <p>
        Stop <output data-test="stop">{sheet.stop()}</output>
      </p>
      <button type="button" data-test="expand" onClick={() => sheet.set(2)}>
        Expand
      </button>
      <input data-test="field" placeholder="Add a note" aria-label="Note" />
    </div>
  );
}

export function Sheet() {
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
      {/* The sheet's content, for the active item. */}
      <Fluidbox.Sheet<FluidboxImageItem> snapPoints={["40%", "90%"]}>
        {({ item }) => <Details photo={item} />}
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        {/* Raises the sheet to its first stop. */}
        <Fluidbox.SheetStop stop={1} class="pattern-sheet-toggle" data-test="peek">
          Details
        </Fluidbox.SheetStop>
        <Fluidbox.Controls />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
