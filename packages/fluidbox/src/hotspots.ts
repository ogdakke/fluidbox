// A slide's hotspots: buttons on points of the painted media, in a layer
// inside the box so they zoom with it. On demand: the viewer loads it the
// first time a slide adds a hotspot.
import type { FluidboxHotspotOptions } from "./public-api";

/**
 * Make `element` the hotspot layer of `media`, sized to the painted rectangle
 * of the box's main `<img>` or `<video>`: from its shape, `object-fit` and
 * `object-position`. Without one, the layer is the box. It lays out again as
 * the box resizes and as media in it loads, until `signal` aborts. Returns
 * how to put a hotspot on its point.
 */
export function hotspotLayer(
  element: HTMLElement,
  media: HTMLElement,
  size: () => { width?: number; height?: number },
  signal: AbortSignal,
): (button: HTMLElement, options: FluidboxHotspotOptions) => void {
  // A slide gone before the code loaded places nothing.
  if (signal.aborted) return () => {};
  element.dataset.fluidboxHotspots = "";
  // Hidden during the flights; it fades in with the controls.
  element.dataset.fluidboxChrome = "";
  const view = media.ownerDocument.defaultView!;
  const layout = () => {
    if (element.parentNode !== media) media.append(element);
    const main = media.querySelector<HTMLImageElement & HTMLVideoElement>(
      ":is(img, video):not([data-fluidbox-hotspots] *, [aria-hidden=true])",
    );
    // Numbers count the drawn media's pixels, as its width and height declare
    // them, else as it paints them; without media, the slide item's.
    const declared = main && [+main.getAttribute("width")!, +main.getAttribute("height")!];
    const natural = main && [
      main.naturalWidth ?? main.videoWidth,
      main.naturalHeight ?? main.videoHeight,
    ];
    const [width, height] = declared?.[1]
      ? declared
      : natural?.[1]
        ? natural
        : [size().width, size().height];
    element.style.setProperty("--fluidbox-hotspots-width", String(width || 100));
    element.style.setProperty("--fluidbox-hotspots-height", String(height || 100));
    // Layout sizes, which no flight or zoom transforms.
    const style = view.getComputedStyle(main ?? media);
    const boxWidth = parseFloat(view.getComputedStyle(media).width);
    const boxHeight = parseFloat(view.getComputedStyle(media).height);
    const box = media.getBoundingClientRect();
    // Out of the page, as a closed viewer's box is, it has nothing to measure.
    if (!main || !box.width || !boxWidth) return;
    const mainWidth = parseFloat(style.width);
    const mainHeight = parseFloat(style.height);
    // Its shape: as it paints, or as declared until it loads.
    const [shapeWidth = 0, shapeHeight = 0] = natural?.[1] ? natural : [width, height];
    const fit = style.objectFit;
    const fitted = (fit === "cover" ? Math.max : Math.min)(
      mainWidth / shapeWidth,
      mainHeight / shapeHeight,
    );
    const painted =
      fit === "fill" || !shapeHeight
        ? 0
        : fit === "none"
          ? 1
          : fit === "scale-down"
            ? Math.min(1, fitted)
            : fitted;
    const paintedWidth = painted ? shapeWidth * painted : mainWidth;
    const paintedHeight = painted ? shapeHeight * painted : mainHeight;
    // Where object-position puts it in the space left: a percentage of that
    // space, or pixels from the start.
    const [positionX = 0, positionY = 0] = style.objectPosition
      .split(" ")
      .map((value, index) =>
        value.endsWith("%")
          ? ((index ? mainHeight - paintedHeight : mainWidth - paintedWidth) * parseFloat(value)) /
            100
          : parseFloat(value) || 0,
      );
    // The media's place in the box, out of the client rectangles' scale.
    const rect = main.getBoundingClientRect();
    const percent = (value: number, of: number) => `${(value / of) * 100}%`;
    // Shares of the box, so a box that keeps its shape needs no new layout.
    Object.assign(element.style, {
      left: percent(((rect.left - box.left) * boxWidth) / box.width + positionX, boxWidth),
      top: percent(((rect.top - box.top) * boxHeight) / box.height + positionY, boxHeight),
      width: percent(paintedWidth, boxWidth),
      height: percent(paintedHeight, boxHeight),
    });
  };
  const resize = new view.ResizeObserver(layout);
  resize.observe(media);
  signal.addEventListener("abort", () => resize.disconnect(), { once: true });
  // Loads don't bubble; a natural size is known once they fire.
  for (const type of ["load", "loadedmetadata"]) {
    media.addEventListener(type, layout, { capture: true, signal });
  }
  // A hotspot taking focus on an image zoomed at rest, in the zoom's
  // scroller, pans it to the middle of the stage if it is outside it, once
  // the browser has scrolled it as far into view as it does.
  element.addEventListener(
    "focusin",
    ({ target }) =>
      view.requestAnimationFrame(() => {
        const viewport = element.closest<HTMLElement>("[data-fluidbox-zoom-viewport]");
        if (!viewport) return;
        // The stage is the window less the insets the zoom gives the scroller.
        const inset = (side: string) =>
          parseFloat(viewport.style.getPropertyValue(`--fluidbox-zoom-stage-${side}`)) || 0;
        const rect = (target as Element).getBoundingClientRect();
        const left = inset("left");
        const top = inset("top");
        const right = view.innerWidth - inset("right");
        const bottom = view.innerHeight - inset("bottom");
        if (rect.left < left || rect.top < top || rect.right > right || rect.bottom > bottom) {
          viewport.scrollBy({
            left: rect.left + rect.width / 2 - (left + right) / 2,
            top: rect.top + rect.height / 2 - (top + bottom) / 2,
            behavior: view.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
        }
      }),
    { signal },
  );
  layout();
  return (button, { x, y, scaleWithZoom }) => {
    button.dataset.fluidboxHotspot = "";
    button.dataset.fluidboxOwnsInput = "";
    button.toggleAttribute("data-scale-with-zoom", !!scaleWithZoom);
    // A number is pixels of the media, out of the layer's width or height.
    const along = (value: FluidboxHotspotOptions["x"], side: string) =>
      typeof value === "number"
        ? `calc(${value}% * 100 / var(--fluidbox-hotspots-${side}))`
        : value;
    button.style.left = along(x, "width");
    button.style.top = along(y, "height");
    if (!element.contains(button)) element.append(button);
    // Development builds only; a page without a bundler has no process.
    try {
      if (process.env.NODE_ENV !== "production") {
        // Once its content is in: the renderer fills the button after it adds it.
        queueMicrotask(() => {
          if (
            button.isConnected &&
            !button.textContent!.trim() &&
            !button.querySelector("img[alt]:not([alt=''])") &&
            !["aria-label", "aria-labelledby", "title"].some((name) => button.getAttribute(name))
          )
            console.warn(
              "A Fluidbox hotspot has no accessible name: give it text or an aria-label.",
            );
        });
      }
    } catch {}
  };
}
