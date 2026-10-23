/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/solid";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** The zoom the image on show rests at. The state's fields are signals. */
function ZoomLevel() {
  const fluidbox = useFluidbox();
  return (
    <output class="pattern-zoom-level" data-test="zoom-level">
      {fluidbox.zoom ? `${Math.round(fluidbox.zoom.scale * 100)}%` : ""}
    </output>
  );
}

export function Zoom() {
  return (
    <>
      {/* Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. */}
      <Fluidbox.Root items={zoomPhotos} zoom={{ step: 3, max: 6 }}>
        <div class="pattern-grid">
          <For each={zoomPhotos}>
            {(photo) => (
              <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
                <img src={thumbnailSrc(photo)} alt={itemLabel(photo)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
        <Fluidbox.Viewer>
          {/* Previous, Next and Close, then Zoom in, Zoom out and Fit. */}
          <Fluidbox.Controls zoom />
          <ZoomLevel />
        </Fluidbox.Viewer>
      </Fluidbox.Root>

      <Fluidbox.Root items={photos} zoom={false}>
        <div class="pattern-grid">
          <For each={photos}>
            {(photo) => (
              <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
                <img src={photo.src} alt={itemLabel(photo)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
