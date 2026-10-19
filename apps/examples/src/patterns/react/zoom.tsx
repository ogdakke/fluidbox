// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, type FluidboxRootProps } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Gallery({ zoom }: Pick<FluidboxRootProps, "zoom">) {
  return (
    <Fluidbox.Root items={photos} zoom={zoom}>
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
    </Fluidbox.Root>
  );
}

export function Zoom() {
  return (
    <>
      {/* Double-click zooms to 3x; pinch and wheel stop at 6x. */}
      <Gallery zoom={{ step: 3, max: 6 }} />
      <Gallery zoom={false} />
    </>
  );
}
// #endregion example
