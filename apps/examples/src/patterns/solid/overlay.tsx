/** @jsxImportSource solid-js */
// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { album } from "../shared";

export function Overlay() {
  return (
    <Fluidbox.Root items={album}>
      {/* The first item opens; every one of them closes back onto the trigger. */}
      <Fluidbox.Trigger
        item={album[0]!}
        returns={album}
        class="pattern-thumb pattern-album"
        data-test="trigger"
      >
        {(preview) => (
          <>
            {/* The preview follows the viewer, so the close lands on the right photo. */}
            <img
              src={preview().item?.src}
              alt={preview().item ? itemLabel(preview().item!) : ""}
              data-test="preview"
            />
            <Fluidbox.ThumbnailOverlay travel class="pattern-overlay" data-test="count">
              +{album.length - 1}
            </Fluidbox.ThumbnailOverlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
