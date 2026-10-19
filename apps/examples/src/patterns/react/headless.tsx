// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, useFluidbox } from "@ogdakke/fluidbox/react";
import { photos } from "../shared";

function Caption() {
  const { item, index, count, hasPrevious, hasNext, previous, next, close } = useFluidbox();
  return (
    <div className="pattern-caption">
      <button type="button" disabled={!hasPrevious} data-test="prev" onClick={() => previous()}>
        Previous
      </button>
      <span>
        <strong data-test="title">{item && itemLabel(item)}</strong>{" "}
        <small data-test="counter">{index === null ? "" : `${index + 1} / ${count}`}</small>
      </span>
      <button type="button" disabled={!hasNext} data-test="next" onClick={() => next()}>
        Next
      </button>
      <button type="button" data-test="close" onClick={() => close()}>
        Close
      </button>
    </div>
  );
}

export function Headless() {
  return (
    <Fluidbox.Root items={photos}>
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
      {/* Your own controls and caption replace the default ones. */}
      <Fluidbox.Viewer>
        <Caption />
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
// #endregion example
