// A slide's hotspots: buttons in the box, each kept on its point of the
// painted media, so they zoom with it. On demand: the viewer loads it the
// first time a slide adds a hotspot.
import type { FluidboxHotspotOptions } from "./public-api";

/**
 * Keep the hotspots placed in `media` on their points of the painted
 * rectangle of the box's main `<img>` or `<video>`: from its shape,
 * `object-fit` and `object-position`. Without one, the points are on the
 * box. They lay out again as the box or its media resizes and as media
 * loads, until `signal` aborts. Returns how to place a hotspot.
 */
export function hotspotLayer(
  media: HTMLElement,
  size: () => { width?: number; height?: number },
  signal: AbortSignal,
): (button: HTMLElement, options: FluidboxHotspotOptions) => void {
  // A slide gone before the code loaded places nothing.
  if (signal.aborted) return () => {};
  const view = media.ownerDocument.defaultView!;
  const pins = new Map<HTMLElement, FluidboxHotspotOptions>();
  let observed: Element | undefined;
  let frame = 0;
  const layout = () => {
    // A frame or a load after the slide went: its observer stays off.
    if (signal.aborted) return;
    // The media the viewer drew, else the first shown, not a hotspot's own
    // content or a hidden preview: wherever a binding renders the rest.
    const main = [
      media.querySelector("[data-fluidbox-drawn]"),
      ...media.querySelectorAll(
        ":is(img, video):not([data-fluidbox-hotspot] *, [aria-hidden=true])",
      ),
    ].find((each) => each?.getClientRects().length) as
      | (HTMLImageElement & HTMLVideoElement)
      | undefined;
    if (main !== observed) {
      if (observed) resize.unobserve(observed);
      if ((observed = main)) resize.observe(main);
    }
    // Pins are absolute in the box's padding box. Its client size is a layout
    // size, which no flight or zoom transforms; out of the page, as a closed
    // viewer's box is, it has none.
    const boxWidth = media.clientWidth;
    const boxHeight = media.clientHeight;
    if (!boxWidth || !boxHeight) return;
    // Numbers count the drawn media's pixels, as its width and height declare
    // them, else as it paints them; without media, the slide item's.
    const declared = main && [
      +main.getAttribute("width")! || 0,
      +main.getAttribute("height")! || 0,
    ];
    const natural = main && [
      main.naturalWidth ?? main.videoWidth,
      main.naturalHeight ?? main.videoHeight,
    ];
    const [width, height] =
      declared?.[0] && declared[1]
        ? declared
        : natural?.[0] && natural[1]
          ? natural
          : [size().width || 100, size().height || 100];
    let left = 0;
    let top = 0;
    let paintedWidth = boxWidth;
    let paintedHeight = boxHeight;
    if (main) {
      // The media's place in the box: its layout offsets, which no flight moves.
      let parent: Element | null = main;
      while (parent && parent !== media) {
        left += (parent as HTMLElement).offsetLeft;
        top += (parent as HTMLElement).offsetTop;
        parent = (parent as HTMLElement).offsetParent;
      }
      const style = view.getComputedStyle(main);
      const mainWidth = parseFloat(style.width) || 0;
      const mainHeight = parseFloat(style.height) || 0;
      // Its shape: as it paints, or as declared until it loads.
      const [shapeWidth, shapeHeight] = natural?.[0] && natural[1] ? natural : [width!, height!];
      const fit = style.objectFit;
      const fitted = (fit === "cover" ? Math.max : Math.min)(
        mainWidth / shapeWidth!,
        mainHeight / shapeHeight!,
      );
      const scale =
        fit === "fill"
          ? 0
          : fit === "none"
            ? 1
            : fit === "scale-down"
              ? Math.min(1, fitted)
              : fitted;
      paintedWidth = scale ? shapeWidth! * scale : mainWidth;
      paintedHeight = scale ? shapeHeight! * scale : mainHeight;
      // Where object-position puts it in the space left. Computed, each is a
      // percentage, a length or calc() of both, as "right 10px" becomes.
      const [x = "", y = ""] = style.objectPosition.match(/calc\(.*?\)|\S+/g) ?? [];
      const resolve = (value: string, space: number) => {
        let total = 0;
        value.replace(/(-\s*)?(\d*\.?\d+)(%|px)/g, (_, minus, number, unit) => {
          total += (minus ? -1 : 1) * number * (unit === "%" ? space / 100 : 1);
          return "";
        });
        return total;
      };
      left += resolve(x, mainWidth - paintedWidth);
      top += resolve(y, mainHeight - paintedHeight);
    }
    // Shares of the box, so a box that keeps its shape needs no new layout. A
    // number, or a string without "%" as an attribute's "412" is, is pixels.
    const along = (
      value: FluidboxHotspotOptions["x"] | null,
      start: number,
      painted: number,
      of: number,
      pixels: number,
    ) => {
      const text = String(value);
      const share = parseFloat(text) / (text.endsWith("%") ? 100 : pixels);
      // A missing or unreadable coordinate puts it on the box's corner, never NaN.
      return `${((start + painted * share) / of) * 100 || 0}%`;
    };
    // A pin no longer in the box is let go; placed again, it comes back.
    for (const [pin, { x, y }] of pins) {
      if (!media.contains(pin)) pins.delete(pin);
      else {
        pin.style.left = along(x, left, paintedWidth, boxWidth, width!);
        pin.style.top = along(y, top, paintedHeight, boxHeight, height!);
        // Shown once it is on its point.
        pin.style.visibility = "";
      }
    }
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
  media.addEventListener(
    "focusin",
    ({ target }) =>
      pins.has(target as HTMLElement) &&
      // From the keyboard: a press focuses as it lands, and a pan under it
      // would take its click away.
      (target as Element).matches(":focus-visible") &&
      view.requestAnimationFrame(() => {
        const viewport = media.closest<HTMLElement>("[data-fluidbox-zoom-viewport]");
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
  return (button, options) => {
    if (signal.aborted) return;
    button.toggleAttribute("data-scale-with-zoom", !!options.scaleWithZoom);
    pins.set(button, options);
    // Once a frame, by when a binding has put the button in the box.
    frame ||= view.requestAnimationFrame(() => {
      frame = 0;
      layout();
    });
    // Development builds only; a page without a bundler has no process.
    try {
      if (process.env.NODE_ENV !== "production") {
        // Once it is in the box and filled, after the layout of its frame.
        view.requestAnimationFrame(() => {
          if (signal.aborted || !button.isConnected) return;
          if (!media.contains(button))
            console.warn(
              "A Fluidbox hotspot is outside its slide's media box: put it inside Media, fluidboxMedia or <fluidbox-media>.",
            );
          // Absolute in the box: an element between that positions it (a
          // position, transform or filter) would hold it off its point.
          else if (button.offsetParent !== media)
            console.warn(
              "A Fluidbox hotspot is inside an element that positions it: keep position, transform and filter off the elements between it and the media box.",
            );
          if (
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
