import type {
  LightboxDispose,
  LightboxImageCandidate,
  LightboxItem,
  LightboxRenderer,
  LightboxSource,
} from "./public-api";
import { observeDecodedPreview } from "./decoded-preview";

const WINDOW_SIZE = 31;
const LOAD_RADIUS = 1;

interface ViewerSlide {
  readonly element: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly picture?: HTMLPictureElement;
  readonly image: HTMLElement;
  readonly error: HTMLDivElement;
  loaded: boolean;
  opening: boolean;
  deferFull: boolean;
  decoded: boolean;
  controller?: AbortController;
  dispose?: LightboxDispose;
}

function candidateSet(candidates: readonly LightboxImageCandidate[] | undefined) {
  return candidates?.map((candidate) => `${candidate.src} ${candidate.width}w`).join(", ") ?? "";
}

/** Bounded native-scrolling gallery for the plain DOM runtime. */
export class ViewerStrip<TItem extends LightboxItem = LightboxItem> {
  readonly element: HTMLDivElement;
  readonly #ownerDocument: Document;
  readonly #slides = new Map<number, ViewerSlide>();
  readonly #observer: ResizeObserver;
  readonly #controller = new AbortController();
  readonly #onSelect: (index: number, settled: boolean) => void;
  readonly #renderers: Readonly<Record<string, LightboxRenderer<TItem>>>;
  #source: LightboxSource<TItem>;
  #index = 0;
  #base = 0;
  #width = 0;
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
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #selection:
    | { index: number; resolve: () => void; timeout: ReturnType<typeof setTimeout> }
    | undefined;

  constructor(
    ownerDocument: Document,
    source: LightboxSource<TItem>,
    onSelect: (index: number, settled: boolean) => void,
    renderers: Readonly<Record<string, LightboxRenderer<TItem>>> = {},
  ) {
    this.#ownerDocument = ownerDocument;
    this.#source = source;
    this.#onSelect = onSelect;
    this.#renderers = renderers;
    this.element = ownerDocument.createElement("div");
    this.element.dataset.lightboxSlides = "";
    this.element.setAttribute("aria-label", "Gallery items");
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

  get index() {
    return this.#index;
  }

  get active() {
    const slide = this.#slides.get(this.#index);
    if (!slide) throw new Error("The viewer source has no active image.");
    return slide;
  }

  get snapOffset() {
    return this.#frozen ? this.#frozenLeft - (this.#index - this.#base) * this.#width : 0;
  }

  setSource(source: LightboxSource<TItem>) {
    this.#resolveSelection();
    this.#source = source;
    this.#index = Math.max(0, Math.min(this.#index, source.count - 1));
    for (const slide of this.#slides.values()) {
      this.#unload(slide);
      slide.element.remove();
    }
    for (const slide of this.#slides.values()) this.#unload(slide);
    this.#slides.clear();
    this.#base = 0;
    this.#renderWindow(this.#index, this.#index);
    this.#align(this.#index);
  }

  mount() {
    if (!this.#mounted) {
      this.#mounted = true;
      this.#observer.observe(this.element);
    }
    this.#width = this.element.clientWidth;
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

  select(index: number, smooth: boolean): Promise<void> {
    if (!Number.isInteger(index) || index < 0 || index >= this.#source.count) {
      throw new RangeError(`Viewer strip index ${index} is out of range.`);
    }
    // A newer selection owns the strip. Cancel the previous smooth-scroll
    // fallback before rebasing its virtual window, otherwise that stale timer
    // can jump to a slide which has already been recycled.
    this.#resolveSelection();
    if (!this.#slides.has(index)) this.#renderWindow(index, smooth ? this.#index : index);
    if (!this.#mounted || !smooth || index === this.#index) {
      this.#jump(index);
      return Promise.resolve();
    }
    this.element.scrollTo({ left: (index - this.#base) * this.#width, behavior: "smooth" });
    return new Promise<void>((resolve) => {
      this.#selection = {
        index,
        resolve,
        timeout: setTimeout(() => {
          this.#jump(index);
          this.#resolveSelection();
        }, 600),
      };
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
    this.#frozenLeft = this.element.scrollLeft;
    this.#frozen = true;
    this.element.dataset.lightboxFrozen = "";
    this.element.scrollTo({ left: this.#frozenLeft, behavior: "instant" });
  }

  resume() {
    if (!this.#frozen) return;
    this.element.scrollTo({ left: this.#frozenLeft, behavior: "instant" });
    this.element.style.removeProperty("--lightbox-scroll-compensation");
    this.#frozen = false;
    delete this.element.dataset.lightboxFrozen;
    this.#align(this.#index);
  }

  #makeSlide(index: number) {
    const item = this.#source.getItem(index);
    const element = this.#ownerDocument.createElement("div");
    element.dataset.lightboxSlide = "";
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", `Item ${index + 1} of ${this.#source.count}`);
    element.setAttribute("aria-hidden", String(index !== this.#index));
    const frame = this.#ownerDocument.createElement("div");
    frame.dataset.lightboxFrame = "";
    frame.style.setProperty(
      "--lightbox-item-width",
      `min(100vw, calc(var(--lightbox-content-height, var(--lightbox-height, 100svh)) * ${item.media.width / item.media.height}))`,
    );
    frame.style.setProperty(
      "--lightbox-item-height",
      `min(${(item.media.height / item.media.width) * 100}vw, var(--lightbox-content-height, var(--lightbox-height, 100svh)))`,
    );
    const error = this.#ownerDocument.createElement("div");
    error.dataset.lightboxError = "";
    error.hidden = true;
    error.setAttribute("role", "alert");
    const retry = this.#ownerDocument.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => this.#retry(index));
    error.append("Unable to load media. ", retry);
    let picture: HTMLPictureElement | undefined;
    let media: HTMLElement;
    if (item.media.type === "image") {
      picture = this.#ownerDocument.createElement("picture");
      picture.dataset.lightboxPicture = "";
      picture.style.display = "contents";
      const image = this.#ownerDocument.createElement("img");
      image.alt = item.media.alt;
      image.width = item.media.width;
      image.height = item.media.height;
      image.decoding = "async";
      image.draggable = false;
      image.addEventListener(
        "load",
        () => {
          if (
            new URL(image.currentSrc || image.src, this.#ownerDocument.baseURI).href ===
            new URL(item.media.type === "image" ? item.media.src : "", this.#ownerDocument.baseURI)
              .href
          ) {
            error.hidden = true;
          }
        },
        { signal: this.#controller.signal },
      );
      image.addEventListener(
        "error",
        () => {
          error.hidden = false;
          retry.tabIndex = index === this.#index ? 0 : -1;
        },
        { signal: this.#controller.signal },
      );
      picture.append(image);
      frame.append(picture);
      media = image;
    } else if (item.media.type === "video") {
      const video = this.#ownerDocument.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", item.media.title);
      frame.append(video);
      media = video;
    } else if (item.media.type === "iframe") {
      const iframe = this.#ownerDocument.createElement("iframe");
      iframe.title = item.media.title;
      iframe.loading = "lazy";
      iframe.setAttribute("allowfullscreen", "");
      frame.append(iframe);
      media = iframe;
    } else {
      const content = this.#ownerDocument.createElement("div");
      content.dataset.lightboxItemContent = "";
      content.setAttribute("aria-label", item.media.title);
      frame.append(content);
      media = content;
    }
    media.dataset.lightboxMedia = "";
    media.style.setProperty(
      "--lightbox-media-aspect",
      `${item.media.width} / ${item.media.height}`,
    );
    frame.append(error);
    element.append(frame);
    return {
      element,
      frame,
      picture,
      image: media,
      error,
      loaded: false,
      opening: false,
      deferFull: false,
      decoded: false,
    } satisfies ViewerSlide;
  }

  prepareOpening(index: number, origin?: HTMLImageElement) {
    const slide = this.#slides.get(index);
    const item = this.#source.getItem(index);
    if (!slide || item.media.type !== "image" || !(slide.image instanceof HTMLImageElement)) return;
    slide.opening = true;
    const decodedPreview = origin ? observeDecodedPreview(origin) : null;
    const preview =
      decodedPreview ||
      item.preview?.src ||
      item.thumbnail?.src ||
      origin?.currentSrc ||
      origin?.src;
    if (preview) {
      for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
      slide.image.removeAttribute("srcset");
      slide.image.removeAttribute("sizes");
      slide.image.src = preview;
    }
    slide.controller?.abort();
    slide.controller = undefined;
    slide.loaded = false;
    slide.decoded = false;
    slide.deferFull = decodedPreview !== null;
    this.#load(index, slide);
  }

  completeOpening(index: number) {
    const slide = this.#slides.get(index);
    if (!slide) return;
    slide.opening = false;
    slide.deferFull = false;
    if (slide.decoded) this.#applyImage(index, slide);
    else this.#load(index, slide);
  }

  #renderWindow(anchor: number, scrollIndex: number) {
    const size = Math.min(WINDOW_SIZE, this.#source.count);
    if (size === 0) return;
    const base = Math.max(0, Math.min(anchor - Math.floor(size / 2), this.#source.count - size));
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
    if (Math.abs(this.element.scrollLeft - left) > 1) {
      this.element.scrollTo({ left, behavior: "instant" });
      this.#instantFrame = requestAnimationFrame(this.#alignInstant);
      return;
    }
    this.#instantTarget = null;
    this.#instantFrame = 0;
    this.element.style.removeProperty("scroll-snap-type");
  };

  #align(index: number) {
    if (!this.#width) return;
    this.element.scrollTo({ left: (index - this.#base) * this.#width, behavior: "instant" });
  }

  #sync(forcedIndex?: number, notify = true) {
    if (!this.#source.count) return;
    const left = this.#frozen ? this.#frozenLeft : this.element.scrollLeft;
    const index =
      forcedIndex ??
      Math.max(
        0,
        Math.min(this.#source.count - 1, this.#base + Math.round(left / Math.max(1, this.#width))),
      );
    if (index === this.#index) return;
    const previous = this.#slides.get(this.#index);
    previous?.element.setAttribute("aria-hidden", "true");
    const previousRetry = previous?.error.querySelector("button");
    if (previousRetry) previousRetry.tabIndex = -1;
    this.#index = index;
    this.active.element.setAttribute("aria-hidden", "false");
    const activeRetry = this.active.error.querySelector("button");
    if (activeRetry) activeRetry.tabIndex = 0;
    this.#loadWindow();
    if (notify) this.#onSelect(index, false);
  }

  #loadWindow() {
    for (const [index, slide] of this.#slides) {
      if (Math.abs(index - this.#index) <= LOAD_RADIUS) this.#load(index, slide);
      else this.#unload(slide);
    }
  }

  #load(index: number, slide: ViewerSlide) {
    if (slide.deferFull) return;
    if (slide.loaded) {
      if (slide.image instanceof HTMLImageElement)
        slide.image.fetchPriority = index === this.#index ? "high" : "low";
      return;
    }
    const item = this.#source.getItem(index);
    slide.error.hidden = true;
    if (item.media.type === "image" && slide.image instanceof HTMLImageElement && slide.picture) {
      const current = slide.image.getAttribute("src");
      const full = item.media.src;
      const alreadyFull =
        current &&
        new URL(current, this.#ownerDocument.baseURI).href ===
          new URL(full, this.#ownerDocument.baseURI).href;
      if (!current || alreadyFull) {
        this.#applyImage(index, slide);
      } else {
        const controller = new AbortController();
        const loader = new this.#ownerDocument.defaultView!.Image();
        slide.controller = controller;
        loader.src = item.media.src;
        const abort = () => (loader.src = "");
        controller.signal.addEventListener("abort", abort, { once: true });
        void loader
          .decode()
          .then(() => {
            if (controller.signal.aborted) return;
            slide.decoded = true;
            if (!slide.opening) this.#applyImage(index, slide);
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              slide.error.hidden = false;
              slide.error.querySelector("button")!.tabIndex = index === this.#index ? 0 : -1;
            }
          })
          .finally(() => {
            controller.signal.removeEventListener("abort", abort);
            if (slide.controller === controller) slide.controller = undefined;
          });
      }
    } else if (item.media.type === "video" && slide.image instanceof HTMLVideoElement) {
      slide.image.src = item.media.src;
      if (item.media.poster) slide.image.poster = item.media.poster.src;
    } else if (item.media.type === "iframe" && slide.image instanceof HTMLIFrameElement) {
      slide.image.src = item.media.src;
      if (item.media.allow) slide.image.allow = item.media.allow;
      if (item.media.referrerPolicy) slide.image.referrerPolicy = item.media.referrerPolicy;
      if (item.media.sandbox) slide.image.setAttribute("sandbox", item.media.sandbox);
    } else if (item.media.type === "custom") {
      const renderer = this.#renderers[item.media.renderer];
      if (!renderer) throw new TypeError(`Unknown lightbox renderer: ${item.media.renderer}`);
      const controller = new AbortController();
      slide.controller = controller;
      slide.dispose =
        renderer.mount({ item, index, target: slide.image, signal: controller.signal }) ??
        undefined;
    }
    slide.loaded = true;
  }

  #unload(slide: ViewerSlide) {
    if (!slide.loaded) return;
    slide.controller?.abort();
    slide.controller = undefined;
    slide.dispose?.();
    slide.dispose = undefined;
    slide.opening = false;
    slide.deferFull = false;
    slide.decoded = false;
    slide.error.hidden = true;
    for (const source of slide.picture?.querySelectorAll("source") ?? []) source.remove();
    if (slide.image instanceof HTMLMediaElement) {
      slide.image.pause();
      slide.image.removeAttribute("src");
      slide.image.load();
    } else if (slide.image instanceof HTMLIFrameElement) {
      slide.image.removeAttribute("src");
    } else if (slide.image instanceof HTMLImageElement) {
      slide.image.removeAttribute("src");
      slide.image.removeAttribute("srcset");
      slide.image.removeAttribute("sizes");
    } else {
      slide.image.replaceChildren();
    }
    slide.loaded = false;
  }

  #applyImage(index: number, slide: ViewerSlide) {
    const item = this.#source.getItem(index);
    if (item.media.type !== "image" || !(slide.image instanceof HTMLImageElement) || !slide.picture)
      return;
    for (const source of slide.picture.querySelectorAll("source")) source.remove();
    for (const resource of item.media.sources ?? []) {
      const source = this.#ownerDocument.createElement("source");
      source.srcset = candidateSet(resource.candidates);
      if (resource.sizes) source.sizes = resource.sizes;
      if (resource.media) source.media = resource.media;
      if (resource.type) source.type = resource.type;
      slide.picture.insertBefore(source, slide.image);
    }
    slide.image.srcset = candidateSet(item.media.candidates);
    if (item.media.sizes) slide.image.sizes = item.media.sizes;
    else slide.image.removeAttribute("sizes");
    slide.image.loading = index === this.#index ? "eager" : "lazy";
    slide.image.fetchPriority = index === this.#index ? "high" : "low";
    slide.image.src = item.media.src;
    slide.decoded = false;
    slide.error.hidden = true;
  }

  #retry(index: number) {
    const slide = this.#slides.get(index);
    if (!slide) return;
    slide.controller?.abort();
    slide.controller = undefined;
    slide.loaded = false;
    slide.decoded = false;
    this.#load(index, slide);
  }

  #onScroll = () => {
    if (this.#frozen) {
      const offset = this.element.scrollLeft - this.#frozenLeft;
      this.element.style.setProperty("--lightbox-scroll-compensation", `${offset}px`);
      return;
    }
    if (this.#instantTarget !== null) {
      const left = (this.#instantTarget - this.#base) * this.#width;
      if (Math.abs(this.element.scrollLeft - left) > 1) return;
      this.#instantTarget = null;
      cancelAnimationFrame(this.#instantFrame);
      this.#instantFrame = 0;
      this.element.style.removeProperty("scroll-snap-type");
    }
    if (this.#rebasing || !this.#width) return;
    if (this.#userOwned) this.#userScrolled = true;
    this.#sync(undefined, this.#userOwned);
    clearTimeout(this.#settleTimer);
    if (!this.#touching) this.#settleTimer = setTimeout(this.#settled, 180);
  };

  #settled = () => {
    if (this.#touching || this.#frozen || this.#rebasing || this.#instantTarget !== null) return;
    clearTimeout(this.#settleTimer);
    this.#sync(undefined, this.#userOwned);
    if (this.#userOwned) this.#onSelect(this.#index, true);
    this.#userOwned = false;
    this.#userScrolled = false;
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
    this.#userOwned = true;
    this.#userScrolled = false;
    this.#touching = event.type === "pointerdown" || event.type === "touchstart";
  };

  #releaseControl = () => {
    this.#touching = false;
    if (!this.#userScrolled) {
      this.#userOwned = false;
      return;
    }
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settled, 180);
  };
}
