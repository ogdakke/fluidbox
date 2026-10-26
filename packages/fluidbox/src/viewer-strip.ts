import type {
  FluidboxDispose,
  FluidboxItem,
  FluidboxSlide,
  FluidboxSlideRenderer,
  FluidboxSource,
} from "./runtime-types";
import { observeDecodedPreview } from "./decoded-preview";
import { fitSize, posterAspect } from "./fit-size";
import { fillsStage, idOf, itemLabel, sameItem } from "./items";
import type { FluidboxLabels } from "./labels";
import { IFRAME_SANDBOX_DEFAULT } from "./iframe-sandbox";
import { paintItemData } from "./item-data";
import { checkItemUrls } from "./media-url";
import type {
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxThumbnail,
  FluidboxVideoItem,
  FluidboxVideoAttachSlide,
  FluidboxMediaErrorKind,
  FluidboxVideoOptions,
  FluidboxZoomableOptions,
  FluidboxZoomPose,
  FluidboxPlayback,
  FluidboxPlaybackSource,
  FluidboxSlideOrigin,
} from "./public-api";

/** A zoom pose as the zoom engine has it, with the box's size before the zoom. */
export interface ViewerZoomPose {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
  readonly moving: boolean;
  /** The box's layout rectangle at fit, in client pixels. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** The zoom viewport the box is seen through, in client pixels. */
  readonly viewport: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
}
import { sharperCandidate, srcsetCandidates } from "./srcset";
import type * as ZoomPosing from "./zoom-pose";

/** A `<video>` as a playback source: nothing until it knows its duration. */
const videoPlayback = (video: HTMLVideoElement) => () =>
  video.readyState < HTMLMediaElement.HAVE_METADATA
    ? null
    : { currentTime: video.currentTime, paused: video.paused || video.ended };

/** A live view of a video's playback: each read is the video's state now. */
const livePlayback = (video: HTMLVideoElement): FluidboxPlayback => ({
  get currentTime() {
    return video.currentTime;
  },
  get paused() {
    return video.paused || video.ended;
  },
  get muted() {
    return video.muted;
  },
});

/** What a trigger shows, as a slide reads it: its video's playback, and its live model. */
const slideOrigin = (video: HTMLVideoElement | null, model: HTMLElement | null) => ({
  ...(video && { video: livePlayback(video) }),
  ...(model && { model }),
});

const WINDOW_SIZE = 31;
const LOAD_RADIUS = 1;

/** The media the runtime draws itself: by a built-in slide, or a slide's draw call. */
type DrawnItem = FluidboxImageItem | FluidboxVideoItem | FluidboxIframeItem;

/** Item types without a slide, warned about once. */
const unknownTypes = new Set<string>();

/** Image files whose shape differs from their item's width and height, warned about once. */
const misshapen = new Set<string>();

const builtIn = (type: string): type is DrawnItem["type"] =>
  type === "image" || type === "video" || type === "iframe";

/** The elements of drawn media. */
interface DrawnParts {
  readonly picture?: HTMLPictureElement;
  readonly placeholder?: HTMLImageElement;
  readonly preview?: HTMLImageElement;
  readonly cover?: HTMLImageElement;
  readonly image: HTMLElement;
}

interface ViewerSlide {
  /** Where the slide sits in the strip; new items can move it. */
  position: number;
  readonly element: HTMLDivElement;
  readonly frame: HTMLDivElement;
  /**
   * The media box: what flies, follows a drag and zooms. A built-in slide's
   * box is its `<img>`, `<video>` or `<iframe>`; any other slide's is a div
   * its renderer draws into.
   */
  readonly media: HTMLElement;
  /** Whether a renderer draws the slide, rather than the built-in media alone. */
  readonly custom: boolean;
  /** The item of the built-in media drawn in the slide, if any. */
  drawn?: DrawnItem;
  /** The draw call that drew it, so a stale undraw does nothing. */
  drawing?: AbortController;
  picture?: HTMLPictureElement;
  placeholder?: HTMLImageElement;
  preview?: HTMLImageElement;
  /** Snapshot shown over embedded media until it has loaded, and while closing. */
  cover?: HTMLImageElement;
  /** The drawn `<img>`, `<video>` or `<iframe>`: the box itself in a built-in slide. */
  image?: HTMLElement;
  readonly error: HTMLDivElement;
  readonly retry: HTMLButtonElement;
  /** The drawn media has started loading. */
  loaded: boolean;
  /** The renderer of a custom slide has run, and not been disposed. */
  rendered: boolean;
  /** The renderer called `slide.fail`, so Retry renders it again. */
  failed?: boolean;
  /** Aborts the renderer's signal. */
  content?: AbortController;
  /** The origin an open prepared before the renderer drew, for the image it draws. */
  origin?: HTMLImageElement | null;
  /** What the trigger showed, on the slide an open started from it. */
  originPlayback?: FluidboxSlideOrigin;
  /** What the slide hands back to the trigger's video as a close starts from it. */
  playback?: FluidboxPlaybackSource;
  /** The renderer's listeners for a close starting from the slide. */
  closeListeners?: Set<(landing: FluidboxSlideOrigin | null) => void>;
  /** The slide's layer beside the box, made when a renderer first asks for it. */
  layer?: HTMLDivElement;
  /** What the renderer said of zoom, if it did: off, or on with these options. */
  zoom?: false | FluidboxZoomableOptions;
  /** The renderer's listeners for the box's zoom pose. */
  zoomListeners?: Set<(pose: FluidboxZoomPose) => void>;
  decoded: boolean;
  fullApplied: boolean;
  imageVersion: number;
  previewController?: AbortController;
  controller?: AbortController;
  /** A playing origin's picture, shown until the slide's player catches up with it. */
  videoHandoff?: AbortController;
  /** How a custom slide's drawn video loads: `attach` from `drawVideo`, and the slide it tells. */
  videoOptions?: FluidboxVideoOptions & { readonly slide: FluidboxVideoAttachSlide };
  /** The load of a sharper candidate for the zoom, until it swaps in. */
  sharpening?: AbortController;
  /** The URL of the sharper candidate the image shows for the zoom, if any. */
  sharpened?: string;
  dispose?: FluidboxDispose;
  /** Custom content's view of whether its slide is on show, and who follows it. */
  activity?: { active: boolean; readonly listeners: Set<(active: boolean) => void> };
  /**
   * Settles once the renderer's content has committed: as the renderer
   * returns, or when the binding holding the commit reports it.
   */
  commit?: Promise<void>;
  /** Settles the commit, for a slide that unloads before it commits. */
  release?: () => void;
  /** The renderer's `waitUntil` promises, each until it settles. */
  waits?: Set<Promise<void>>;
}

/** Where a binding finds the hold on a slide's commit: shared across chunks by its key. */
const holdCommit = Symbol.for("fluidbox.holdCommit");

/** Settles once a video can show a frame, or its poster has decoded. */
function videoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const settled = new AbortController();
    const done = () => {
      settled.abort();
      resolve();
    };
    video.addEventListener("loadeddata", done, { signal: settled.signal });
    video.addEventListener("error", done, { signal: settled.signal });
    if (video.poster) {
      const poster = new Image();
      poster.src = video.poster;
      poster.decode().then(done, () => {});
    }
  });
}

/** Point an image at a thumbnail, its srcset and sizes included. */
function safeUrls(item: FluidboxItem) {
  try {
    checkItemUrls(item);
    return true;
  } catch {
    return false;
  }
}

function paintThumbnail(image: HTMLImageElement, thumbnail: FluidboxThumbnail) {
  if (thumbnail.sizes) image.sizes = thumbnail.sizes;
  else image.removeAttribute("sizes");
  if (thumbnail.srcset) image.srcset = thumbnail.srcset;
  else image.removeAttribute("srcset");
  image.src = thumbnail.src;
}

/** Bounded native-scrolling gallery for the plain DOM runtime. */
export class ViewerStrip<TItem extends FluidboxItem = FluidboxItem> {
  readonly element: HTMLDivElement;
  readonly #ownerDocument: Document;
  readonly #slides = new Map<number, ViewerSlide>();
  readonly #observer: ResizeObserver;
  readonly #controller = new AbortController();
  readonly #onSelect: (index: number, settled: boolean) => void;
  readonly #allows: (index: number) => boolean;
  readonly #renderers: Readonly<Record<string, FluidboxSlideRenderer<any> | undefined>>;
  readonly #labels: FluidboxLabels;
  #source: FluidboxSource<TItem>;
  #loop: boolean;
  /**
   * The position on show. Without a loop it is the item's index. With one,
   * positions run on past both ends and each shows item `position mod count`.
   */
  #index = 0;
  #base = 0;
  #width = 0;
  /** -1 when the strip runs right to left, where `scrollLeft` counts down from 0. */
  #sign = 1;
  #mounted = false;
  /** Closed: the strip keeps its slides for the next open, but none is on show. */
  #hidden = false;
  #rebasing = false;
  #rebaseFrame = 0;
  #instantFrame = 0;
  #instantTarget: number | null = null;
  #frozen = false;
  #frozenLeft = 0;
  #userOwned = false;
  #userScrolled = false;
  #touching = false;
  #fingers = false;
  #lastWheel = 0;
  // A gesture asks before it moves to a slide: once a slide is approved it
  // stays approved, and once refused the gesture is fenced off from that side.
  #approved: number | null = null;
  #refused: number | null = null;
  #fence: -1 | 0 | 1 = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #selection:
    | { index: number; resolve: () => void; timeout: ReturnType<typeof setTimeout> }
    | undefined;
  /** While new items are laid out: the old slides whose item is unchanged, by id. */
  /** The item an open waits for, and whether its flight has started. */
  #opening: { readonly index: number; readonly flying: boolean } | undefined;
  /** The trigger's video the open under way starts from, and the item it opens. */
  #originMedia:
    | {
        readonly index: number;
        readonly video: HTMLVideoElement | null;
        readonly model: HTMLElement | null;
      }
    | undefined;
  #recycled: Map<string, { item: TItem; slide: ViewerSlide }[]> | undefined;

  constructor(
    ownerDocument: Document,
    source: FluidboxSource<TItem>,
    onSelect: (index: number, settled: boolean) => void,
    allows: (index: number) => boolean,
    renderers: Readonly<Record<string, FluidboxSlideRenderer<any> | undefined>>,
    labels: FluidboxLabels,
    loop = false,
  ) {
    this.#labels = labels;
    this.#loop = loop;
    this.#ownerDocument = ownerDocument;
    this.#source = source;
    this.#onSelect = onSelect;
    this.#allows = allows;
    this.#renderers = renderers;
    this.element = ownerDocument.createElement("div");
    this.element.dataset.fluidboxSlides = "";
    this.element.setAttribute("role", "region");
    this.#labelStrip();
    this.#renderWindow(0, 0);
    const { signal } = this.#controller;
    this.element.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.element.addEventListener("scrollend", this.#settled, { signal });
    for (const type of ["pointerdown", "touchstart", "wheel"] as const) {
      this.element.addEventListener(type, this.#takeControl, {
        capture: true,
        passive: true,
        signal,
      });
    }
    for (const type of ["pointerup", "pointercancel", "touchend", "touchcancel"] as const) {
      this.element.addEventListener(type, this.#releaseControl, {
        capture: true,
        passive: true,
        signal,
      });
    }
    this.#observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === this.#width) return;
      this.#width = entry.contentRect.width;
      this.#align(this.#index);
    });
  }

  /** Called before a slide's media unloads, with its box: the zoom lets go of it. */
  onUnload: ((media: HTMLElement) => void) | undefined;
  /** Called when the slide on show may have started or stopped being zoomable. */
  onZoomableChange: (() => void) | undefined;
  /** What turns a zoom pose into a slide's, loaded once a slide follows its zoom. */
  #posing: typeof ZoomPosing | undefined;
  /** The pose that came while it loaded. */
  #lastPose: [HTMLElement, ViewerZoomPose] | undefined;
  /** Called as a slide shows its error, and when a sharper image for the zoom fails. */
  onMediaError: ((index: number, kind: FluidboxMediaErrorKind, cause: unknown) => void) | undefined;

  /** The item on show. */
  get index() {
    return this.#item(this.#index);
  }

  get active() {
    const slide = this.current;
    if (!slide) throw new Error("The viewer source has no active image.");
    return slide;
  }

  /** The slide on show, or undefined while the source is empty. */
  get current(): ViewerSlide | undefined {
    return this.#slides.get(this.#index);
  }

  /**
   * Whether the strip is on an item and staying there. A glide still on its
   * way elsewhere can pass the item, a whole lap behind in a loop.
   */
  shows(index: number) {
    return this.index === index && (!this.#selection || this.#selection.index === this.#index);
  }

  get activeItem() {
    return this.#source.getItem(this.index);
  }

  /**
   * The item the slide on show pictures, for matching it to its trigger: the
   * built-in media it draws, else its own item.
   */
  get shownItem(): FluidboxItem | undefined {
    return this.current?.drawn ?? this.activeItem;
  }

  /** Whether the slide on show is a renderer's box with nothing in it, which doesn't fly. */
  get empty() {
    const slide = this.current;
    return !!slide?.custom && !slide.media.hasChildNodes();
  }

  /**
   * Whether the box on show zooms, and how: a drawn image does unless its
   * renderer said otherwise, and a renderer's own box does once it says so.
   * Null when it doesn't.
   */
  zoomable(): { readonly max?: number; readonly sharpen: boolean } | null {
    const slide = this.current;
    if (!slide || slide.zoom === false) return null;
    const image = slide.drawn?.type === "image" && slide.image instanceof HTMLImageElement;
    if (slide.zoom) return { max: slide.zoom.max, sharpen: slide.zoom.sharpen ?? image };
    return image ? { sharpen: true } : null;
  }

  /** Whether a slide follows its box's zoom pose, so the zoom reports every frame. */
  watchesZoom() {
    return !!this.current?.zoomListeners?.size;
  }

  /** Tell the slide whose box this is where its zoom is, once its pose code is in. */
  zoomPose(media: HTMLElement, pose: ViewerZoomPose) {
    const slide = this.current?.media === media ? this.current : undefined;
    const listeners = slide?.zoomListeners;
    if (!slide || !listeners?.size) return;
    if (!this.#posing) {
      this.#lastPose = [media, pose];
      return;
    }
    const shown = this.#posing.shownPose(this.#source.getItem(this.#item(this.#index)), pose);
    for (const listener of listeners) listener(shown);
  }

  /** Load what turns a zoom pose into a slide's, and tell it the pose it missed. */
  #loadPosing() {
    void import("./zoom-pose").then((posing) => {
      this.#posing = posing;
      const last = this.#lastPose;
      this.#lastPose = undefined;
      if (last) this.zoomPose(...last);
    });
  }

  /** Whether the strip goes round: a single item has nowhere to go. */
  get #loops() {
    return this.#loop && this.#source.count > 1;
  }

  /** The item at a position. */
  #item(position: number) {
    const count = this.#source.count;
    return this.#loops ? ((position % count) + count) % count : position;
  }

  /** The position of an item: the nearest one, or the next one round in the `step` direction. */
  #near(index: number, step?: 1 | -1) {
    if (!this.#loops) return index;
    const count = this.#source.count;
    let delta = (((index - this.#index) % count) + count) % count;
    if (step === -1 ? delta > 0 : step !== 1 && delta > count / 2) delta -= count;
    return this.#index + delta;
  }

  /** How far the frozen strip sits from its slide, in screen pixels. */
  get snapOffset() {
    return this.#frozen
      ? this.#sign * (this.#frozenLeft - (this.#index - this.#base) * this.#width)
      : 0;
  }

  /** The scroll position from the strip's start, positive in either direction. */
  get #left() {
    return this.#sign * this.element.scrollLeft;
  }

  #scrollTo(left: number, behavior: ScrollBehavior) {
    this.element.scrollTo({ left: this.#sign * left, behavior });
  }

  /**
   * Show new items. A slide whose item is unchanged stays, loaded, wherever its
   * item moved to, so swapping a product's variant keeps the photos it shares.
   */
  setSource(source: FluidboxSource<TItem>) {
    this.#resolveSelection();
    this.#focusable(source.count);
    this.#unfence();
    const previous = this.#source;
    const index = this.index;
    const shown = previous.count ? idOf(previous.getItem(index)) : null;
    const recycled = new Map<string, { item: TItem; slide: ViewerSlide }[]>();
    for (const [position, slide] of this.#slides) {
      const at = this.#item(position);
      const item = previous.getItem(at);
      const id = idOf(item);
      // Most items stay where they were; a lazy list without indexOf finds an id by scanning.
      const next = at < source.count && idOf(source.getItem(at)) === id ? at : source.getIndex(id);
      if (next !== null && sameItem(item, source.getItem(next))) {
        recycled.set(id, [...(recycled.get(id) ?? []), { item, slide }]);
      } else {
        this.#unload(slide);
        slide.element.remove();
      }
    }
    this.#slides.clear();
    this.#source = source;
    // The strip stays on the item it shows, wherever that went.
    this.#index =
      (shown === null ? null : source.getIndex(shown)) ??
      Math.max(0, Math.min(index, source.count - 1));
    this.#base = 0;
    this.#recycled = recycled;
    this.#renderWindow(this.#index, this.#index);
    this.#recycled = undefined;
    for (const { slide } of [...recycled.values()].flat()) {
      this.#unload(slide);
      slide.element.remove();
    }
    this.#align(this.#index);
  }

  /** An unchanged old slide for the item at a position, moved there. */
  #recycle(position: number) {
    const item = this.#source.getItem(this.#item(position));
    const kept = this.#recycled?.get(idOf(item));
    const found = kept?.findIndex((each) => sameItem(each.item, item)) ?? -1;
    if (!kept || found < 0) return undefined;
    const { slide } = kept.splice(found, 1)[0]!;
    slide.position = position;
    this.#labelSlide(slide.element, position);
    // The same item, but its data may have changed.
    paintItemData(slide.element, item.data);
    this.#present(slide, position === this.#index);
    return slide;
  }

  /** Go round, or stop at the ends. The slides are made again around the item on show. */
  setLoop(loop: boolean) {
    if (loop === this.#loop) return;
    const index = this.index;
    // Positions mean something else now, so no slide carries over.
    for (const slide of this.#slides.values()) {
      this.#unload(slide);
      slide.element.remove();
    }
    this.#slides.clear();
    this.#loop = loop;
    this.#index = index;
    this.setSource(this.#source);
  }

  mount() {
    if (!this.#mounted) {
      this.#mounted = true;
      this.#observer.observe(this.element);
    }
    this.#sign = getComputedStyle(this.element).direction === "rtl" ? -1 : 1;
    // The exact width, as the resize observer reports it. clientWidth rounds,
    // and index × rounded width drifts off the slides on a fractional viewport.
    this.#width = this.element.getBoundingClientRect().width;
    this.#align(this.#index);
    this.#loadWindow();
    this.#hidden = false;
    this.#activate();
  }

  /** The viewer has closed: no slide is on show until the strip mounts again. */
  hide() {
    this.#hidden = true;
    this.#activate();
  }

  unmount() {
    if (!this.#mounted) return;
    this.#mounted = false;
    this.#activate();
    this.#observer.disconnect();
    this.#resolveSelection();
    for (const slide of this.#slides.values()) this.#unload(slide);
  }

  select(item: number, smooth: boolean, step?: 1 | -1): Promise<void> {
    if (!Number.isInteger(item) || item < 0 || item >= this.#source.count) {
      throw new RangeError(`Viewer strip index ${item} is out of range.`);
    }
    const index = this.#near(item, step);
    // A newer selection owns the strip. Cancel the previous smooth-scroll
    // fallback before rebasing its virtual window, otherwise that stale timer
    // can jump to a slide which has already been recycled.
    this.#resolveSelection();
    this.#unfence();
    if (!this.#slides.has(index)) this.#renderWindow(index, smooth ? this.#index : index);
    if (!this.#mounted || !smooth || index === this.#index) {
      this.#jump(index);
      return Promise.resolve();
    }
    this.#scrollTo((index - this.#base) * this.#width, "smooth");
    return new Promise<void>((resolve) => {
      // The fallback lands the slide only once the smooth scroll has stalled.
      // Safari takes well over half a second to cross a wide viewport, and
      // jumping while it still glides snaps the last stretch into place.
      const started = performance.now();
      let last = this.#left;
      const check = () => {
        const left = this.#left;
        const moving = Math.abs(left - last) > 1;
        last = left;
        if (moving && performance.now() - started < 2000 && this.#selection) {
          this.#selection.timeout = setTimeout(check, 120);
          return;
        }
        this.#jump(index);
        this.#resolveSelection();
      };
      this.#selection = { index, resolve, timeout: setTimeout(check, 600) };
    });
  }

  destroy() {
    this.#controller.abort();
    this.#observer.disconnect();
    cancelAnimationFrame(this.#rebaseFrame);
    cancelAnimationFrame(this.#instantFrame);
    clearTimeout(this.#settleTimer);
    this.#resolveSelection();
    for (const slide of this.#slides.values()) this.#unload(slide);
    this.#slides.clear();
    this.element.remove();
  }

  freeze() {
    if (this.#frozen) return;
    this.#frozenLeft = this.#left;
    this.#frozen = true;
    this.element.dataset.fluidboxFrozen = "";
    this.#scrollTo(this.#frozenLeft, "instant");
  }

  resume() {
    if (!this.#frozen) return;
    this.#scrollTo(this.#frozenLeft, "instant");
    this.element.style.removeProperty("--fluidbox-scroll-compensation");
    this.#frozen = false;
    delete this.element.dataset.fluidboxFrozen;
    this.#align(this.#index);
  }

  /** Show the labels again after they changed in place. */
  relabel() {
    this.#labelStrip();
    for (const [index, slide] of this.#slides) {
      this.#labelSlide(slide.element, index);
      slide.retry.textContent = this.#labels.retry;
      slide.error.firstChild!.textContent = `${this.#labels.error} `;
    }
  }

  #labelStrip() {
    this.element.setAttribute("aria-label", this.#labels.slides);
    this.element.setAttribute("aria-roledescription", this.#labels.carousel);
    this.#focusable(this.#source.count);
  }

  /**
   * A gallery's strip scrolls, so it takes focus, where the arrow keys move
   * through it. A single item's doesn't.
   */
  #focusable(count: number) {
    this.element.tabIndex = count > 1 ? 0 : -1;
  }

  #labelSlide(element: HTMLElement, index: number) {
    element.setAttribute(
      "aria-label",
      this.#labels.position(this.#item(index), this.#source.count),
    );
    element.setAttribute("aria-roledescription", this.#labels.slide);
  }

  /** Show one slide to assistive technology and the keyboard, and hide another. */
  #present(slide: ViewerSlide | undefined, shown: boolean) {
    if (!slide) return;
    slide.element.setAttribute("aria-hidden", String(!shown));
    slide.element.toggleAttribute("data-active", shown);
    slide.element.inert = !shown;
  }

  #makeSlide(index: number) {
    const item = this.#source.getItem(this.#item(index));
    const element = this.#ownerDocument.createElement("div");
    element.dataset.fluidboxSlide = "";
    element.setAttribute("role", "group");
    this.#labelSlide(element, index);
    paintItemData(element, item.data);
    const frame = this.#ownerDocument.createElement("div");
    frame.dataset.fluidboxFrame = "";
    const size = fitSize(item);
    frame.style.setProperty("--fluidbox-item-width", size.width);
    frame.style.setProperty("--fluidbox-item-height", size.height);
    const error = this.#ownerDocument.createElement("div");
    error.dataset.fluidboxError = "";
    error.hidden = true;
    error.setAttribute("role", "alert");
    const retry = this.#ownerDocument.createElement("button");
    retry.type = "button";
    retry.dataset.fluidboxRetry = "";
    retry.textContent = this.#labels.retry;
    retry.addEventListener("click", () => this.#retry(slide.position));
    error.append(`${this.#labels.error} `, retry);
    // A slide of your own for the type comes first, then the built-in one.
    const custom = !!this.#renderers[item.type] || !builtIn(item.type);
    let drawn: DrawnParts | undefined;
    let media: HTMLElement;
    if (custom) {
      const content = this.#ownerDocument.createElement("div");
      content.dataset.fluidboxItemContent = "";
      content.setAttribute("role", "group");
      content.setAttribute("aria-label", itemLabel(item));
      frame.append(content);
      media = content;
    } else {
      drawn = this.#build(item as DrawnItem, frame, frame);
      media = drawn.image;
    }
    media.dataset.fluidboxMedia = "";
    if (fillsStage(item)) {
      // The box is the stage. The flight starts from the poster inside it: the
      // item's aspect when it has one, else the trigger's own.
      media.dataset.fluidboxFill = String(posterAspect(item) ?? "");
    } else {
      media.style.setProperty("--fluidbox-media-aspect", `${item.width} / ${item.height}`);
    }
    frame.append(error);
    element.append(frame);
    const slide: ViewerSlide = {
      position: index,
      element,
      frame,
      media,
      custom,
      drawn: drawn && (item as DrawnItem),
      ...drawn,
      error,
      retry,
      loaded: false,
      rendered: false,
      decoded: false,
      fullApplied: false,
      imageVersion: 0,
      playback: drawn?.image instanceof HTMLVideoElement ? videoPlayback(drawn.image) : undefined,
    };
    this.#wire(slide, this.#controller.signal);
    this.#present(slide, index === this.#index);
    return slide;
  }

  /**
   * Make the built-in media for an item into `host`: the frame of a built-in
   * slide, where the media element is the box, or the box of a custom one.
   */
  #build(item: DrawnItem, frame: HTMLDivElement, host: HTMLElement): DrawnParts {
    let picture: HTMLPictureElement | undefined;
    let placeholder: HTMLImageElement | undefined;
    let preview: HTMLImageElement | undefined;
    let cover: HTMLImageElement | undefined;
    let media: HTMLElement;
    const decorative = (key: string) => {
      const image = this.#ownerDocument.createElement("img");
      image.dataset[key] = "";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.decoding = "sync";
      return image;
    };
    if (item.type === "image") {
      frame.dataset.fluidboxImageFrame = "";
      if (item.placeholder) {
        placeholder = decorative("fluidboxSlidePlaceholder");
        placeholder.src = item.placeholder;
        host.append(placeholder);
      }
      if (item.thumbnail?.src) {
        // A preview is small and usually already decoded for the page; paint it
        // on the first frame it appears in.
        preview = decorative("fluidboxSlidePreview");
        host.append(preview);
      }
      picture = this.#ownerDocument.createElement("picture");
      picture.dataset.fluidboxPicture = "";
      picture.style.display = "contents";
      const image = this.#ownerDocument.createElement("img");
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      image.decoding = "async";
      image.draggable = false;
      image.dataset.fluidboxImagePending = "";
      picture.append(image);
      host.append(picture);
      media = image;
    } else if (item.type === "video") {
      const video = this.#ownerDocument.createElement("video");
      video.controls = item.controls ?? true;
      video.playsInline = item.playsInline ?? true;
      video.preload = item.preload ?? "metadata";
      video.loop = item.loop ?? false;
      video.muted = item.muted ?? false;
      video.setAttribute("aria-label", item.title);
      for (const track of item.tracks ?? []) {
        const element = this.#ownerDocument.createElement("track");
        element.src = track.src;
        if (track.kind) element.kind = track.kind;
        if (track.srclang) element.srclang = track.srclang;
        if (track.label) element.label = track.label;
        element.default = !!track.default;
        video.append(element);
      }
      host.append(video);
      media = video;
    } else {
      const iframe = this.#ownerDocument.createElement("iframe");
      iframe.title = item.title;
      iframe.loading = "lazy";
      iframe.setAttribute("allowfullscreen", "");
      host.append(iframe);
      media = iframe;
      cover = decorative("fluidboxMediaCover");
      if (item.thumbnail) paintThumbnail(cover, item.thumbnail);
      host.append(cover);
    }
    // Inside a box, the box is the media; the drawn element fills it.
    if (host !== frame) media.dataset.fluidboxDrawn = "";
    return { picture, placeholder, preview, cover, image: media };
  }

  /** Follow the drawn image's loads and failures until `signal` aborts. */
  #wire(slide: ViewerSlide, signal: AbortSignal) {
    const image = slide.image;
    if (slide.drawn?.type !== "image" || !(image instanceof HTMLImageElement)) return;
    image.addEventListener(
      "load",
      () => {
        void this.#revealImage(slide, slide.imageVersion);
      },
      { signal },
    );
    image.addEventListener("error", (event) => this.#fail(slide, "image", event), { signal });
  }

  /** Where a slide's drawn media sits: its frame, or a custom slide's box. */
  #host(slide: ViewerSlide) {
    return slide.custom ? slide.media : slide.frame;
  }

  /**
   * Mark the item an open waits for, so its slide mounts with `opening` set,
   * then the start of its flight, after which `waitUntil` comes too late.
   */
  setOpening(index: number | undefined, flying = false) {
    this.#opening = index === undefined ? undefined : { index, flying };
    if (index === undefined) this.#originMedia = undefined;
  }

  /**
   * The trigger's video and live model an open of the item at `index` starts
   * from, or null. The slide for it, mounted or yet to mount, gets them as its
   * `origin`.
   */
  setOriginMedia(index: number, video: HTMLVideoElement | null, model: HTMLElement | null) {
    this.#originMedia = video || model ? { index, video, model } : undefined;
    const slide = this.#slides.get(this.#near(index));
    if (this.#originMedia && slide?.rendered) slide.originPlayback = slideOrigin(video, model);
  }

  /**
   * Tell the slide on show that a close starts from it, with what the trigger
   * it lands on shows. Each listener runs once per close.
   */
  closing(video: HTMLVideoElement | null, model: HTMLElement | null) {
    const listeners = this.current?.closeListeners;
    if (!listeners?.size) return;
    const landing = video || model ? slideOrigin(video, model) : null;
    for (const listener of listeners) {
      try {
        listener(landing);
      } catch (error) {
        // A slide's error doesn't stop the close.
        if (typeof reportError === "function") reportError(error);
      }
    }
  }

  /** The playback the slide on show hands back as the viewer closes from it, or null. */
  returnedPlayback() {
    const source = this.current?.playback;
    return (typeof source === "function" ? source() : source) ?? null;
  }

  /** Register what a slide hands back on close, until the function it returns runs. */
  #returnPlayback(slide: ViewerSlide, source: FluidboxPlaybackSource) {
    slide.playback = source;
    return () => {
      if (slide.playback === source) slide.playback = undefined;
    };
  }

  /**
   * Settles once the slide for an item is ready to show, after `cap` ms, or as `signal` aborts:
   * its content has committed, the images and videos in its box can paint and
   * its `waitUntil` promises have settled. The built-in media a slide draws
   * adds no wait, and a built-in slide is ready at once. Callable outside an
   * open, for whatever waits on the next slide.
   */
  async ready(index: number, cap: number, signal?: AbortSignal) {
    if (signal?.aborted) return;
    const slide = this.#slides.get(this.#near(index));
    if (!slide?.custom || !slide.rendered) return;
    const content = slide.content;
    // What is still pending, for the warning at the cap.
    const pending = new Map<Promise<void>, string>();
    let committed = false;
    const ready = (async () => {
      await slide.commit;
      committed = true;
      if (slide.content !== content) return;
      const track = (promise: Promise<void>, what: string) => {
        pending.set(promise, what);
        void promise.then(() => pending.delete(promise));
      };
      for (const [promise, what] of this.#boxWaits(slide)) track(promise, what);
      // A waitUntil before the flight starts still counts, so read them until none is new.
      const seen = new Set<Promise<void>>();
      for (;;) {
        const fresh = [...(slide.waits ?? [])].filter((promise) => !seen.has(promise));
        for (const promise of fresh) {
          seen.add(promise);
          track(promise, "a waitUntil promise");
        }
        if (!pending.size && !fresh.length) return;
        await Promise.all(pending.keys());
        if (slide.content !== content) return;
        if (![...(slide.waits ?? [])].some((promise) => !seen.has(promise))) return;
      }
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const capped = new Promise<false>((resolve) => {
      timer = setTimeout(resolve, cap, false);
      signal?.addEventListener("abort", () => resolve(false), { once: true });
    });
    const done = await Promise.race([ready.then(() => true), capped]);
    clearTimeout(timer);
    if (signal?.aborted) return;
    // Development builds only; a page without a bundler has no process.
    try {
      if (process.env.NODE_ENV !== "production" && !done && slide.content === content) {
        const waiting = committed ? [...pending.values()] : ["the slide's content to commit"];
        console.warn(
          `Fluidbox showed ${itemLabel(this.#source.getItem(index))} after ${cap} ms without its slide ready, still waiting for ${waiting.join(", ")}.`,
        );
      }
    } catch {}
  }

  /** The images and videos in a slide's box that must paint, but not the built-in media it drew. */
  *#boxWaits(slide: ViewerSlide): Generator<[Promise<void>, string]> {
    const drawn = [slide.picture, slide.placeholder, slide.preview, slide.cover, slide.image];
    const own = (element: Element) => !drawn.some((part) => part?.contains(element));
    for (const image of slide.media.querySelectorAll("img")) {
      if (!own(image)) continue;
      const decoded = image.decode().catch(() => {});
      yield [decoded, `<img src="${image.currentSrc || image.src}">`];
    }
    for (const video of slide.media.querySelectorAll("video")) {
      if (!own(video) || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) continue;
      yield [videoFrame(video), `<video src="${video.currentSrc || video.src}">`];
    }
  }

  prepareOpening(index: number, origin?: HTMLImageElement) {
    const position = this.#near(index);
    const slide = this.#slides.get(position);
    if (!slide) return;
    // The renderer hasn't drawn yet: the image it draws paints the origin.
    if (slide.custom && !slide.rendered) {
      slide.origin = origin ?? null;
      return;
    }
    if (!this.#paintOpening(slide, origin)) return;
    this.#reset(slide);
    slide.fullApplied = false;
    this.#loadMedia(position, slide);
  }

  /**
   * Paint the trigger's picture into a slide's drawn media, for the opening's
   * first frame. Returns whether the image must load again behind it.
   */
  #paintOpening(slide: ViewerSlide, origin?: HTMLImageElement | null) {
    const item = slide.drawn;
    if (slide.cover) {
      // Embedded pages paint long after the opening motion starts. The origin's
      // snapshot covers the frame until the embed reports that it has loaded.
      if (item?.thumbnail) paintThumbnail(slide.cover, item.thumbnail);
      else {
        const src = origin?.currentSrc || origin?.src;
        if (src) slide.cover.src = src;
      }
      return false;
    }
    if (item?.type !== "image" || !(slide.image instanceof HTMLImageElement)) return false;
    const decodedPreview = origin ? observeDecodedPreview(origin) : null;
    const preview = decodedPreview || item.thumbnail?.src || origin?.currentSrc || origin?.src;
    if (preview) {
      slide.imageVersion += 1;
      // The card's image is already decoded. Asynchronous decoding lets Safari
      // skip painting it on the opening's first frame, which reads as a blink.
      if (decodedPreview) slide.image.decoding = "sync";
      if (decodedPreview) delete slide.image.dataset.fluidboxImagePending;
      else slide.image.dataset.fluidboxImagePending = "";
      // The preview first: Safari loads `src` the moment the sources and
      // srcset go, and until then it is the full image's fallback.
      slide.image.src = preview;
      for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
      slide.image.removeAttribute("srcset");
      slide.image.removeAttribute("sizes");
    }
    return true;
  }

  /**
   * Continue an origin video's playback in the slide. Until the player has
   * caught up, a canvas keeps painting the origin's own frames, so the opening
   * starts on the frame the card shows and the picture never stops moving.
   */
  continueVideo(index: number, origin: HTMLVideoElement) {
    const slide = this.#slides.get(this.#near(index));
    const video = slide?.image;
    if (!slide || slide.drawn?.type !== "video" || !(video instanceof HTMLVideoElement)) return;
    slide.videoHandoff?.abort();
    if (origin.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !origin.videoWidth) return;
    const handoff = new AbortController();
    slide.videoHandoff = handoff;
    const canvas = this.#ownerDocument.createElement("canvas");
    canvas.dataset.fluidboxVideoStandIn = "";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = origin.videoWidth;
    canvas.height = origin.videoHeight;
    const context = canvas.getContext("2d");
    const paint = () => {
      try {
        context?.drawImage(origin, 0, 0, canvas.width, canvas.height);
      } catch {
        // A frame that cannot be drawn leaves the last one in place.
      }
    };
    paint();
    slide.frame.append(canvas);
    const playing = !origin.paused && !origin.ended;
    let frameRequest = 0;
    const follow = () => {
      if (handoff.signal.aborted) return;
      paint();
      frameRequest = origin.requestVideoFrameCallback(follow);
    };
    if (playing) follow();
    handoff.signal.addEventListener(
      "abort",
      () => {
        origin.cancelVideoFrameCallback(frameRequest);
        // An animation on a detached element may never finish, and the opening waits on it.
        for (const animation of canvas.getAnimations()) animation.cancel();
        canvas.remove();
        if (slide.videoHandoff === handoff) slide.videoHandoff = undefined;
      },
      { once: true },
    );
    video.muted = origin.muted;
    video.loop = origin.loop;
    video.preload = "auto";
    const signal = handoff.signal;
    const once = (type: string) =>
      new Promise<void>((resolve) => {
        video.addEventListener(type, () => resolve(), { once: true, signal });
      });
    const presented = () =>
      new Promise<void>((resolve) => video.requestVideoFrameCallback(() => resolve()));
    const seek = async (time: number) => {
      if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) return;
      const seeked = once("seeked");
      video.currentTime = time;
      await seeked;
    };
    void (async () => {
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) await once("loadedmetadata");
      if (signal.aborted) return;
      await seek(origin.currentTime);
      // The origin kept playing during the first seek; the second is short.
      if (!signal.aborted && playing) await seek(origin.currentTime);
      if (signal.aborted) return;
      if (playing) await video.play().catch(() => undefined);
      if (signal.aborted) return;
      await presented();
      handoff.abort();
    })();
  }

  #renderWindow(anchor: number, scrollIndex: number) {
    const size = this.#loops ? WINDOW_SIZE : Math.min(WINDOW_SIZE, this.#source.count);
    if (size === 0) return;
    const start = anchor - Math.floor(size / 2);
    const base = this.#loops ? start : Math.max(0, Math.min(start, this.#source.count - size));
    if (base === this.#base && this.#slides.size === size) return;
    for (const [index, slide] of this.#slides) {
      if (index >= base && index < base + size) continue;
      this.#unload(slide);
      slide.element.remove();
      this.#slides.delete(index);
    }
    let insertionPoint = this.element.firstChild;
    for (let index = base; index < base + size; index++) {
      let slide = this.#slides.get(index);
      if (!slide) {
        slide = this.#recycle(index) ?? this.#makeSlide(index);
        this.#slides.set(index, slide);
      }
      // Only a slide out of place moves: moving an embed reloads it.
      if (slide.element !== insertionPoint)
        this.element.insertBefore(slide.element, insertionPoint);
      insertionPoint = slide.element.nextSibling;
    }
    this.#rebasing = true;
    this.#base = base;
    this.#align(scrollIndex);
    cancelAnimationFrame(this.#rebaseFrame);
    this.#rebaseFrame = requestAnimationFrame(() => {
      this.#rebasing = false;
      this.#onScroll();
    });
    if (this.#mounted) this.#loadWindow();
  }

  #jump(index: number) {
    // A settle while a smooth selection glided can have moved the window off it.
    if (!this.#slides.has(index)) this.#renderWindow(index, index);
    this.#instantTarget = index;
    this.element.style.scrollSnapType = "none";
    this.#align(index);
    this.#sync(index, false);
    cancelAnimationFrame(this.#instantFrame);
    this.#instantFrame = requestAnimationFrame(this.#alignInstant);
  }

  #alignInstant = () => {
    const index = this.#instantTarget;
    if (index === null) return;
    const left = (index - this.#base) * this.#width;
    if (Math.abs(this.#left - left) > 1) {
      this.#scrollTo(left, "instant");
      this.#instantFrame = requestAnimationFrame(this.#alignInstant);
      return;
    }
    this.#endInstant();
  };

  #endInstant() {
    this.#instantTarget = null;
    cancelAnimationFrame(this.#instantFrame);
    this.#instantFrame = 0;
    this.element.style.removeProperty("scroll-snap-type");
  }

  #align(index: number) {
    if (!this.#width) return;
    // A fence on the previous side hides the slides before the current one.
    const first = this.#fence < 0 ? this.#index : this.#base;
    this.#scrollTo((index - first) * this.#width, "instant");
  }

  /**
   * Ask once the gesture starts toward a neighbour. A refusal hides the slides
   * on that side, so the rest of the gesture meets the scroller's native edge
   * and rubber-bands there. The slides come back when the gesture settles.
   */
  #askAhead() {
    const offset = this.#left - (this.#index - this.#base) * this.#width;
    const direction = offset > 2 ? 1 : offset < -2 ? -1 : 0;
    const target = this.#index + direction;
    if (!direction || (!this.#loops && (target < 0 || target >= this.#source.count))) return true;
    if (this.#ask(target)) return true;
    this.#fence = direction;
    for (const [index, slide] of this.#slides) {
      if (direction > 0 ? index > this.#index : index < this.#index) slide.element.hidden = true;
    }
    // Hiding the next slides clamps the scroller by itself. Hiding the
    // previous ones moves the current slide to the start.
    if (direction < 0) this.#align(this.#index);
    return false;
  }

  #ask(index: number) {
    if (index === this.#index || index === this.#approved) return true;
    if (index === this.#refused) return false;
    if (this.#allows(this.#item(index))) {
      this.#approved = index;
      return true;
    }
    this.#refused = index;
    return false;
  }

  #unfence() {
    if (!this.#fence) return;
    for (const slide of this.#slides.values()) slide.element.hidden = false;
    this.#fence = 0;
    this.#align(this.#index);
  }

  #sync(forcedIndex?: number, notify = true) {
    if (!this.#source.count) return;
    const left = this.#frozen ? this.#frozenLeft : this.#left;
    // Looping, the window's ends bound the position; else the gallery's do.
    const [first, last] = this.#loops
      ? [this.#base, this.#base + this.#slides.size - 1]
      : [0, this.#source.count - 1];
    const index =
      forcedIndex ??
      Math.max(first, Math.min(last, this.#base + Math.round(left / Math.max(1, this.#width))));
    if (index === this.#index) return;
    // A move the gesture could not ask about in time, such as a long fling.
    // The strip stays on the current slide and returns to it on settle.
    if (notify && !this.#ask(index)) return;
    const previous = this.#slides.get(this.#index);
    this.#present(previous, false);
    // A video left behind stops; one marked autoplay starts when it comes into view.
    if (previous?.image instanceof HTMLVideoElement) previous.image.pause();
    this.#index = index;
    this.#present(this.active, true);
    this.onZoomableChange?.();
    // An error a hidden slide raised was not heard; say it as the slide arrives.
    if (!this.active.error.hidden) this.#alert(this.active);
    this.#loadWindow();
    const media = this.active.drawn;
    const player = this.active.image;
    if (
      media?.type === "video" &&
      media.autoplay &&
      player instanceof HTMLVideoElement &&
      player.paused
    ) {
      void player.play().catch(() => {});
    }
    this.#activate();
    if (notify) this.#onSelect(this.#item(index), false);
  }

  /** The scale the zoom of the image on show rests at, while it is above fit. */
  #zoomed: { readonly index: number; readonly scale: number } | undefined;

  #loadWindow() {
    for (const [index, slide] of this.#slides) {
      // A slide that leaves gives back its zoom's sharper image.
      if (index !== this.#index) this.#blunt(index, slide);
      if (Math.abs(index - this.#index) <= LOAD_RADIUS) this.#load(index, slide);
      else this.#unload(slide);
    }
  }

  /**
   * Show the image on show sharper for a zoom resting at `scale`: once its
   * pixels on screen outnumber its candidate's, decode the smallest larger
   * candidate of the same source, or of the item's `zoom`, off screen,
   * then swap it in at the same size. The largest one caps it.
   */
  sharpen(scale: number) {
    const index = this.#index;
    if (this.zoomable()?.sharpen === false) return;
    // An image still loading sharpens once it shows; see #revealImage.
    this.#zoomed = { index, scale };
    const slide = this.#slides.get(index);
    const item = slide?.drawn;
    const image = slide?.image;
    if (
      !slide ||
      item?.type !== "image" ||
      !(image instanceof HTMLImageElement) ||
      !slide.fullApplied ||
      !this.#painted(image)
    )
      return;
    const base = this.#ownerDocument.baseURI;
    const shown = image.currentSrc;
    // The candidates of the source the browser chose, so a format it took stays.
    const sets = [
      ...[...(slide.picture?.querySelectorAll("source") ?? [])].map((source) => source.srcset),
      image.srcset,
    ].map(srcsetCandidates);
    const href = (src: string) => new URL(src, base).href;
    const chosen = sets.find((set) => set.some((each) => href(each.src) === shown)) ?? [];
    const current = chosen.find((each) => href(each.src) === shown)?.width || image.naturalWidth;
    const view = this.#ownerDocument.defaultView;
    const needed = image.offsetWidth * scale * (view?.devicePixelRatio ?? 1);
    const next = sharperCandidate(
      [
        ...chosen,
        ...srcsetCandidates(item.zoom?.srcset),
        ...(item.zoom?.src ? [{ src: item.zoom.src, width: Infinity }] : []),
      ],
      current,
      needed,
    );
    if (!next || href(next.src) === shown || next.src === slide.sharpened) return;
    slide.sharpening?.abort();
    const controller = new AbortController();
    slide.sharpening = controller;
    const version = slide.imageVersion;
    const loader = this.#ownerDocument.createElement("img");
    loader.src = next.src;
    void loader
      .decode()
      .then(() => {
        if (controller.signal.aborted || slide.imageVersion !== version) return;
        // The same size on screen: the candidate's density keeps the image's
        // natural size, which the slide's layout reads unzoomed.
        const width = image.naturalWidth;
        image.decoding = "sync";
        for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
        image.sizes = `${width}px`;
        image.srcset = `${next.src} ${loader.naturalWidth}w`;
        slide.sharpened = next.src;
      })
      .catch((error) => {
        // The slide keeps the image it has.
        if (controller.signal.aborted || slide.imageVersion !== version) return;
        this.onMediaError?.(this.#item(slide.position), "zoom", error);
      })
      .finally(() => {
        if (slide.sharpening === controller) slide.sharpening = undefined;
      });
  }

  /** Drop a slide's sharper zoom image, going back to its own sources. */
  #blunt(index: number, slide: ViewerSlide) {
    slide.sharpening?.abort();
    slide.sharpening = undefined;
    if (slide.sharpened && slide.loaded) this.#applyImage(index, slide);
    slide.sharpened = undefined;
  }

  #load(index: number, slide: ViewerSlide) {
    if (slide.custom && !slide.rendered) this.#render(index, slide);
    else this.#loadMedia(index, slide);
  }

  /** Start loading the slide's drawn media, or only reprioritise it once it is loading. */
  #loadMedia(index: number, slide: ViewerSlide) {
    const item = slide.drawn;
    if (!item) return;
    this.#loadPreview(item, slide);
    if (slide.loaded) {
      if (slide.image instanceof HTMLImageElement)
        slide.image.fetchPriority = index === this.#index ? "high" : "low";
      return;
    }
    this.#showError(slide, false);
    if (item.type === "image" && slide.image instanceof HTMLImageElement && slide.picture) {
      // Busy until the full image shows, or fails.
      this.#busy(slide, true);
      const current = slide.image.getAttribute("src");
      if (!current) {
        // Nothing paints yet, so the full image can stream straight in.
        this.#applyImage(index, slide);
      } else if (
        this.#painted(slide.image)
          ? this.#showsFull(slide.image, item)
          : !slide.image.complete && this.#showsFull(slide.image, item, slide.image.src)
      ) {
        // The preview is the full image. Rewriting the same source would make
        // Safari decode it again and paint nothing in between. It may still be
        // loading: an image in a <picture> never takes a cached source
        // synchronously (Firefox follows the specification here), and its load
        // reveals it. Until then its currentSrc is the previous source.
        slide.fullApplied = true;
        slide.image.loading = "eager";
        slide.image.fetchPriority = index === this.#index ? "high" : "low";
        if (this.#painted(slide.image)) this.#busy(slide, false);
        else void this.#revealImage(slide, slide.imageVersion);
      } else {
        const controller = new AbortController();
        // Decode the exact candidate the slide will pick before it swaps, so the
        // preview stays on screen until the sharper picture can paint at once.
        const loader = this.#stage(item, slide);
        loader.fetchPriority = index === this.#index ? "high" : "low";
        slide.controller = controller;
        const abort = () => {
          loader.removeAttribute("srcset");
          loader.src = "";
        };
        controller.signal.addEventListener("abort", abort, { once: true });
        void loader
          .decode()
          .then(() => {
            if (controller.signal.aborted) return;
            slide.decoded = true;
            // New items may have moved the slide while it decoded.
            this.#applyImage(slide.position, slide);
          })
          .catch((error) => {
            if (!controller.signal.aborted) this.#fail(slide, "image", error);
          })
          .finally(() => {
            controller.signal.removeEventListener("abort", abort);
            if (slide.controller === controller) slide.controller = undefined;
          });
      }
    } else if (!safeUrls(item)) {
      // Item lists reject these already; a list of your own still stops here.
      this.#fail(
        slide,
        item.type,
        new TypeError(`Fluidbox item ${idOf(item)} has a URL it doesn't load.`),
      );
    } else if (item.type === "video" && slide.image instanceof HTMLVideoElement) {
      this.#loadVideo(slide, item, slide.image);
      // Autoplay only on the slide in view: its neighbours load too.
      if (item.autoplay && index === this.#index) void slide.image.play().catch(() => {});
    } else if (item.type === "iframe" && slide.image instanceof HTMLIFrameElement) {
      const frame = this.#host(slide);
      const controller = new AbortController();
      slide.controller = controller;
      delete frame.dataset.fluidboxMediaReady;
      slide.image.addEventListener(
        "load",
        () => {
          // The load event fires before the embedded page's first paint.
          const view = this.#ownerDocument.defaultView;
          const timer = view?.setTimeout(() => (frame.dataset.fluidboxMediaReady = ""), 200);
          controller.signal.addEventListener("abort", () => view?.clearTimeout(timer));
        },
        { once: true, signal: controller.signal },
      );
      // Policy attributes apply to the navigation that src starts, so they go first.
      if (item.allow) slide.image.allow = item.allow;
      if (item.referrerPolicy) slide.image.referrerPolicy = item.referrerPolicy;
      slide.image.setAttribute("sandbox", item.sandbox ?? IFRAME_SANDBOX_DEFAULT);
      slide.image.src = item.src;
    }
    slide.loaded = true;
  }

  /**
   * Load a video: through `attach`, else from a `<source>` per entry of
   * `sources` and a last one for `src`, else from `src`. A `src` attribute
   * would make the browser ignore every `<source>`, so it gets none with them.
   */
  #loadVideo(slide: ViewerSlide, item: FluidboxVideoItem, video: HTMLVideoElement) {
    for (const source of video.querySelectorAll(":scope > source")) source.remove();
    if (item.poster) video.poster = item.poster;
    const { attach, slide: shown } = slide.videoOptions ?? {};
    if (!attach && !item.sources?.length) {
      video.src = item.src;
      return;
    }
    const controller = new AbortController();
    slide.controller = controller;
    if (attach) {
      try {
        attach(video, controller.signal, item, shown!);
      } catch (error) {
        console.error(error);
        this.#fail(slide, "video", error);
      }
      return;
    }
    // Sources go before the tracks, as the content model wants them.
    const tracks = video.querySelector(":scope > track");
    let last: HTMLSourceElement | undefined;
    for (const { src, type, media } of [...item.sources!, { src: item.src }] as const) {
      last = this.#ownerDocument.createElement("source");
      last.src = src;
      if (type) last.type = type;
      if (media) last.media = media;
      video.insertBefore(last, tracks);
    }
    // When every source fails, the error fires on the last one, not the video.
    last!.addEventListener("error", (event) => this.#fail(slide, "video", event), {
      signal: controller.signal,
    });
    // A fresh video picks its source as the first one goes in; one that failed
    // before, as on Retry, waits for load().
    if (video.networkState !== HTMLMediaElement.NETWORK_EMPTY) video.load();
  }

  /**
   * Run a custom slide's renderer: the slide of its type, else the default.
   * A type with neither shows the slide's error.
   */
  #render(index: number, slide: ViewerSlide) {
    const item = this.#source.getItem(this.#item(index));
    const renderer =
      this.#renderers[item.type] ?? (builtIn(item.type) ? undefined : this.#renderers.default);
    slide.rendered = true;
    if (!renderer) {
      // Development builds only; a page without a bundler has no process.
      try {
        if (process.env.NODE_ENV !== "production" && !unknownTypes.has(item.type)) {
          unknownTypes.add(item.type);
          console.warn(
            `Fluidbox has no slide for items of type "${item.type}". Add one to the slides option.`,
          );
        }
      } catch {}
      this.#fail(slide, "custom", new TypeError(`Fluidbox has no slide for "${item.type}" items.`));
      return;
    }
    const controller = new AbortController();
    // Unloading drops the activity, so its listeners are never called again.
    const activity = (slide.activity = {
      active: this.#mounted && !this.#hidden && index === this.#index,
      listeners: new Set<(active: boolean) => void>(),
    });
    slide.content = controller;
    const { signal } = controller;
    const zoomListeners = (slide.zoomListeners = new Set<(pose: FluidboxZoomPose) => void>());
    const layer = () => this.#layer(slide);
    // The item's index now: new items keep a slide whose item moved.
    const itemIndex = () => this.#item(slide.position);
    const waits = (slide.waits = new Set<Promise<void>>());
    let release!: () => void;
    slide.commit = new Promise<void>((resolve) => (release = resolve));
    slide.release = release;
    let holds = 0;
    let rendering = true;
    const opening = () => (this.#opening?.index === itemIndex() ? this.#opening : undefined);
    const origin = this.#originMedia?.index === itemIndex() ? this.#originMedia : undefined;
    if (origin) slide.originPlayback = slideOrigin(origin.video, origin.model);
    const closeListeners = (slide.closeListeners = new Set());
    const context: FluidboxSlide<any> & { [holdCommit]?: () => () => void } = {
      item,
      get index() {
        return itemIndex();
      },
      media: slide.media,
      get layer() {
        return layer();
      },
      signal,
      get active() {
        return activity.active;
      },
      get opening() {
        return opening()?.flying === false;
      },
      onActiveChange(listener: (active: boolean) => void) {
        activity.listeners.add(listener);
        return () => activity.listeners.delete(listener);
      },
      get origin() {
        return slide.originPlayback ?? null;
      },
      returnPlayback: (source: FluidboxPlaybackSource) =>
        signal.aborted ? () => {} : this.#returnPlayback(slide, source),
      onClose(listener: (landing: FluidboxSlideOrigin | null) => void) {
        if (signal.aborted) return () => {};
        closeListeners.add(listener);
        return () => closeListeners.delete(listener);
      },
      zoomable: (on) => {
        if (signal.aborted) return;
        slide.zoom = on === true ? {} : on;
        this.#zoomableChanged(slide);
      },
      onZoom: (listener: (pose: FluidboxZoomPose) => void) => {
        zoomListeners.add(listener);
        if (!this.#posing) this.#loadPosing();
        return () => zoomListeners.delete(listener);
      },
      waitUntil: (promise: Promise<unknown>) => {
        if (signal.aborted) return;
        // Development builds only; a page without a bundler has no process.
        try {
          if (process.env.NODE_ENV !== "production" && opening()?.flying) {
            console.warn(
              "Fluidbox got slide.waitUntil() after the opening flight started, so it doesn't delay it. Call it before the slide commits.",
            );
          }
        } catch {}
        const settled = Promise.resolve(promise).then(
          () => {},
          () => {},
        );
        waits.add(settled);
        void settled.then(() => waits.delete(settled));
      },
      // A binding holds the commit while its framework renders the slide, and
      // reports it once the content is in the box.
      [holdCommit]: () => {
        if (!rendering || signal.aborted) return () => {};
        holds += 1;
        let reported = false;
        return () => {
          if (reported) return;
          reported = true;
          if (--holds === 0) release();
        };
      },
      fail: (error?: unknown) => {
        if (signal.aborted) return;
        slide.failed = true;
        this.#fail(slide, "custom", error);
      },
      drawImage: (image?: FluidboxItem) => this.#draw(slide, signal, "image", image ?? item),
      drawVideo: (video?: FluidboxItem, options?: FluidboxVideoOptions) =>
        this.#draw(
          slide,
          signal,
          "video",
          video ?? item,
          options && { ...options, slide: context },
        ),
      drawIframe: (iframe?: FluidboxItem) => this.#draw(slide, signal, "iframe", iframe ?? item),
    };
    try {
      slide.dispose = renderer(context) ?? undefined;
    } finally {
      rendering = false;
      if (!holds) release();
    }
  }

  /**
   * Draw built-in media into a custom slide's box, in place of what it drew
   * before. Returns a function that takes it out again.
   */
  #draw(
    slide: ViewerSlide,
    signal: AbortSignal,
    type: DrawnItem["type"],
    item: FluidboxItem,
    videoOptions?: ViewerSlide["videoOptions"],
  ) {
    if (item.type !== type) {
      throw new TypeError(`Fluidbox draws ${type} items here, not "${item.type}" ones.`);
    }
    if (signal.aborted) return () => {};
    this.#undraw(slide);
    const drawing = new AbortController();
    Object.assign(slide, this.#build(item, slide.frame, slide.media), {
      drawn: item,
      drawing,
      videoOptions,
    });
    this.#wire(slide, drawing.signal);
    // The built-in video hands its time back as your own player would.
    if (slide.image instanceof HTMLVideoElement) {
      const unregister = this.#returnPlayback(slide, videoPlayback(slide.image));
      drawing.signal.addEventListener("abort", unregister, { once: true });
    }
    const origin = slide.origin;
    slide.origin = undefined;
    if (origin !== undefined) this.#paintOpening(slide, origin);
    this.#loadMedia(slide.position, slide);
    this.#zoomableChanged(slide);
    return () => {
      if (slide.drawing === drawing) this.#undraw(slide);
    };
  }

  /** Take a custom slide's drawn media out of its box. */
  #undraw(slide: ViewerSlide) {
    const drawing = slide.drawing;
    if (!drawing) return;
    this.#stopMedia(slide);
    this.#unloadMedia(slide);
    drawing.abort();
    for (const node of [
      slide.placeholder,
      slide.preview,
      slide.picture ?? slide.image,
      slide.cover,
    ])
      node?.remove();
    if (slide.drawn?.type === "image") delete slide.frame.dataset.fluidboxImageFrame;
    delete slide.media.dataset.fluidboxMediaReady;
    Object.assign(slide, {
      drawn: undefined,
      drawing: undefined,
      picture: undefined,
      placeholder: undefined,
      preview: undefined,
      cover: undefined,
      image: undefined,
      videoOptions: undefined,
    });
    this.#zoomableChanged(slide);
  }

  /**
   * The slide's layer: over the whole slide, beside its frame, so it doesn't
   * fly or zoom. It reveals and hides with the viewer's controls.
   */
  #layer(slide: ViewerSlide) {
    if (!slide.layer) {
      const layer = this.#ownerDocument.createElement("div");
      layer.dataset.fluidboxSlideLayer = "";
      layer.dataset.fluidboxChrome = "";
      slide.layer = layer;
    }
    if (!slide.layer.isConnected) slide.element.append(slide.layer);
    return slide.layer;
  }

  /** A slide's zoom may have changed: tell the viewer, if it is the slide on show. */
  #zoomableChanged(slide: ViewerSlide) {
    if (slide === this.current) this.onZoomableChange?.();
  }

  /** Stop the drawn media's work that outlives a load: a hand-off, a sharper image, a preview. */
  #stopMedia(slide: ViewerSlide) {
    slide.videoHandoff?.abort();
    slide.sharpening?.abort();
    slide.sharpening = undefined;
    slide.sharpened = undefined;
    slide.previewController?.abort();
    slide.previewController = undefined;
  }

  #unload(slide: ViewerSlide) {
    if (slide.loaded || slide.rendered) this.onUnload?.(slide.media);
    this.#stopMedia(slide);
    slide.origin = undefined;
    if (slide.rendered) {
      slide.content?.abort();
      slide.content = undefined;
      slide.dispose?.();
      slide.dispose = undefined;
      slide.activity = undefined;
      slide.zoomListeners = undefined;
      slide.closeListeners = undefined;
      // An open waiting for the slide goes on without it.
      slide.release?.();
      slide.release = undefined;
      slide.commit = undefined;
      slide.waits = undefined;
      slide.rendered = false;
      slide.failed = false;
      this.#undraw(slide);
      this.#showError(slide, false);
      this.#busy(slide, false);
      slide.media.replaceChildren();
      slide.layer?.replaceChildren();
      slide.layer?.remove();
      if (slide.zoom !== undefined) {
        slide.zoom = undefined;
        this.#zoomableChanged(slide);
      }
      return;
    }
    this.#unloadMedia(slide);
  }

  #unloadMedia(slide: ViewerSlide) {
    if (!slide.loaded) return;
    slide.controller?.abort();
    slide.controller = undefined;
    slide.decoded = false;
    slide.fullApplied = false;
    this.#showError(slide, false);
    this.#busy(slide, false);
    for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
    if (slide.image instanceof HTMLMediaElement) {
      slide.image.pause();
      // Without its sources, load() can't pick one again and keep downloading.
      for (const source of slide.image.querySelectorAll(":scope > source")) source.remove();
      slide.image.removeAttribute("src");
      slide.image.load();
    } else if (slide.image instanceof HTMLIFrameElement) {
      delete this.#host(slide).dataset.fluidboxMediaReady;
      slide.image.removeAttribute("src");
    } else if (slide.image instanceof HTMLImageElement) {
      slide.imageVersion += 1;
      slide.image.dataset.fluidboxImagePending = "";
      slide.image.removeAttribute("src");
      slide.image.removeAttribute("srcset");
      slide.image.removeAttribute("sizes");
    }
    slide.loaded = false;
  }

  /**
   * Tell custom content whether its slide is the one on show in a mounted strip:
   * the slide that leaves first, so its player stops before the next one starts.
   */
  #activate() {
    let entering: ViewerSlide["activity"];
    for (const [index, { activity }] of this.#slides) {
      const active = this.#mounted && !this.#hidden && index === this.#index;
      if (!activity || activity.active === active) continue;
      activity.active = active;
      if (active) entering = activity;
      else for (const listener of activity.listeners) listener(false);
    }
    if (entering) for (const listener of entering.listeners) listener(true);
  }

  #applyImage(index: number, slide: ViewerSlide) {
    const item = slide.drawn;
    if (item?.type !== "image" || !(slide.image instanceof HTMLImageElement) || !slide.picture)
      return;
    slide.imageVersion += 1;
    const version = slide.imageVersion;
    slide.fullApplied = true;
    slide.sharpened = undefined;
    // The full image decodes off the main thread. An image that already paints
    // a preview keeps it until the new source is ready; only an empty one hides.
    // A staged source is already decoded and swaps in on the next frame.
    slide.image.decoding = slide.decoded ? "sync" : "async";
    if (!this.#painted(slide.image)) slide.image.dataset.fluidboxImagePending = "";
    for (const source of slide.picture.querySelectorAll("source")) source.remove();
    slide.image.before(...this.#sources(item));
    this.#writeSet(slide.image, item, slide);
    // Neighboring images must begin loading before native scrolling exposes them.
    slide.image.loading = "eager";
    slide.image.fetchPriority = index === this.#index ? "high" : "low";
    slide.image.src = item.src;
    void this.#revealImage(slide, version);
    slide.decoded = false;
    this.#showError(slide, false);
  }

  #painted(image: HTMLImageElement) {
    return (
      image.dataset.fluidboxImagePending === undefined && image.complete && image.naturalWidth > 0
    );
  }

  /** Whether the image already shows the one candidate the full media resolves to. */
  #showsFull(image: HTMLImageElement, item: DrawnItem, shown = image.currentSrc || image.src) {
    if (item.type !== "image") return false;
    if (item.sources?.length || item.srcset) return false;
    const base = this.#ownerDocument.baseURI;
    return new URL(shown, base).href === new URL(item.src, base).href;
  }

  #writeSet(
    image: HTMLImageElement | HTMLSourceElement,
    resource: {
      readonly srcset?: string;
      readonly sizes?: string;
    },
    slide: ViewerSlide,
  ) {
    const set = resource.srcset;
    if (set) image.srcset = set;
    else image.removeAttribute("srcset");
    const sizes = resource.sizes;
    if (!sizes) image.removeAttribute("sizes");
    else if (image.isConnected || !/\bauto\b/.test(sizes)) image.sizes = sizes;
    // A detached copy has no layout for `sizes="auto"`; give it the slide's width.
    else image.sizes = `${Math.max(1, slide.frame.offsetWidth)}px`;
  }

  /** The item's `<source>` elements; a staged copy goes through #writeSet. */
  #sources(item: DrawnItem, staged?: ViewerSlide) {
    return (item.type === "image" ? (item.sources ?? []) : []).map((resource) => {
      const source = this.#ownerDocument.createElement("source");
      if (staged) this.#writeSet(source, resource, staged);
      else {
        source.srcset = resource.srcset ?? "";
        if (resource.sizes) source.sizes = resource.sizes;
      }
      if (resource.media) source.media = resource.media;
      if (resource.type) source.type = resource.type;
      return source;
    });
  }

  /** A detached copy of the slide's picture that loads the same candidate. */
  #stage(item: DrawnItem, slide: ViewerSlide) {
    const picture = this.#ownerDocument.createElement("picture");
    const image = this.#ownerDocument.createElement("img");
    if (item.type === "image") {
      picture.append(...this.#sources(item, slide));
      this.#writeSet(image, item, slide);
      image.src = item.src;
    }
    picture.append(image);
    return image;
  }

  #loadPreview(item: DrawnItem, slide: ViewerSlide) {
    const image = slide.preview;
    const src = item.thumbnail?.src;
    if (!image || !src || image.hasAttribute("data-fluidbox-image-ready")) return;
    if (slide.previewController) return;
    const controller = new AbortController();
    slide.previewController = controller;
    paintThumbnail(image, item.thumbnail!);
    void image
      .decode()
      .then(() => {
        if (!controller.signal.aborted) image.dataset.fluidboxImageReady = "";
      })
      .catch(() => {})
      .finally(() => {
        if (slide.previewController === controller) slide.previewController = undefined;
      });
  }

  async #revealImage(slide: ViewerSlide, version: number) {
    const image = slide.image;
    if (!(image instanceof HTMLImageElement)) return;
    try {
      await image.decode();
    } catch {
      return;
    }
    if (slide.imageVersion !== version) return;
    delete image.dataset.fluidboxImagePending;
    // The viewer frames an image by its item's width and height before it loads. A file of
    // another shape letterboxes inside that frame, and the close lands on its thumbnail
    // askew, so a shop feed with wrong sizes is worth hearing about.
    try {
      if (process.env.NODE_ENV !== "production") {
        const drawn = slide.drawn;
        const file = image.currentSrc || image.src;
        if (
          drawn?.type === "image" &&
          drawn.width &&
          drawn.height &&
          image.naturalWidth &&
          image.naturalHeight &&
          !misshapen.has(file) &&
          Math.abs(image.naturalWidth / image.naturalHeight / (drawn.width / drawn.height) - 1) >
            0.02
        ) {
          misshapen.add(file);
          console.warn(
            `Fluidbox: ${itemLabel(drawn)} declares ${drawn.width}×${drawn.height}, but ${file} is ${image.naturalWidth}×${image.naturalHeight}. The viewer frames the declared shape, so the image letterboxes and its close lands off the thumbnail. Give the item the file's width and height.`,
          );
        }
      }
    } catch {}
    if (slide.fullApplied) {
      this.#showError(slide, false);
      this.#busy(slide, false);
    }
    // Zoomed in before the full image came: sharpen it now.
    const zoomed = this.#zoomed;
    if (
      zoomed &&
      zoomed.scale > 1 &&
      zoomed.index === this.#index &&
      slide === this.#slides.get(zoomed.index)
    ) {
      this.sharpen(zoomed.scale);
    }
  }

  #retry(index: number) {
    const slide = this.#slides.get(index);
    if (!slide) return;
    // A custom slide with nothing drawn, or that failed itself, draws again from the start.
    if (slide.custom && (!slide.drawn || slide.failed)) this.#unload(slide);
    this.#reset(slide);
    this.#load(index, slide);
  }

  /** Drop a slide's load so the next #load starts it over. */
  #reset(slide: ViewerSlide) {
    slide.controller?.abort();
    slide.controller = undefined;
    slide.loaded = false;
    slide.decoded = false;
  }

  /** Mark the slide as loading its media, for assistive technology and for styling. */
  #busy(slide: ViewerSlide, on: boolean) {
    if (on) slide.element.setAttribute("aria-busy", "true");
    else slide.element.removeAttribute("aria-busy");
    slide.element.toggleAttribute("data-busy", on);
  }

  #showError(slide: ViewerSlide, on: boolean) {
    slide.error.hidden = !on;
    slide.element.toggleAttribute("data-error", on);
  }

  /** Load the slide on show again if it failed. False when it hadn't. */
  retry() {
    const slide = this.current;
    if (!slide || slide.error.hidden) return false;
    this.#retry(this.#index);
    return true;
  }

  /** Show the slide's error, and report it as it first shows. */
  #fail(slide: ViewerSlide, kind: FluidboxMediaErrorKind, cause: unknown) {
    this.#busy(slide, false);
    if (!slide.error.hidden) return;
    this.#showError(slide, true);
    this.onMediaError?.(this.#item(slide.position), kind, cause);
  }

  /** Fill the slide's alert again, so it is announced. */
  #alert(slide: ViewerSlide) {
    const message = slide.error.firstChild!;
    message.textContent = "";
    setTimeout(() => (message.textContent = `${this.#labels.error} `), 150);
  }

  #onScroll = () => {
    if (this.#frozen) {
      const offset = this.#left - this.#frozenLeft;
      this.element.style.setProperty("--fluidbox-scroll-compensation", `${this.#sign * offset}px`);
      return;
    }
    if (this.#instantTarget !== null) {
      const left = (this.#instantTarget - this.#base) * this.#width;
      if (Math.abs(this.#left - left) > 1) return;
      this.#endInstant();
    }
    if (this.#rebasing || !this.#width) return;
    if (!this.#userOwned && !this.#selection) return;
    if (this.#userOwned) this.#userScrolled = true;
    // Delayed events from an instant align are not navigation. Let only a
    // native gesture or a pending smooth selection derive an index from the
    // physical scroll position. The forced sync in #jump already made an
    // instant selection authoritative.
    if (!this.#fence && (!this.#userOwned || this.#askAhead())) {
      this.#sync(undefined, this.#userOwned);
    }
    if (this.#touching) clearTimeout(this.#settleTimer);
    else this.#scheduleSettle();
  };

  #scheduleSettle() {
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settled, 180);
  }

  #settled = () => {
    if (this.#touching || this.#frozen || this.#rebasing || this.#instantTarget !== null) return;
    // A finger or trackpad still pressing into a fence keeps it up.
    if (this.#fence && (this.#fingers || performance.now() - this.#lastWheel < 180)) {
      this.#scheduleSettle();
      return;
    }
    clearTimeout(this.#settleTimer);
    const refused = this.#refused !== null;
    this.#unfence();
    if (this.#userOwned || this.#selection) this.#sync(undefined, this.#userOwned);
    if (this.#userOwned && this.#userScrolled) this.#onSelect(this.index, true);
    this.#userOwned = false;
    this.#userScrolled = false;
    this.#approved = null;
    this.#refused = null;
    // A refused move the fence did not catch snapped to the neighbour. Go back.
    const left = (this.#index - this.#base) * this.#width;
    if (refused && Math.abs(this.#left - left) > 1) {
      this.#scrollTo(left, "smooth");
    }
    if (this.#selection?.index === this.#index) this.#resolveSelection();
    if (this.#index - this.#base < 8 || this.#index - this.#base >= this.#slides.size - 8) {
      this.#renderWindow(this.#index, this.#index);
    }
  };

  #resolveSelection() {
    if (!this.#selection) return;
    clearTimeout(this.#selection.timeout);
    this.#selection.resolve();
    this.#selection = undefined;
  }

  #takeControl = (event: Event) => {
    if (event.type === "wheel") this.#lastWheel = performance.now();
    if (event.type === "touchstart") this.#fingers = true;
    this.#userOwned = true;
    this.#userScrolled = false;
    this.#touching = event.type === "pointerdown" || event.type === "touchstart";
  };

  #releaseControl = (event: Event) => {
    if (event.type === "touchend" || event.type === "touchcancel") {
      this.#fingers = (event as TouchEvent).touches.length > 0;
    }
    this.#touching = false;
    // A browser taking over a native pan emits pointercancel before its
    // first scroll event. Keep ownership briefly so that the first scroll
    // event updates the selected slide.
    if (this.#userScrolled || event.type === "pointercancel") this.#scheduleSettle();
    else this.#userOwned = false;
  };
}
