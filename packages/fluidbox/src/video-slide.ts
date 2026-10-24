import type { FluidboxSlideRenderer, FluidboxVideoItem, FluidboxVideoOptions } from "./public-api";

/**
 * A slide for video items that draws the built-in video with these options,
 * as `slides: { video: videoSlide({ attach }) }` does to stream every video.
 */
export function videoSlide(
  options: FluidboxVideoOptions,
): FluidboxSlideRenderer<FluidboxVideoItem> {
  return (slide) => slide.drawVideo(slide.item, options);
}
