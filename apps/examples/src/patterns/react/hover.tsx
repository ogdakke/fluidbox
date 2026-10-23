// #region example
import { useEffect, useRef } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { productPhoto, thumbnailSrc } from "../shared";

export function Hover() {
  const image = useRef<HTMLImageElement>(null);
  // Magnifies the photo inside its own box under a resting mouse. Returns its cleanup.
  useEffect(() => hoverZoom(image.current!, productPhoto), []);
  return (
    <Fluidbox.Root items={[productPhoto]}>
      <Fluidbox.Trigger item={productPhoto} className="pattern-product" data-test="product">
        <img
          ref={image}
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
