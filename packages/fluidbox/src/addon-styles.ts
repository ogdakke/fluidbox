/**
 * Add a media add-on's rules to a document once. They are the functional ones,
 * in no cascade layer, as styles.css is; their look is in baseline.css.
 */
export function addStyles(ownerDocument: Document, name: string, css: string) {
  const id = `fluidbox-${name}-styles`;
  if (ownerDocument.getElementById(id)) return;
  const style = ownerDocument.createElement("style");
  style.id = id;
  style.textContent = css;
  ownerDocument.head.append(style);
}

/** The poster under a media add-on's content: the item's thumbnail first, then a sharper image. */
export function paintPoster(
  target: HTMLElement,
  thumbnail:
    | { readonly src: string; readonly srcset?: string; readonly sizes?: string }
    | undefined,
  poster: string | undefined,
  signal: AbortSignal,
) {
  const ownerDocument = target.ownerDocument;
  const layer = (src: string, sync: boolean) => {
    const image = ownerDocument.createElement("img");
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.draggable = false;
    // The thumbnail is the trigger's own picture, already decoded: paint it in
    // the opening's first frame, as a photo's preview does.
    image.decoding = sync ? "sync" : "async";
    image.dataset.fluidboxMediaPoster = sync ? "thumbnail" : "poster";
    image.src = src;
    target.append(image);
    return image;
  };
  if (thumbnail?.src) {
    const image = layer(thumbnail.src, true);
    if (thumbnail.sizes) image.sizes = thumbnail.sizes;
    if (thumbnail.srcset) image.srcset = thumbnail.srcset;
  }
  if (!poster || poster === thumbnail?.src) return;
  const image = layer(poster, !thumbnail?.src);
  if (!thumbnail?.src) return;
  // The sharper poster shows once it can paint at once, over the thumbnail.
  image.dataset.fluidboxMediaPending = "";
  void image.decode().then(
    () => {
      if (!signal.aborted) delete image.dataset.fluidboxMediaPending;
    },
    () => image.remove(),
  );
}

/**
 * The rules every media add-on shares: a box that fills the slide, and its
 * poster. The poster's rules weigh one attribute, so a site's
 * `img { height: auto }` doesn't resize what the flight lands on.
 */
export const posterStyles = `
:where([data-fluidbox-media-addon]) {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
:where([data-fluidbox-media-addon]) > [data-fluidbox-media-poster] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
/* In a box as large as the stage, the poster keeps its own shape. */
:where([data-fluidbox-fill] [data-fluidbox-media-addon]) > [data-fluidbox-media-poster] {
  object-fit: contain;
}
:where([data-fluidbox-media-addon] > [data-fluidbox-media-pending]) {
  opacity: 0;
}
`;
