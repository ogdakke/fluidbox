/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel, type FluidboxImageItem } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/sheet.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

function Details(props: { photo: FluidboxImageItem }) {
  const sheet = useFluidboxSheet();
  return (
    <>
      <h3 data-test="sheet-title">{itemLabel(props.photo)}</h3>
      <p>
        Stop <output data-test="stop">{sheet.stop()}</output>
      </p>
      <button type="button" data-test="expand" onClick={() => sheet.set(2)}>
        Expand
      </button>
      <input data-test="field" placeholder="Add a note" aria-label="Note" />
    </>
  );
}

export function Sheet() {
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
      {/* The sheet's content, for the active item. Its attributes go on the sheet itself. */}
      <Fluidbox.Sheet<FluidboxImageItem> snapPoints={["40%", "90%"]} class="pattern-sheet">
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
