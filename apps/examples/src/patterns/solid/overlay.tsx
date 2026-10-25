/** @jsxImportSource solid-js */
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { album } from "../shared";

export function Overlay() {
  return (
    <Fluidbox.Root items={album}>
      {/* The first item opens; every album item closes back onto this trigger. */}
      <Fluidbox.Trigger value={album} class="pattern-thumb pattern-album" data-test="trigger">
        {(preview) => (
          <>
            {/* Shows the item the viewer last showed, so the close lands on the right photo. */}
            <img
              src={preview().item?.src}
              alt={preview().item ? itemLabel(preview().item!) : ""}
              data-test="preview"
            />
            <Fluidbox.Overlay flight="live" class="pattern-overlay" data-test="count">
              +{album.length - 1}
            </Fluidbox.Overlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
