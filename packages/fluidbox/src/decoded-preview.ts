const decodedPreviews = new WeakMap<HTMLImageElement, string>();
const observedImages = new WeakSet<HTMLImageElement>();

function rememberDecodedPreview(image: HTMLImageElement) {
  const src = image.currentSrc || image.src;
  if (!src || !image.complete || !image.naturalWidth || !image.naturalHeight) return;
  decodedPreviews.set(image, src);
}

/** Retain the last source which the browser confirmed was decoded for an origin image. */
export function observeDecodedPreview(image: HTMLImageElement) {
  rememberDecodedPreview(image);
  if (!observedImages.has(image)) {
    observedImages.add(image);
    image.addEventListener("load", () => rememberDecodedPreview(image));
  }
  return decodedPreviews.get(image) ?? null;
}
