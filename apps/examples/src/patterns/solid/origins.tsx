/** @jsxImportSource solid-js */
// #region example
import { For } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { product, strip } from "../shared";

export function Origins() {
  return (
    <>
      {/* The photo flies from the element marked data-fluidbox-origin, not the whole card. */}
      <Fluidbox.Root items={[product]}>
        <Fluidbox.Trigger item={product} class="pattern-card" data-test="product">
          <span data-fluidbox-origin>
            <img src={product.src} alt={itemLabel(product)} />
          </span>
          <span>
            <strong>Coral runner</strong>
            <br />
            €120
          </span>
        </Fluidbox.Trigger>
      </Fluidbox.Root>

      {/* Moving through the viewer scrolls each trigger into view, so the close lands on it. */}
      <Fluidbox.Root items={strip}>
        <div class="pattern-scroller" data-test="scroller">
          <For each={strip}>
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
