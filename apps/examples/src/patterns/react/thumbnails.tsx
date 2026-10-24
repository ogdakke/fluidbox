// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

function Grid() {
  return (
    <div className="pattern-grid">
      {photos.map((photo) => (
        <Fluidbox.Trigger
          key={photo.src}
          item={photo}
          className="pattern-thumb"
          data-test="trigger"
        >
          <img src={photo.src} alt={itemLabel(photo)} />
        </Fluidbox.Trigger>
      ))}
    </div>
  );
}

export function Thumbnails() {
  return (
    <>
      <Fluidbox.Root items={photos}>
        <Grid />
        {/* Being there turns the thumbnails on. */}
        <Fluidbox.Thumbnails />
      </Fluidbox.Root>
      <Fluidbox.Root items={photos}>
        <Grid />
        {/* Your own thumbnails. The selected button has data-fluidbox-selected. */}
        <Fluidbox.Thumbnails>
          {({ index }) => (
            <span className="pattern-thumbnails-thumb" data-test="thumb">
              {index + 1}
            </span>
          )}
        </Fluidbox.Thumbnails>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
