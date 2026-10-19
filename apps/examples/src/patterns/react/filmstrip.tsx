// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Thumbnails() {
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

export function Filmstrip() {
  return (
    <>
      <Fluidbox.Root items={photos}>
        <Thumbnails />
        {/* Being there turns the filmstrip on. */}
        <Fluidbox.Filmstrip />
      </Fluidbox.Root>
      <Fluidbox.Root items={photos}>
        <Thumbnails />
        {/* Your own thumbnails. The selected button has data-fluidbox-selected. */}
        <Fluidbox.Filmstrip>
          {({ index }) => (
            <span className="pattern-filmstrip-thumb" data-test="thumb">
              {index + 1}
            </span>
          )}
        </Fluidbox.Filmstrip>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
