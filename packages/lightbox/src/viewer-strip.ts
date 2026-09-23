import type {
  LightboxImageCandidate,
  LightboxImageMedia,
  LightboxItem,
  LightboxSource,
} from "./public-api";

const WINDOW_SIZE = 31;
const LOAD_RADIUS = 1;

interface ViewerSlide {
  readonly element: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly picture: HTMLPictureElement;
  readonly image: HTMLImageElement;
  loaded: boolean;
}

function isImageItem(item: LightboxItem): item is LightboxItem<LightboxImageMedia> {
  return item.media.type === "image";
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
  readonly #onSelect: (index: number) => void;
  #source: LightboxSource<TItem>;
  #index = 0;
  #base = 0;
  #width = 0;
  #mounted = false;
  #rebasing = false;
  #rebaseFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #selection:
    | { index: number; resolve: () => void; timeout: ReturnType<typeof setTimeout> }
    | undefined;

  constructor(
    ownerDocument: Document,
    source: LightboxSource<TItem>,
    onSelect: (index: number) => void,
  ) {
    this.#ownerDocument = ownerDocument;
    this.#source = source;
    this.#onSelect = onSelect;
    this.element = ownerDocument.createElement("div");
    this.element.dataset.lightboxSlides = "";
    this.element.setAttribute("aria-label", "Gallery items");
    this.#renderWindow(0, 0);
    const { signal } = this.#controller;
    this.element.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.element.addEventListener("scrollend", this.#settled, { signal });
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

  setSource(source: LightboxSource<TItem>) {
    this.#resolveSelection();
    this.#source = source;
    this.#index = Math.max(0, Math.min(this.#index, source.count - 1));
    for (const slide of this.#slides.values()) slide.element.remove();
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

  select(index: number, smooth: boolean): Promise<void> {
    if (!Number.isInteger(index) || index < 0 || index >= this.#source.count) {
      throw new RangeError(`Viewer strip index ${index} is out of range.`);
    }
    if (!this.#slides.has(index)) this.#renderWindow(index, smooth ? this.#index : index);
    if (!this.#mounted || !smooth || index === this.#index) {
      this.#jump(index);
      return Promise.resolve();
    }
    this.#resolveSelection();
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
    clearTimeout(this.#settleTimer);
    this.#resolveSelection();
    this.#slides.clear();
    this.element.remove();
  }

  #makeSlide(index: number) {
    const item = this.#source.getItem(index);
    if (!isImageItem(item)) {
      throw new TypeError(`The plain DOM gallery does not yet support ${item.media.type}.`);
    }
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
    const picture = this.#ownerDocument.createElement("picture");
    picture.dataset.lightboxPicture = "";
    picture.style.display = "contents";
    const image = this.#ownerDocument.createElement("img");
    image.dataset.lightboxMedia = "";
    image.alt = item.media.alt;
    image.width = item.media.width;
    image.height = item.media.height;
    image.decoding = "async";
    image.draggable = false;
    image.style.setProperty(
      "--lightbox-media-aspect",
      `${item.media.width} / ${item.media.height}`,
    );
    picture.append(image);
    frame.append(picture);
    element.append(frame);
    return { element, frame, picture, image, loaded: false } satisfies ViewerSlide;
  }

  #renderWindow(anchor: number, scrollIndex: number) {
    const size = Math.min(WINDOW_SIZE, this.#source.count);
    if (size === 0) return;
    const base = Math.max(0, Math.min(anchor - Math.floor(size / 2), this.#source.count - size));
    if (base === this.#base && this.#slides.size === size) return;
    for (const [index, slide] of this.#slides) {
      if (index >= base && index < base + size) continue;
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
    this.#loadWindow();
  }

  #jump(index: number) {
    this.element.style.scrollSnapType = "none";
    this.#align(index);
    this.#sync(index);
    requestAnimationFrame(() => this.element.style.removeProperty("scroll-snap-type"));
  }

  #align(index: number) {
    if (!this.#width) return;
    this.element.scrollTo({ left: (index - this.#base) * this.#width, behavior: "instant" });
  }

  #sync(forcedIndex?: number) {
    if (!this.#source.count) return;
    const index =
      forcedIndex ??
      Math.max(
        0,
        Math.min(
          this.#source.count - 1,
          this.#base + Math.round(this.element.scrollLeft / Math.max(1, this.#width)),
        ),
      );
    if (index === this.#index) return;
    this.#slides.get(this.#index)?.element.setAttribute("aria-hidden", "true");
    this.#index = index;
    this.active.element.setAttribute("aria-hidden", "false");
    this.#loadWindow();
    this.#onSelect(index);
  }

  #loadWindow() {
    for (const [index, slide] of this.#slides) {
      if (Math.abs(index - this.#index) <= LOAD_RADIUS) this.#load(index, slide);
      else this.#unload(slide);
    }
  }

  #load(index: number, slide: ViewerSlide) {
    if (slide.loaded) {
      slide.image.fetchPriority = index === this.#index ? "high" : "low";
      return;
    }
    const item = this.#source.getItem(index);
    if (!isImageItem(item)) return;
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
    slide.image.loading = index === this.#index ? "eager" : "lazy";
    slide.image.fetchPriority = index === this.#index ? "high" : "low";
    slide.image.src = item.media.src;
    slide.loaded = true;
  }

  #unload(slide: ViewerSlide) {
    if (!slide.loaded) return;
    for (const source of slide.picture.querySelectorAll("source")) source.remove();
    slide.image.removeAttribute("src");
    slide.image.removeAttribute("srcset");
    slide.image.removeAttribute("sizes");
    slide.loaded = false;
  }

  #onScroll = () => {
    if (this.#rebasing || !this.#width) return;
    this.#sync();
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#settled, 180);
  };

  #settled = () => {
    if (this.#rebasing) return;
    clearTimeout(this.#settleTimer);
    this.#sync();
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
}
