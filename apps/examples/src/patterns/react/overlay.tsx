// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { album } from "../shared";

export function Overlay() {
  return (
    <Fluidbox.Root items={album}>
      {/* The first item opens; every album item closes back onto this trigger. */}
      <Fluidbox.Trigger value={album} className="pattern-thumb pattern-album" data-test="trigger">
        {({ item }) => (
          <>
            {/* Shows the item the viewer last showed. Keep the img mounted. */}
            <img src={item?.src} alt={item ? itemLabel(item) : ""} data-test="preview" />
            <Fluidbox.Overlay flight="live" className="pattern-overlay" data-test="count">
              +{album.length - 1}
            </Fluidbox.Overlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
