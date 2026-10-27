/** @jsxImportSource solid-js */
// #region example
import { onCleanup, onMount } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { productPhoto, thumbnailSrc } from "../shared";

export function Hover() {
  let image!: HTMLImageElement;
  // Magnifies the photo inside its own box under a resting mouse.
  onMount(() => onCleanup(hoverZoom(image, productPhoto)));
  return (
    <Fluidbox.Root items={[productPhoto]}>
      <Fluidbox.Trigger value={productPhoto.id} class="pattern-product" data-test="product">
        <img
          ref={(element) => (image = element)}
          src={thumbnailSrc(productPhoto)}
          alt={itemLabel(productPhoto)}
          width={640}
          height={640}
        />
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
// #endregion example
