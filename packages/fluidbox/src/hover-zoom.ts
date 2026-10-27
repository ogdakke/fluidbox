/**
 * The hover zoom add-on: on a desktop, an image on the page magnifies inside
 * its own box under a resting mouse, following the pointer, as a product
 * page's photo does. Import `hoverZoom` from `@ogdakke/fluidbox/hover-zoom`.
 * It has no side effects and touches nothing until hovered, so it is safe to
 * import on the server and costs the page's largest image nothing.
 */
import type { FluidboxImageItem } from "./public-api";
import { sharperCandidate, srcsetCandidates } from "./srcset";

export interface FluidboxHoverZoomOptions {
  /**
   * How much larger than the image's box the magnified image is.
   * @default 2.5
   */
  readonly scale?: number;
  /**
   * The image whose box shows the zoom.
   * @default the first `<img>` in the element, else the element
   */
  readonly image?: HTMLElement;
  /** Removes the hover zoom when aborted. */
  readonly signal?: AbortSignal;
}

/** Fine pointers that can rest on an element: a mouse or a trackpad. */
const HOVER = "(hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Magnify `item` inside the box of the image in `element` while a mouse rests
 * on it, as Amazon's and Shopify's product photos do. The magnified image is
 * the item's `zoom.src`, or the candidate of `zoom.srcset` or `srcset` sharp at
 * the zoom; until it has decoded, the image on the page stands in. It sits
 * over the image, takes no pointer events, so a click still opens the viewer,
 * and goes as the pointer leaves or presses, or the page scrolls. It does
 * nothing on touch screens and with reduced motion. Returns a function that
 * removes it.
 */
export function hoverZoom(
  element: HTMLElement,
  item: FluidboxImageItem,
  { scale = 2.5, image, signal }: FluidboxHoverZoomOptions = {},
): () => void {
  const lifetime = new AbortController();
  const view = element.ownerDocument.defaultView;
  if (!view || signal?.aborted) return () => {};
  signal?.addEventListener("abort", () => lifetime.abort(), { once: true });
  const hover = view.matchMedia(HOVER);
  const reduced = view.matchMedia(REDUCED);
  let lens: HTMLDivElement | undefined;
  let picture: HTMLImageElement | undefined;
  let box: DOMRect | undefined;
  let pointer = { x: 0, y: 0 };
  let frame = 0;
  let loading: AbortController | undefined;

  const target = () => image ?? element.querySelector("img") ?? element;

  // The magnified image covers the box as the page's image does, at `scale`.
  const size = (rect: DOMRect) => {
    const fit = getComputedStyle(target()).objectFit === "contain" ? Math.min : Math.max;
    const ratio = fit(rect.width / item.width, rect.height / item.height) * scale;
    return { width: item.width * ratio, height: item.height * ratio };
  };

  const paint = () => {
    frame = 0;
    if (!lens || !picture || !box) return;
    const { width, height } = size(box);
    const along = (value: number, start: number, length: number) =>
      Math.max(0, Math.min(1, (value - start) / length));
    const x = (box.width - width) * along(pointer.x, box.left, box.width);
    const y = (box.height - height) * along(pointer.y, box.top, box.height);
    picture.style.transform = `translate(${x}px, ${y}px)`;
  };

  const show = (event: PointerEvent) => {
    if (lens || event.pointerType !== "mouse" || !hover.matches || reduced.matches) return;
    const shown = target();
    box = shown.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const ownerDocument = element.ownerDocument;
    lens = ownerDocument.createElement("div");
    lens.dataset.fluidboxHoverZoom = "";
    lens.setAttribute("aria-hidden", "true");
    const style = getComputedStyle(shown);
    Object.assign(lens.style, {
      position: "fixed",
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      overflow: "hidden",
      borderRadius: style.borderRadius,
      pointerEvents: "none",
      zIndex: "var(--layer-fluidbox-hover-zoom, 2)",
      contain: "strict",
      background: style.backgroundColor,
    });
    picture = ownerDocument.createElement("img");
    picture.alt = "";
    picture.decoding = "sync";
    picture.draggable = false;
    const { width, height } = size(box);
    Object.assign(picture.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: "none",
      willChange: "transform",
    });
    // The page's own image stands in, magnified, until the sharp one decodes.
    if (shown instanceof HTMLImageElement && shown.currentSrc) picture.src = shown.currentSrc;
    lens.append(picture);
    pointer = { x: event.clientX, y: event.clientY };
    paint();
    ownerDocument.body.append(lens);
    element.toggleAttribute("data-fluidbox-hover-zooming", true);
    load(width);
  };

  /** Decode the sharpest image the zoom needs off screen, then swap it in. */
  const load = (width: number) => {
    const needed = width * view.devicePixelRatio;
    const candidates = [
      ...srcsetCandidates(item.srcset),
      ...srcsetCandidates(item.zoom?.srcset),
      ...(item.zoom?.src ? [{ src: item.zoom.src, width: Infinity }] : []),
    ];
    const src = sharperCandidate(candidates, 0, needed)?.src ?? item.src;
    if (picture?.src && new URL(src, element.baseURI).href === picture.src) return;
    loading = new AbortController();
    const { signal: pending } = loading;
    const decoder = element.ownerDocument.createElement("img");
    decoder.src = src;
    decoder
      .decode()
      .then(() => {
        if (!pending.aborted && picture) picture.src = src;
      })
      .catch(() => {});
  };

  const hide = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    loading?.abort();
    loading = undefined;
    lens?.remove();
    lens = undefined;
    picture = undefined;
    box = undefined;
    element.removeAttribute("data-fluidbox-hover-zooming");
  };

  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (!lens) {
      // Back after a scroll, or once the button lifts.
      if (!event.buttons) show(event);
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    frame ||= requestAnimationFrame(paint);
  };

  const options = { passive: true, signal: lifetime.signal };
  element.addEventListener("pointerenter", show, options);
  element.addEventListener("pointermove", move, options);
  element.addEventListener("pointerleave", hide, options);
  // The press opens the viewer, whose flight starts from the page's image.
  element.addEventListener("pointerdown", hide, options);
  view.addEventListener("scroll", hide, { ...options, capture: true });
  view.addEventListener("resize", hide, options);
  lifetime.signal.addEventListener("abort", hide, { once: true });
  return () => lifetime.abort();
}
