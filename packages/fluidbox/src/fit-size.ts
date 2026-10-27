import { fillsStage } from "./items";
import type { FluidboxItem } from "./public-api";

/**
 * The size a slide's media fits the stage at: as large as the stage allows at
 * its ratio, measured against the slide (a size container), never the
 * viewport. 100vw includes a desktop scrollbar and can differ by a fraction on
 * iOS, which left the image a sliver wider or narrower than its slide.
 *
 * With `--fluidbox-max-upscale` set, a photo stops at its own `width` and
 * `height` times that: at `1`, as in PhotoSwipe, an 800×600 photo shows at
 * 800×600 on a large screen rather than stretched soft. Unset, it fills the
 * stage, since many galleries give `width` and `height` only for the ratio.
 * Video, embeds and custom content always fill it.
 */
export function fitSize(item: FluidboxItem) {
  const height = "var(--fluidbox-content-height, var(--fluidbox-height, 100svh))";
  // A fill box is the stage: the slide's width, and the height less its insets.
  if (fillsStage(item)) return { width: "100cqw", height };
  const { width: itemWidth = 1, height: itemHeight = 1 } = item;
  const capped = (pixels: number) =>
    item.type === "image" ? `, calc(${pixels}px * var(--fluidbox-max-upscale, 1e6))` : "";
  return {
    width: `min(100cqw, calc(${height} * ${itemWidth / itemHeight})${capped(itemWidth)})`,
    height: `min(${(itemHeight / itemWidth) * 100}cqw, ${height}${capped(itemHeight)})`,
  };
}

/** The aspect of the poster in a fill box, from the item's `width` and `height` when it has them. */
export function posterAspect(item: FluidboxItem): number | undefined {
  const { width, height } = item;
  return width && height && width > 0 && height > 0 ? width / height : undefined;
}
