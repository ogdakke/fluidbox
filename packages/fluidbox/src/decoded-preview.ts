const decodedPreviews = new WeakMap<HTMLImageElement, string>();

function rememberDecodedPreview(image: HTMLImageElement) {
  const src = image.currentSrc || image.src;
  if (!src || !image.complete || !image.naturalWidth || !image.naturalHeight) return;
  decodedPreviews.set(image, src);
}

function onLoad(event: Event) {
  rememberDecodedPreview(event.currentTarget as HTMLImageElement);
}

/** Retain the last source which the browser confirmed was decoded for an origin image. */
export function observeDecodedPreview(image: HTMLImageElement) {
  rememberDecodedPreview(image);
  image.addEventListener("load", onLoad);
  return decodedPreviews.get(image) ?? null;
}
