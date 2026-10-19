// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { product, strip } from "../shared";

const products = [product];

/** Only the photo flies: the card marks it with data-fluidbox-origin. */
export function ProductCard() {
  return (
    <Fluidbox.Root items={products}>
      <Fluidbox.Trigger item={product} asChild>
        <button type="button" className="pattern-card" data-test="product">
          <span data-fluidbox-origin>
            <img src={product.src} alt={itemLabel(product)} />
          </span>
          <span>
            <strong>Coral runner</strong>
            <br />
            €120
          </span>
        </button>
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}

/** Moving through the viewer scrolls each trigger into view, so the close lands on it. */
export function Scroller() {
  return (
    <Fluidbox.Root items={strip}>
      <div className="pattern-scroller" data-test="scroller">
        {strip.map((photo) => (
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
// #endregion example

export function Origins() {
  return (
    <>
      <ProductCard />
      <Scroller />
    </>
  );
}
