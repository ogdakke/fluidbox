// #region example
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { album, label } from "../shared";

export function Overlay() {
  return (
    <Fluidbox.Root items={album}>
      {/* The first item opens; every album item closes back onto this trigger. */}
      <Fluidbox.Trigger items={album} className="pattern-thumb pattern-album" data-test="trigger">
        {({ item }) => (
          <>
            {/* Shows the item the viewer last showed. Keep the img mounted. */}
            <img src={item?.src} alt={item ? label(item) : ""} data-test="preview" />
            <Fluidbox.ThumbnailOverlay travel className="pattern-overlay" data-test="count">
              +{album.length - 1}
            </Fluidbox.ThumbnailOverlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
