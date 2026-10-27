/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/solid";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** Your own icons: the package ships none. The buttons take their names from the labels. */
function Icon(props: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d={props.path}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

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
              <Fluidbox.Trigger value={photo.id} class="pattern-thumb" data-test="trigger">
                <img src={thumbnailSrc(photo)} alt={itemLabel(photo)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
        <Fluidbox.Viewer>
          {/* Previous, Next and Close, then Zoom in, Zoom out and Fit with your icons. */}
          <Fluidbox.Toolbar />
          <Fluidbox.ZoomControls>
            <Fluidbox.ZoomIn>
              <Icon path="M12 5v14M5 12h14" />
            </Fluidbox.ZoomIn>
            <Fluidbox.ZoomOut>
              <Icon path="M5 12h14" />
            </Fluidbox.ZoomOut>
            <Fluidbox.ZoomReset>
              <Icon path="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </Fluidbox.ZoomReset>
          </Fluidbox.ZoomControls>
          <ZoomLevel />
        </Fluidbox.Viewer>
      </Fluidbox.Root>

      <Fluidbox.Root items={photos} zoom={false}>
        <div class="pattern-grid">
          <For each={photos}>
            {(photo) => (
              <Fluidbox.Trigger value={photo.id} class="pattern-thumb" data-test="trigger">
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
