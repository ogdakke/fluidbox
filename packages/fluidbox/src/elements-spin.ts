/**
 * The spin add-on for the custom elements: the slide of `spin` items, and a
 * content `<img data-spin-frames="/mug/{index}.webp" data-spin-count="36">`
 * read as one, with `data-spin-start`, `data-spin-digits` and
 * `data-spin-autoplay` (seconds a turn takes, or empty). Browser only.
 */
import { defineMarkup, defineSlide } from "./elements";
import { createSpinSlide, spinItem } from "./spin";

defineSlide("spin", createSpinSlide());
defineMarkup("img[data-spin-frames]", (image, { id, title, thumbnail, caption }) => {
  const {
    spinFrames: src,
    spinCount,
    spinStart,
    spinDigits,
    spinAutoplay,
  } = (image as HTMLImageElement).dataset;
  const width = Number(image.getAttribute("width"));
  const height = Number(image.getAttribute("height"));
  if (!width || !height) {
    throw new TypeError(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return `The spin of item ${id} needs width and height attributes.`;
        } catch {}
        return "fluidbox";
      })(),
    );
  }
  return spinItem({
    id,
    title: (image as HTMLImageElement).alt || title,
    frames: {
      src: src!,
      count: Number(spinCount),
      ...(spinStart ? { start: Number(spinStart) } : {}),
      ...(spinDigits ? { digits: Number(spinDigits) } : {}),
    },
    width,
    height,
    ...(spinAutoplay !== undefined ? { autoplay: Number(spinAutoplay) || true } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    ...(caption ? { caption } : {}),
  });
});
