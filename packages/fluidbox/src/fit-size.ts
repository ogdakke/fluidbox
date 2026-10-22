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
  const capped = (pixels: number) =>
    item.type === "img" ? `, calc(${pixels}px * var(--fluidbox-max-upscale, 1e6))` : "";
  return {
    width: `min(100cqw, calc(${height} * ${item.width / item.height})${capped(item.width)})`,
    height: `min(${(item.height / item.width) * 100}cqw, ${height}${capped(item.height)})`,
  };
}
