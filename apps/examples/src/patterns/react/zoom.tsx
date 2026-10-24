// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** The zoom the image on show rests at, from the viewer's state. */
function ZoomLevel() {
  const zoom = useFluidbox((state) => state.zoom);
  return (
    <output className="pattern-zoom-level" data-test="zoom-level">
      {zoom ? `${Math.round(zoom.scale * 100)}%` : ""}
    </output>
  );
}

export function Zoom() {
  return (
    <>
      {/* Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. */}
      <Fluidbox.Root items={zoomPhotos} zoom={{ step: 3, max: 6 }}>
        <div className="pattern-grid">
          {zoomPhotos.map((photo) => (
            <Fluidbox.Trigger
              key={photo.id}
              value={photo.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(photo)} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          ))}
        </div>
        <Fluidbox.Viewer>
          {/* Previous, Next and Close, then Zoom in, Zoom out and Fit. */}
          <Fluidbox.Toolbar />
          <Fluidbox.ZoomControls />
          <ZoomLevel />
        </Fluidbox.Viewer>
      </Fluidbox.Root>

      <Fluidbox.Root items={photos} zoom={false}>
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
      </Fluidbox.Root>
    </>
  );
}
// #endregion example
