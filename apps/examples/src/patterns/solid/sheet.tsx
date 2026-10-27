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
        Snap <output data-test="stop">{sheet.snap()}</output>
      </p>
      <button type="button" data-test="expand" onClick={() => sheet.setSnap(2)}>
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
            <Fluidbox.Trigger value={photo.id} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
      {/* Snap 0 rests below the photo; snaps 1 and 2 raise it to 40% and 90% of the screen. */}
      <Fluidbox.Sheet<FluidboxImageItem> snapPoints={["40%", "90%"]} class="pattern-sheet">
        {({ item }) => <Details photo={item} />}
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        <Fluidbox.SheetSnap to={1} class="pattern-sheet-toggle" data-test="peek">
          Details
        </Fluidbox.SheetSnap>
        <Fluidbox.Toolbar />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
