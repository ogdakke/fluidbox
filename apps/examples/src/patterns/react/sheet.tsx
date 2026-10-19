// #region example
import { Fluidbox, useFluidbox, useFluidboxSheet } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/sheet.css";
import { label, photos } from "../shared";

function Details() {
  const sheet = useFluidboxSheet();
  const item = useFluidbox(({ item }) => item);
  return (
    <>
      <h3 data-test="sheet-title">{item && label(item)}</h3>
      <p>
        Stop <output data-test="stop">{sheet.stop}</output>
      </p>
      <button type="button" data-test="expand" onClick={() => sheet.set(2)}>
        Expand
      </button>
      <input placeholder="Add a note" aria-label="Note" data-test="field" />
    </>
  );
}

export function Sheet() {
  return (
    <Fluidbox.Root items={photos}>
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.src}
            item={photo}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={label(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
      {/* Stop 0 rests below the photo; stops 1 and 2 raise it to 40% and 90% of the screen. */}
      <Fluidbox.Sheet snapPoints={["40%", "90%"]} className="pattern-sheet">
        <Details />
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        <Fluidbox.SheetStop stop={1} className="pattern-sheet-toggle" data-test="peek">
          Details
        </Fluidbox.SheetStop>
        <Fluidbox.Controls />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
