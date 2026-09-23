export interface GalleryItem {
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

interface Slide {
  element: HTMLDivElement;
  frame: HTMLDivElement;
  image: HTMLElement;
  error: HTMLDivElement;
  request?: AbortController;
  ready: boolean;
  decoded?: HTMLImageElement;
}

/** Native scrolling owns movement; this class only selects and loads slides. */
export class GalleryStrip {
  readonly element = document.createElement("div");
  readonly items: GalleryItem[];
  readonly slides: Slide[];
  #index: number;
  #requestedIndex: number;
  #width = 0;
  #observer: ResizeObserver;
  #controller = new AbortController();
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #onChange: (index: number, settled: boolean) => void;
  #onProgress: (position: number) => void;
  #opening = true;
  #loaded = new Set<number>();
  #frozen = false;
  #frozenLeft = 0;

  constructor(
    items: GalleryItem[],
    index: number,
    onChange: (index: number, settled: boolean) => void,
    onProgress: (position: number) => void = () => {},
  ) {
    this.items = items;
    this.#index = this.#requestedIndex = index;
    this.#onChange = onChange;
    this.#onProgress = onProgress;
    this.element.dataset.lightboxSlides = "";
    this.element.setAttribute("aria-label", "Gallery items");
    this.slides = items.map((item, slideIndex) => {
      const element = document.createElement("div");
      element.dataset.lightboxSlide = "";
      element.setAttribute("role", "group");
      element.setAttribute("aria-label", `Item ${slideIndex + 1} of ${items.length}`);
      element.setAttribute("aria-hidden", String(slideIndex !== index));
      const frame = document.createElement("div");
      frame.dataset.lightboxFrame = "";
      item.mount?.();
      const image = item.content ?? new Image();
      image.toggleAttribute("data-lightbox-item-content", !!item.content);
      image.toggleAttribute("data-lightbox-media", !item.content);
      if (image instanceof HTMLImageElement) {
        image.alt = item.alt;
        image.draggable = false;
      }
      const thumbnail = item.thumbnail ?? item.preview;
      // Fixed geometry comes from the thumbnail metadata, not full-image downloads.
      if (thumbnail) {
        const width = Number(thumbnail.getAttribute("width")) || thumbnail.offsetWidth;
        const height = Number(thumbnail.getAttribute("height")) || thumbnail.offsetHeight;
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
      retry.addEventListener("click", () => this.#load(slideIndex), {
        signal: this.#controller.signal,
      });
      error.append(retry);
      frame.append(image, error);
      element.append(frame);
      this.element.append(element);
      return { element, frame, image, error, ready: false };
    });
    const { signal } = this.#controller;
    this.element.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.element.addEventListener("scrollend", this.#settled, { signal });
    this.#observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === this.#width) return;
      this.#width = entry.contentRect.width;
      this.element.scrollTo({ left: this.#index * this.#width, behavior: "instant" });
    });
  }

  mount() {
    this.#loadWindow();
    // One initial width read; resize entries supply all subsequent measurements.
    this.#width = this.element.clientWidth;
    this.element.scrollTo({ left: this.#index * this.#width, behavior: "instant" });
    this.#observer.observe(this.element);
  }

  get index() {
    return this.#index;
  }
  get active() {
    return this.slides[this.#index]!;
  }
  get item() {
    return this.items[this.#index]!;
  }
  get snapOffset() {
    return this.#frozen ? this.#frozenLeft - this.#index * this.#width : 0;
  }

  opened() {
    this.#opening = false;
    for (const index of this.#loaded) {
      const slide = this.slides[index]!;
      if (slide.decoded && slide.image instanceof HTMLImageElement) {
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
    this.element.scrollTo({
      left: this.#requestedIndex * this.#width,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  }

  select(index: number, smooth = false) {
    this.#requestedIndex = Math.max(0, Math.min(this.items.length - 1, index));
    this.element.scrollTo({
      left: this.#requestedIndex * this.#width,
      behavior: smooth ? "smooth" : "instant",
    });
    this.sync();
  }

  freeze() {
    if (this.#frozen) return;
    this.#frozenLeft = this.element.scrollLeft;
    this.#frozen = true;
    // Remove snapping and lock the viewport at the handoff point. Chrome can
    // still finish an already-running native animation; #onScroll compensates
    // that movement without changing which slide dismissal owns.
    this.element.dataset.lightboxFrozen = "";
    this.element.scrollTo({ left: this.#frozenLeft, behavior: "instant" });
  }

  resume() {
    if (!this.#frozen) return;
    // Restore the native viewport to the pose represented by the temporary
    // slide offsets, then swap the return transform for the selected snap point
    // in the same frame. #animate has already moved the image by snapOffset.
    this.element.scrollTo({ left: this.#frozenLeft, behavior: "instant" });
    this.element.style.removeProperty("--lightbox-scroll-compensation");
    this.#frozen = false;
    delete this.element.dataset.lightboxFrozen;
    this.#requestedIndex = this.#index;
    this.element.scrollTo({ left: this.#index * this.#width, behavior: "instant" });
  }

  sync() {
    if (!this.#width) return;
    // iOS can keep advancing the native scroll position briefly after overflow
    // is frozen. Selection belongs to the captured handoff position until the
    // dismissal either returns or closes; re-reading the live value here makes
    // rapid re-grabs alternate between adjacent slides.
    const left = this.#frozen ? this.#frozenLeft : this.element.scrollLeft;
    const index = Math.max(0, Math.min(this.items.length - 1, Math.round(left / this.#width)));
    if (index === this.#index) return;
    this.slides[this.#index]!.element.setAttribute("aria-hidden", "true");
    this.slides[this.#index]!.error.querySelector("button")!.tabIndex = -1;
    this.#index = index;
    this.active.element.setAttribute("aria-hidden", "false");
    this.active.error.querySelector("button")!.tabIndex = 0;
    this.#loadWindow();
    this.#onChange(index, false);
  }

  #onScroll = () => {
    if (this.#frozen) {
      // Chrome can finish an already-running native scroll animation after
      // overflow and scroll snapping are disabled. Counter that hidden scroll
      // on the slide layer so the pixels handed to dismissal stay stationary.
      const offset = this.element.scrollLeft - this.#frozenLeft;
      this.element.style.setProperty("--lightbox-scroll-compensation", `${offset}px`);
      return;
    }
    if (this.#width) this.#onProgress(this.element.scrollLeft / this.#width);
    this.sync();
    // Also announce on browsers without scrollend; correctness never depends on it.
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settled, 180);
  };

  #settled = () => {
    if (this.#opening || this.#frozen) return;
    clearTimeout(this.#settleTimer);
    this.sync();
    this.#requestedIndex = this.#index;
    this.#onChange(this.#index, true);
  };

  #loadWindow() {
    const radius = this.#opening ? 0 : 1;
    for (const index of this.#loaded) {
      if (Math.abs(index - this.#index) <= radius) continue;
      const slide = this.slides[index]!;
      slide.request?.abort();
      slide.request = undefined;
      slide.ready = false;
      slide.decoded = undefined;
      if (slide.image instanceof HTMLImageElement) slide.image.removeAttribute("src");
      slide.error.hidden = true;
      this.#loaded.delete(index);
    }
    for (
      let index = Math.max(0, this.#index - radius);
      index <= Math.min(this.slides.length - 1, this.#index + radius);
      index++
    ) {
      this.#loaded.add(index);
      this.#load(index);
    }
  }

  #load(index: number) {
    const slide = this.slides[index]!;
    if (slide.ready || slide.request) return;
    const item = this.items[index]!;
    if (item.content) {
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
    // Opening uses the already-visible thumbnail. A separate full-size decode
    // competes with its first paint, even when the request comes from cache.
    // opened() calls #loadWindow again once the transform has finished.
    if (this.#opening && preview && previewElement?.naturalWidth) return;
    const request = new AbortController();
    slide.request = request;
    // decode() keeps a half-decoded full image out of the visible slide.
    const image = new Image();
    image.src = item.src;
    const abort = () => {
      image.src = "";
    };
    request.signal.addEventListener("abort", abort, { once: true });
    void image
      .decode()
      .then(() => {
        if (request.signal.aborted) return;
        slide.ready = true;
        if (this.#opening) slide.decoded = image;
        else slideImage.src = item.src;
        // Keep known dimensions stable throughout swipes and the opening transition.
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
    clearTimeout(this.#settleTimer);
    for (const slide of this.slides) slide.request?.abort();
    for (const item of this.items) item.restore?.();
    this.element.remove();
  }
}
import { triggerLoad } from "unlazy";
