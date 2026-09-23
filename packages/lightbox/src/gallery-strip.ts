import { triggerLoad } from "unlazy";

export interface GalleryItem {
  id?: string;
  width?: number;
  height?: number;
  thumbnailSrc?: string;
  trigger: HTMLElement;
  preview: HTMLElement | null;
  thumbnail: HTMLImageElement | null;
  openingPreview?: HTMLImageElement | null;
  previewSrc?: string;
  src: string;
  alt: string;
  content?: HTMLElement;
  mount?: () => void;
  restore?: () => void;
}

export interface GalleryItemSource {
  readonly length: number;
  get(index: number): GalleryItem;
}

export function asGalleryItemSource(items: GalleryItem[] | GalleryItemSource): GalleryItemSource {
  return Array.isArray(items) ? { length: items.length, get: (index) => items[index]! } : items;
}

interface Slide {
  element: HTMLDivElement;
  frame: HTMLDivElement;
  image: HTMLElement;
  error: HTMLDivElement;
  request?: AbortController;
  ready: boolean;
  decoded?: HTMLImageElement;
}

const WINDOW_SIZE = 31;

/** Native scrolling owns movement; the visible track and media loads stay bounded. */
export class GalleryStrip {
  readonly element = document.createElement("div");
  readonly items: GalleryItemSource;
  readonly slides = new Map<number, Slide>();
  #base = 0;
  #index: number;
  #requestedIndex: number;
  #width = 0;
  #observer: ResizeObserver;
  #controller = new AbortController();
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #rebaseFrame = 0;
  #rebasing = false;
  #instantTarget: number | null = null;
  #instantFrame = 0;
  #onChange: (index: number, settled: boolean) => void;
  #onProgress: (position: number) => void;
  #opening = true;
  #loaded = new Set<number>();
  #frozen = false;
  #frozenLeft = 0;

  constructor(
    items: GalleryItem[] | GalleryItemSource,
    index: number,
    onChange: (index: number, settled: boolean) => void,
    onProgress: (position: number) => void = () => {},
  ) {
    this.items = asGalleryItemSource(items);
    this.#index = this.#requestedIndex = index;
    this.#onChange = onChange;
    this.#onProgress = onProgress;
    this.element.dataset.lightboxSlides = "";
    this.element.setAttribute("aria-label", "Gallery items");
    this.#renderWindow(index, index);
    const { signal } = this.#controller;
    this.element.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.element.addEventListener("scrollend", this.#settled, { signal });
    this.#observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === this.#width) return;
      this.#width = entry.contentRect.width;
      this.element.scrollTo({
        left: (this.#index - this.#base) * this.#width,
        behavior: "instant",
      });
    });
  }

  #makeSlide(index: number): Slide {
    const item = this.items.get(index);
    const element = document.createElement("div");
    element.dataset.lightboxSlide = "";
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", `Item ${index + 1} of ${this.items.length}`);
    element.setAttribute("aria-hidden", String(index !== this.#index));
    const frame = document.createElement("div");
    frame.dataset.lightboxFrame = "";
    const mountedContent = !!item.content && index === this.#index;
    if (mountedContent) item.mount?.();
    const image = item.content
      ? mountedContent
        ? item.content
        : document.createElement("div")
      : new Image();
    image.toggleAttribute("data-lightbox-item-content", mountedContent);
    image.toggleAttribute("data-lightbox-item-placeholder", !!item.content && !mountedContent);
    image.toggleAttribute("data-lightbox-media", !item.content);
    if (image instanceof HTMLImageElement) {
      image.alt = item.alt;
      image.draggable = false;
    }
    const thumbnail = item.thumbnail ?? item.preview;
    if (thumbnail || (item.width && item.height)) {
      const width =
        item.width || Number(thumbnail?.getAttribute("width")) || thumbnail?.offsetWidth || 0;
      const height =
        item.height || Number(thumbnail?.getAttribute("height")) || thumbnail?.offsetHeight || 0;
      if (image instanceof HTMLImageElement) {
        image.width = width;
        image.height = height;
      }
      if (width && height) {
        const ratio = width / height;
        image.style.setProperty(
          "--lightbox-item-width",
          `min(100vw, calc(var(--lightbox-content-height, var(--lightbox-height, 100svh)) * ${ratio}))`,
        );
        image.style.setProperty(
          "--lightbox-item-height",
          `min(${100 / ratio}vw, var(--lightbox-content-height, var(--lightbox-height, 100svh)))`,
        );
      }
    }
    const error = document.createElement("div");
    error.dataset.lightboxError = "";
    error.hidden = true;
    error.append("This image could not be loaded. ");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.tabIndex = index === this.#index ? 0 : -1;
    retry.addEventListener("click", () => this.#load(index), { signal: this.#controller.signal });
    error.append(retry);
    frame.append(image, error);
    element.append(frame);
    return { element, frame, image, error, ready: false };
  }

  #renderWindow(anchor: number, scrollIndex: number) {
    const size = Math.min(WINDOW_SIZE, this.items.length);
    const base = Math.max(0, Math.min(anchor - Math.floor(size / 2), this.items.length - size));
    if (base === this.#base && this.slides.size === size) return;
    for (const [index, slide] of this.slides) {
      if (index >= base && index < base + size) continue;
      slide.request?.abort();
      this.#loaded.delete(index);
      if (slide.image.hasAttribute("data-lightbox-item-content")) this.items.get(index).restore?.();
      slide.element.remove();
      this.slides.delete(index);
    }
    let insertionPoint = this.element.firstChild;
    for (let index = base; index < base + size; index++) {
      let slide = this.slides.get(index);
      if (!slide) {
        slide = this.#makeSlide(index);
        this.slides.set(index, slide);
        this.element.insertBefore(slide.element, insertionPoint);
      } else {
        insertionPoint = slide.element.nextSibling;
      }
    }
    this.#rebasing = true;
    this.#base = base;
    if (this.#width) {
      this.element.scrollTo({ left: (scrollIndex - base) * this.#width, behavior: "instant" });
    }
    cancelAnimationFrame(this.#rebaseFrame);
    this.#rebaseFrame = requestAnimationFrame(() => {
      this.#rebasing = false;
      // A commanded scroll can finish while rebase events are suppressed.
      // Read its final position even if the browser emits no later scroll event.
      this.#onScroll();
    });
  }

  mount() {
    this.#loadWindow();
    this.#width = this.element.clientWidth;
    this.element.scrollTo({ left: (this.#index - this.#base) * this.#width, behavior: "instant" });
    this.#observer.observe(this.element);
  }

  get index() {
    return this.#index;
  }
  get active() {
    return this.slides.get(this.#index)!;
  }
  get item() {
    return this.items.get(this.#index);
  }
  get snapOffset() {
    return this.#frozen ? this.#frozenLeft - (this.#index - this.#base) * this.#width : 0;
  }

  opened() {
    this.#opening = false;
    for (const index of this.#loaded) {
      const slide = this.slides.get(index);
      if (slide?.decoded && slide.image instanceof HTMLImageElement) {
        slide.image.src = slide.decoded.src;
        slide.decoded = undefined;
      }
    }
    this.#loadWindow();
    this.#onChange(this.#index, true);
  }

  navigate(direction: -1 | 1, reducedMotion: boolean) {
    this.#requestedIndex = Math.max(
      0,
      Math.min(this.items.length - 1, this.#requestedIndex + direction),
    );
    if (!this.slides.has(this.#requestedIndex))
      this.#renderWindow(this.#requestedIndex, this.#index);
    if (reducedMotion) this.#jumpTo(this.#requestedIndex);
    else {
      if (this.#instantTarget !== null) {
        this.element.scrollTo({
          left: (this.#instantTarget - this.#base) * this.#width,
          behavior: "instant",
        });
        this.#finishInstant();
      }
      this.element.scrollTo({
        left: (this.#requestedIndex - this.#base) * this.#width,
        behavior: "smooth",
      });
    }
  }

  select(index: number, smooth = false) {
    this.#requestedIndex = Math.max(0, Math.min(this.items.length - 1, index));
    if (!this.slides.has(this.#requestedIndex))
      this.#renderWindow(this.#requestedIndex, this.#requestedIndex);
    if (!smooth) this.#jumpTo(this.#requestedIndex);
    else {
      this.element.scrollTo({
        left: (this.#requestedIndex - this.#base) * this.#width,
        behavior: "smooth",
      });
      this.sync();
    }
  }

  #jumpTo(index: number) {
    // WebKit can report the old scrollLeft until after an instant scroll event.
    // Keep the requested item authoritative while the native track catches up.
    this.#instantTarget = index;
    this.element.style.scrollSnapType = "none";
    this.element.scrollTo({ left: (index - this.#base) * this.#width, behavior: "instant" });
    this.sync(index);
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
    } else {
      this.#finishInstant();
    }
  };

  #finishInstant() {
    this.#instantTarget = null;
    cancelAnimationFrame(this.#instantFrame);
    this.#instantFrame = 0;
    this.element.style.removeProperty("scroll-snap-type");
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
    this.#requestedIndex = this.#index;
    this.element.scrollTo({ left: (this.#index - this.#base) * this.#width, behavior: "instant" });
  }

  sync(forcedIndex?: number) {
    if (!this.#width) return;
    const left = this.#frozen ? this.#frozenLeft : this.element.scrollLeft;
    const index =
      forcedIndex ??
      Math.max(0, Math.min(this.items.length - 1, this.#base + Math.round(left / this.#width)));
    if (index === this.#index) return;
    const previous = this.slides.get(this.#index);
    previous?.element.setAttribute("aria-hidden", "true");
    if (previous) previous.error.querySelector("button")!.tabIndex = -1;
    this.#index = index;
    this.active.element.setAttribute("aria-hidden", "false");
    this.active.error.querySelector("button")!.tabIndex = 0;
    this.#loadWindow();
    this.#onChange(index, false);
  }

  #onScroll = () => {
    if (this.#frozen) {
      const offset = this.element.scrollLeft - this.#frozenLeft;
      this.element.style.setProperty("--lightbox-scroll-compensation", `${offset}px`);
      return;
    }
    if (this.#instantTarget !== null) {
      const targetLeft = (this.#instantTarget - this.#base) * this.#width;
      if (Math.abs(this.element.scrollLeft - targetLeft) > 1) return;
      this.#finishInstant();
    }
    if (this.#rebasing) return;
    if (this.#width) this.#onProgress(this.#base + this.element.scrollLeft / this.#width);
    this.sync();
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settled, 180);
  };

  #settled = () => {
    if (this.#opening || this.#frozen || this.#rebasing || this.#instantTarget !== null) return;
    clearTimeout(this.#settleTimer);
    this.sync();
    this.#requestedIndex = this.#index;
    this.#onChange(this.#index, true);
    if (this.#index - this.#base < 8 || this.#index - this.#base >= this.slides.size - 8) {
      this.#renderWindow(this.#index, this.#index);
      this.#loadWindow();
    }
  };

  #loadWindow() {
    const radius = this.#opening ? 0 : 1;
    for (const index of this.#loaded) {
      if (Math.abs(index - this.#index) <= radius) continue;
      const slide = this.slides.get(index);
      slide?.request?.abort();
      if (slide) {
        const item = this.items.get(index);
        if (item.content && slide.image === item.content) {
          item.restore?.();
          const placeholder = document.createElement("div");
          placeholder.dataset.lightboxItemPlaceholder = "";
          slide.frame.prepend(placeholder);
          slide.image = placeholder;
        }
        slide.request = undefined;
        slide.ready = false;
        slide.decoded = undefined;
        if (slide.image instanceof HTMLImageElement) slide.image.removeAttribute("src");
        slide.error.hidden = true;
      }
      this.#loaded.delete(index);
    }
    for (
      let index = Math.max(0, this.#index - radius);
      index <= Math.min(this.items.length - 1, this.#index + radius);
      index++
    ) {
      if (!this.slides.has(index)) continue;
      this.#loaded.add(index);
      this.#load(index);
    }
  }

  #load(index: number) {
    const slide = this.slides.get(index);
    if (!slide || slide.ready || slide.request) return;
    const item = this.items.get(index);
    if (item.content) {
      if (slide.image !== item.content) {
        item.mount?.();
        slide.image.replaceWith(item.content);
        slide.image = item.content;
        item.content.dataset.lightboxItemContent = "";
      }
      for (const image of item.content.querySelectorAll<HTMLImageElement>("img[data-src]")) {
        triggerLoad(image);
      }
      slide.ready = true;
      return;
    }
    if (!(slide.image instanceof HTMLImageElement)) return;
    const slideImage = slide.image;
    slide.error.hidden = true;
    const previewElement = item.openingPreview ?? item.thumbnail;
    const preview =
      (item.openingPreview ? "" : item.previewSrc) ||
      previewElement?.currentSrc ||
      previewElement?.src;
    if (preview) slideImage.src = preview;
    if (
      preview &&
      previewElement?.complete &&
      previewElement.naturalWidth &&
      new URL(preview, document.baseURI).href === new URL(item.src, document.baseURI).href
    ) {
      slide.ready = true;
      return;
    }
    if (this.#opening && preview && previewElement?.naturalWidth) return;
    const request = new AbortController();
    slide.request = request;
    const image = new Image();
    image.src = item.src;
    const abort = () => (image.src = "");
    request.signal.addEventListener("abort", abort, { once: true });
    void image
      .decode()
      .then(() => {
        if (request.signal.aborted) return;
        slide.ready = true;
        if (this.#opening) slide.decoded = image;
        else slideImage.src = item.src;
        if (!slideImage.width || !slideImage.height) {
          slideImage.width = image.naturalWidth;
          slideImage.height = image.naturalHeight;
        }
      })
      .catch(() => {
        if (!request.signal.aborted) {
          slide.error.hidden = false;
          slide.error.querySelector("button")!.tabIndex = index === this.#index ? 0 : -1;
        }
      })
      .finally(() => {
        request.signal.removeEventListener("abort", abort);
        if (slide.request === request) slide.request = undefined;
      });
  }

  destroy() {
    this.#controller.abort();
    this.#observer.disconnect();
    cancelAnimationFrame(this.#rebaseFrame);
    cancelAnimationFrame(this.#instantFrame);
    this.element.style.removeProperty("scroll-snap-type");
    clearTimeout(this.#settleTimer);
    for (const [index, slide] of this.slides) {
      slide.request?.abort();
      if (slide.image.hasAttribute("data-lightbox-item-content")) this.items.get(index).restore?.();
    }
    this.slides.clear();
    this.element.remove();
  }
}
