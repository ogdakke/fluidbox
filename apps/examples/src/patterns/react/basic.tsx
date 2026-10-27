// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

export function Basic() {
  return (
    <Fluidbox.Root items={photos}>
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.id}
            value={photo.id}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
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
