import type {
  FluidboxDispose,
  FluidboxItem,
  FluidboxRenderer,
  FluidboxSource,
} from "./runtime-types";
import { observeDecodedPreview } from "./decoded-preview";
import type { FluidboxLabels } from "./labels";
import type { FluidboxThumbnail } from "./public-api";

const WINDOW_SIZE = 31;
const LOAD_RADIUS = 1;

interface ViewerSlide {
  readonly element: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly picture?: HTMLPictureElement;
  readonly placeholder?: HTMLImageElement;
  readonly preview?: HTMLImageElement;
  /** Snapshot shown over embedded media until it has loaded, and while closing. */
  readonly cover?: HTMLImageElement;
  readonly image: HTMLElement;
  readonly error: HTMLDivElement;
  readonly retry: HTMLButtonElement;
  loaded: boolean;
  opening: boolean;
  deferFull: boolean;
  decoded: boolean;
  fullApplied: boolean;
  imageVersion: number;
  previewController?: AbortController;
  controller?: AbortController;
  /** A playing origin's picture, shown until the slide's player catches up with it. */
  videoHandoff?: AbortController;
  dispose?: FluidboxDispose;
}

/** Point an image at a thumbnail, its srcset and sizes included. */
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
  readonly #renderers: Readonly<Record<string, FluidboxRenderer<TItem>>>;
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

  constructor(
    ownerDocument: Document,
    source: FluidboxSource<TItem>,
    onSelect: (index: number, settled: boolean) => void,
    allows: (index: number) => boolean,
    renderers: Readonly<Record<string, FluidboxRenderer<TItem>>>,
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
    this.element.setAttribute("aria-label", labels.slides);
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

  /** The item on show. */
  get index() {
    return this.#item(this.#index);
  }

  get active() {
    const slide = this.#slides.get(this.#index);
    if (!slide) throw new Error("The viewer source has no active image.");
    return slide;
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

  setSource(source: FluidboxSource<TItem>) {
    this.#resolveSelection();
    this.#unfence();
    const index = this.index;
    this.#source = source;
    this.#index = Math.max(0, Math.min(index, source.count - 1));
    for (const slide of this.#slides.values()) {
      this.#unload(slide);
      slide.element.remove();
    }
    this.#slides.clear();
    this.#base = 0;
    this.#renderWindow(this.#index, this.#index);
    this.#align(this.#index);
  }

  /** Go round, or stop at the ends. The slides are made again around the item on show. */
  setLoop(loop: boolean) {
    if (loop === this.#loop) return;
    const index = this.index;
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
  }

  unmount() {
    if (!this.#mounted) return;
    this.#mounted = false;
    this.#observer.disconnect();
    this.#resolveSelection();
    for (const slide of this.#slides.values()) {
      slide.opening = false;
      slide.deferFull = false;
      this.#unload(slide);
    }
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
    this.element.setAttribute("aria-label", this.#labels.slides);
    for (const [index, slide] of this.#slides) {
      slide.element.setAttribute(
        "aria-label",
        this.#labels.position(this.#item(index), this.#source.count),
      );
      slide.retry.textContent = this.#labels.retry;
      slide.error.firstChild!.textContent = `${this.#labels.error} `;
    }
  }

  #makeSlide(index: number) {
    const item = this.#source.getItem(this.#item(index));
    const element = this.#ownerDocument.createElement("div");
    element.dataset.fluidboxSlide = "";
    element.setAttribute("role", "group");
    element.setAttribute(
      "aria-label",
      this.#labels.position(this.#item(index), this.#source.count),
    );
    element.setAttribute("aria-hidden", String(index !== this.#index));
    const frame = this.#ownerDocument.createElement("div");
    frame.dataset.fluidboxFrame = "";
    // Size against the slide (a size container), never the viewport: 100vw
    // includes a desktop scrollbar and can differ by a fraction on iOS, which
    // left the image a sliver wider or narrower than its slide.
    frame.style.setProperty(
      "--fluidbox-item-width",
      `min(100cqw, calc(var(--fluidbox-content-height, var(--fluidbox-height, 100svh)) * ${item.width / item.height}))`,
    );
    frame.style.setProperty(
      "--fluidbox-item-height",
      `min(${(item.height / item.width) * 100}cqw, var(--fluidbox-content-height, var(--fluidbox-height, 100svh)))`,
    );
    const error = this.#ownerDocument.createElement("div");
    error.dataset.fluidboxError = "";
    error.hidden = true;
    error.setAttribute("role", "alert");
    const retry = this.#ownerDocument.createElement("button");
    retry.type = "button";
    retry.textContent = this.#labels.retry;
    retry.addEventListener("click", () => this.#retry(index));
    error.append(`${this.#labels.error} `, retry);
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
    if (item.type === "img") {
      frame.dataset.fluidboxImageFrame = "";
      if (item.placeholder) {
        placeholder = decorative("fluidboxSlidePlaceholder");
        placeholder.src = item.placeholder;
        frame.append(placeholder);
      }
      if (item.thumbnail?.src) {
        // A preview is small and usually already decoded for the page; paint it
        // on the first frame it appears in.
        preview = decorative("fluidboxSlidePreview");
        frame.append(preview);
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
      image.addEventListener(
        "load",
        () => {
          void this.#revealImage(slide, slide.imageVersion);
        },
        { signal: this.#controller.signal },
      );
      image.addEventListener("error", () => this.#fail(index, slide), {
        signal: this.#controller.signal,
      });
      picture.append(image);
      frame.append(picture);
      media = image;
    } else if (item.type === "video") {
      const video = this.#ownerDocument.createElement("video");
      video.controls = item.controls ?? true;
      video.playsInline = item.playsInline ?? true;
      video.preload = item.preload ?? "metadata";
      video.loop = item.loop ?? false;
      video.muted = item.muted ?? false;
      video.setAttribute("aria-label", item.title);
      frame.append(video);
      media = video;
    } else if (item.type === "iframe") {
      const iframe = this.#ownerDocument.createElement("iframe");
      iframe.title = item.title;
      iframe.loading = "lazy";
      iframe.setAttribute("allowfullscreen", "");
      frame.append(iframe);
      media = iframe;
      cover = decorative("fluidboxMediaCover");
      if (item.thumbnail) paintThumbnail(cover, item.thumbnail);
      frame.append(cover);
    } else {
      const content = this.#ownerDocument.createElement("div");
      content.dataset.fluidboxItemContent = "";
      content.setAttribute("aria-label", item.title);
      frame.append(content);
      media = content;
    }
    media.dataset.fluidboxMedia = "";
    media.style.setProperty("--fluidbox-media-aspect", `${item.width} / ${item.height}`);
    frame.append(error);
    element.append(frame);
    const slide = {
      element,
      frame,
      picture,
      placeholder,
      preview,
      cover,
      image: media,
      error,
      retry,
      loaded: false,
      opening: false,
      deferFull: false,
      decoded: false,
      fullApplied: false,
      imageVersion: 0,
    } satisfies ViewerSlide;
    return slide;
  }

  prepareOpening(index: number, origin?: HTMLImageElement) {
    const position = this.#near(index);
    const slide = this.#slides.get(position);
    const item = this.#source.getItem(index);
    if (slide?.cover) {
      // Embedded pages paint long after the opening motion starts. The origin's
      // snapshot covers the frame until the embed reports that it has loaded.
      if (item.thumbnail) paintThumbnail(slide.cover, item.thumbnail);
      else {
        const src = origin?.currentSrc || origin?.src;
        if (src) slide.cover.src = src;
      }
      return;
    }
    if (!slide || item.type !== "img" || !(slide.image instanceof HTMLImageElement)) return;
    slide.opening = true;
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
    this.#reset(slide);
    slide.fullApplied = false;
    slide.deferFull = decodedPreview !== null;
    this.#load(position, slide);
  }

  /**
   * Continue an origin video's playback in the slide. Until the player has
   * caught up, a canvas keeps painting the origin's own frames, so the opening
   * starts on the frame the card shows and the picture never stops moving.
   */
  continueVideo(index: number, origin: HTMLVideoElement) {
    const slide = this.#slides.get(this.#near(index));
    const item = this.#source.getItem(index);
    const video = slide?.image;
    if (!slide || item.type !== "video" || !(video instanceof HTMLVideoElement)) return;
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

  completeOpening(item: number) {
    const index = this.#near(item);
    const slide = this.#slides.get(index);
    if (!slide) return;
    slide.opening = false;
    slide.deferFull = false;
    if (slide.decoded) this.#applyImage(index, slide);
    else this.#load(index, slide);
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
        slide = this.#makeSlide(index);
        this.#slides.set(index, slide);
        this.element.insertBefore(slide.element, insertionPoint);
      } else {
        insertionPoint = slide.element.nextSibling;
      }
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
    previous?.element.setAttribute("aria-hidden", "true");
    // A video left behind stops; one marked autoplay starts when it comes into view.
    if (previous?.image instanceof HTMLVideoElement) previous.image.pause();
    if (previous) previous.retry.tabIndex = -1;
    this.#index = index;
    this.active.element.setAttribute("aria-hidden", "false");
    this.active.retry.tabIndex = 0;
    this.#loadWindow();
    const media = this.#source.getItem(this.#item(index));
    const player = this.active.image;
    if (
      media.type === "video" &&
      media.autoplay &&
      player instanceof HTMLVideoElement &&
      player.paused
    ) {
      void player.play().catch(() => {});
    }
    if (notify) this.#onSelect(this.#item(index), false);
  }

  #loadWindow() {
    for (const [index, slide] of this.#slides) {
      if (Math.abs(index - this.#index) <= LOAD_RADIUS) this.#load(index, slide);
      else this.#unload(slide);
    }
  }

  #load(index: number, slide: ViewerSlide) {
    const item = this.#source.getItem(this.#item(index));
    this.#loadPreview(item, slide);
    if (slide.deferFull) return;
    if (slide.loaded) {
      if (slide.image instanceof HTMLImageElement)
        slide.image.fetchPriority = index === this.#index ? "high" : "low";
      return;
    }
    slide.error.hidden = true;
    if (item.type === "img" && slide.image instanceof HTMLImageElement && slide.picture) {
      const current = slide.image.getAttribute("src");
      if (!current) {
        // Nothing paints yet, so the full image can stream straight in.
        this.#applyImage(index, slide);
      } else if (this.#painted(slide.image) && this.#showsFull(slide.image, item)) {
        // The preview is the full image. Rewriting the same source would make
        // Safari decode it again and paint nothing in between.
        slide.fullApplied = true;
        slide.image.loading = "eager";
        slide.image.fetchPriority = index === this.#index ? "high" : "low";
      } else {
        const controller = new AbortController();
        // Decode the exact candidate the slide will pick before it swaps, so the
        // preview stays on screen until the sharper picture can paint at once.
        const loader = this.#stage(item, slide);
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
            if (!slide.opening) this.#applyImage(index, slide);
          })
          .catch(() => {
            if (!controller.signal.aborted) this.#fail(index, slide);
          })
          .finally(() => {
            controller.signal.removeEventListener("abort", abort);
            if (slide.controller === controller) slide.controller = undefined;
          });
      }
    } else if (item.type === "video" && slide.image instanceof HTMLVideoElement) {
      slide.image.src = item.src;
      if (item.poster) slide.image.poster = item.poster;
      // Autoplay only on the slide in view: its neighbours load too.
      if (item.autoplay && index === this.#index) void slide.image.play().catch(() => {});
    } else if (item.type === "iframe" && slide.image instanceof HTMLIFrameElement) {
      const frame = slide.frame;
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
      if (item.sandbox !== undefined) slide.image.setAttribute("sandbox", item.sandbox);
      slide.image.src = item.src;
    } else if (item.type === "custom") {
      const renderer = this.#renderers[item.render];
      if (!renderer) throw new TypeError(`Unknown fluidbox renderer: ${item.render}`);
      const controller = new AbortController();
      slide.controller = controller;
      slide.dispose =
        renderer({
          item,
          index: this.#item(index),
          target: slide.image,
          signal: controller.signal,
        }) ?? undefined;
    }
    slide.loaded = true;
  }

  #unload(slide: ViewerSlide) {
    slide.videoHandoff?.abort();
    slide.previewController?.abort();
    slide.previewController = undefined;
    if (!slide.loaded) return;
    slide.controller?.abort();
    slide.controller = undefined;
    slide.dispose?.();
    slide.dispose = undefined;
    slide.opening = false;
    slide.deferFull = false;
    slide.decoded = false;
    slide.fullApplied = false;
    slide.error.hidden = true;
    for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
    if (slide.image instanceof HTMLMediaElement) {
      slide.image.pause();
      slide.image.removeAttribute("src");
      slide.image.load();
    } else if (slide.image instanceof HTMLIFrameElement) {
      delete slide.frame.dataset.fluidboxMediaReady;
      slide.image.removeAttribute("src");
    } else if (slide.image instanceof HTMLImageElement) {
      slide.imageVersion += 1;
      slide.image.dataset.fluidboxImagePending = "";
      slide.image.removeAttribute("src");
      slide.image.removeAttribute("srcset");
      slide.image.removeAttribute("sizes");
    } else {
      slide.image.replaceChildren();
    }
    slide.loaded = false;
  }

  #applyImage(index: number, slide: ViewerSlide) {
    const item = this.#source.getItem(this.#item(index));
    if (item.type !== "img" || !(slide.image instanceof HTMLImageElement) || !slide.picture) return;
    slide.imageVersion += 1;
    const version = slide.imageVersion;
    slide.fullApplied = true;
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
    slide.error.hidden = true;
  }

  #painted(image: HTMLImageElement) {
    return (
      image.dataset.fluidboxImagePending === undefined && image.complete && image.naturalWidth > 0
    );
  }

  /** Whether the image already shows the one candidate the full media resolves to. */
  #showsFull(image: HTMLImageElement, item: TItem) {
    if (item.type !== "img") return false;
    if (item.sources?.length || item.srcset) return false;
    const base = this.#ownerDocument.baseURI;
    return new URL(image.currentSrc || image.src, base).href === new URL(item.src, base).href;
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
  #sources(item: TItem, staged?: ViewerSlide) {
    return (item.type === "img" ? (item.sources ?? []) : []).map((resource) => {
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
  #stage(item: TItem, slide: ViewerSlide) {
    const picture = this.#ownerDocument.createElement("picture");
    const image = this.#ownerDocument.createElement("img");
    if (item.type === "img") {
      picture.append(...this.#sources(item, slide));
      this.#writeSet(image, item, slide);
      image.src = item.src;
    }
    picture.append(image);
    return image;
  }

  #loadPreview(item: TItem, slide: ViewerSlide) {
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
    if (slide.fullApplied) slide.error.hidden = true;
  }

  #retry(index: number) {
    const slide = this.#slides.get(index);
    if (!slide) return;
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

  #fail(index: number, slide: ViewerSlide) {
    slide.error.hidden = false;
    slide.retry.tabIndex = index === this.#index ? 0 : -1;
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
