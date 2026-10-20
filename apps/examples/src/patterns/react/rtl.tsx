// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/filmstrip.css";
import { arabic, photos } from "../shared";

export function Rtl() {
  return (
    // The viewer takes dir and lang from the trigger's surroundings.
    <div dir="rtl" lang="ar">
      <Fluidbox.Root items={photos} labels={arabic}>
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
        <Fluidbox.Filmstrip />
      </Fluidbox.Root>
    </div>
  );
}
// #endregion example
