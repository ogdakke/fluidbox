import { asGalleryItemSource, type GalleryItem, type GalleryItemSource } from "./gallery-strip";

type SelectCallback = (index: number, settled: boolean) => void;
type ScrollMode = "idle" | "commanded" | "user";

/** A fixed-size, scrollable thumbnail window. The DOM cost depends on viewport width. */
export class FilmstripSession {
  readonly element = document.createElement("div");
  readonly scroller = document.createElement("div");
  readonly track = document.createElement("div");
  readonly items: GalleryItemSource;
  #visible = new Map<number, HTMLButtonElement>();
  #requests = new Map<number, AbortController>();
  #first = -1;
  #last = -1;
  #index: number;
  #onSelect: SelectCallback;
  #controller = new AbortController();
  #observer: ResizeObserver;
  #scrollFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #scrollMode: ScrollMode = "idle";
  #commandedLeft: number | null = null;
  #touching = false;
  #initializing = true;
  #mountFrame = 0;
  #size = 52;
  #step = 57;
  #padding = 0;
  #viewportWidth = 0;

  constructor(items: GalleryItem[] | GalleryItemSource, index: number, onSelect: SelectCallback) {
    this.items = asGalleryItemSource(items);
    this.#index = index;
    this.#onSelect = onSelect;
    this.element.dataset.lightboxFilmstrip = "";
    this.element.setAttribute("aria-label", "Gallery filmstrip");
    this.scroller.dataset.lightboxFilmstripScroll = "";
    this.scroller.setAttribute("role", "listbox");
    this.scroller.setAttribute("aria-label", "Choose a gallery item");
    this.track.dataset.lightboxFilmstripTrack = "";
    this.scroller.append(this.track);
    this.element.append(this.scroller);
    const { signal } = this.#controller;
    this.scroller.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.scroller.addEventListener("scrollend", this.#onSettled, { signal });
    this.scroller.addEventListener("touchstart", this.#onTouchStart, { passive: true, signal });
    for (const type of ["touchend", "touchcancel"] as const) {
      this.scroller.addEventListener(type, this.#onTouchEnd, { passive: true, signal });
    }
    for (const type of ["pointerdown", "keydown"] as const) {
      this.scroller.addEventListener(type, this.#takeControl, {
        capture: true,
        passive: true,
        signal,
      });
    }
    this.scroller.addEventListener("wheel", this.#onWheel, {
      capture: true,
      passive: false,
      signal,
    });
    this.#observer = new ResizeObserver(() => {
      const oldStep = this.#step;
      const oldWidth = this.#viewportWidth;
      this.#readGeometry();
      if (oldStep !== this.#step || oldWidth !== this.#viewportWidth) {
        this.#renderWindow(this.#index, true);
        if (this.#scrollMode !== "user") this.#center(this.#index, false);
      }
    });
  }

  #readGeometry() {
    this.#viewportWidth = this.scroller.clientWidth;
    const scrollerStyle = getComputedStyle(this.scroller);
    const elementStyle = getComputedStyle(this.element);
    this.#size = parseFloat(elementStyle.getPropertyValue("--lightbox-filmstrip-item-size")) || 52;
    this.#step = this.#size + (parseFloat(scrollerStyle.columnGap) || 0);
    this.#padding = parseFloat(scrollerStyle.paddingLeft) || 0;
    this.track.style.width = `${Math.max(0, this.items.length * this.#step - (this.#step - this.#size))}px`;
  }

  #thumbnailSource(item: GalleryItem) {
    const source =
      item.thumbnailSrc || item.src || item.thumbnail?.dataset.src || item.thumbnail?.currentSrc;
    if (source && /^\/media\/[^?#]+\.webp(?:[?#].*)?$/.test(source)) {
      return source.replace(/(?:-\d+w)?\.webp(?=(?:[?#].*)?$)/, "-160w.webp");
    }
    return (
      item.thumbnail?.dataset.src ||
      item.thumbnail?.currentSrc ||
      item.thumbnail?.src ||
      source ||
      ""
    );
  }

  #thumbnailFallback(item: GalleryItem) {
    return (
      item.thumbnailSrc || item.thumbnail?.dataset.src || item.src || item.thumbnail?.currentSrc
    );
  }

  async #loadThumbnail(
    target: HTMLImageElement,
    source: string | undefined,
    fallback: string | undefined,
    signal: AbortSignal,
  ) {
    for (const candidate of new Set([source, fallback])) {
      if (!candidate || signal.aborted) continue;
      const loader = new Image();
      loader.src = candidate;
      signal.addEventListener("abort", () => (loader.src = ""), { once: true });
      try {
        await loader.decode();
        if (!signal.aborted) target.src = candidate;
        return;
      } catch {
        // Keep showing the placeholder while the next source is tried.
      }
    }
  }

  #makeButton(index: number) {
    const item = this.items.get(index);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lightboxFilmstripItem = "";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", item.alt || `Item ${index + 1}`);
    button.setAttribute("aria-posinset", String(index + 1));
    button.setAttribute("aria-setsize", String(this.items.length));
    button.style.left = `${index * this.#step}px`;
    const image = new Image();
    image.alt = "";
    image.draggable = false;
    image.dataset.lightboxFilmstripThumbnail = "";
    const source = this.#thumbnailSource(item);
    const fallback = this.#thumbnailFallback(item);
    image.src = item.thumbnail?.src || source || fallback || "";
    const request = new AbortController();
    this.#requests.set(index, request);
    void this.#loadThumbnail(image, source, fallback, request.signal);
    button.append(image);
    button.addEventListener("click", () => {
      this.#select(index, false);
      this.scrollTo(index, false);
    });
    this.#paintButton(button, index === this.#index);
    return button;
  }

  #renderWindow(center: number, force = false) {
    const radius = Math.ceil((this.scroller.clientWidth || 800) / this.#step) + 4;
    const first = Math.max(0, center - radius);
    const last = Math.min(this.items.length - 1, center + radius);
    if (!force && first === this.#first && last === this.#last) return;
    this.#first = first;
    this.#last = last;
    for (const [index, request] of this.#requests) {
      if (index >= first && index <= last && !force) continue;
      request.abort();
      this.#requests.delete(index);
    }
    const previous = this.#visible;
    for (const [index, button] of previous) {
      if (!force && index >= first && index <= last) continue;
      button.remove();
    }
    this.#visible = new Map();
    let insertionPoint = this.track.firstChild;
    for (let index = first; index <= last; index++) {
      const existing = force ? undefined : previous.get(index);
      const button = existing ?? this.#makeButton(index);
      button.style.left = `${index * this.#step}px`;
      if (!existing) this.track.insertBefore(button, insertionPoint);
      else insertionPoint = button.nextSibling;
      this.#visible.set(index, button);
    }
  }

  #paintButton(button: HTMLButtonElement, selected: boolean) {
    button.setAttribute("aria-selected", String(selected));
    button.toggleAttribute("data-lightbox-selected", selected);
    button.tabIndex = selected ? 0 : -1;
  }

  #paintSelection(previous = -1) {
    const old = this.#visible.get(previous);
    if (old) this.#paintButton(old, false);
    const current = this.#visible.get(this.#index);
    if (current) this.#paintButton(current, true);
  }

  mount(index = this.#index) {
    this.#index = index;
    this.#readGeometry();
    this.#renderWindow(index);
    this.#scrollMode = "commanded";
    this.#center(index, false);
    this.#observer.observe(this.scroller);
    this.#mountFrame = requestAnimationFrame(() => {
      this.#readGeometry();
      this.#renderWindow(index, true);
      this.#center(index, false);
      this.#mountFrame = requestAnimationFrame(() => {
        this.#mountFrame = 0;
      });
    });
  }

  activate(index = this.#index) {
    const previous = this.#index;
    this.#index = index;
    this.#renderWindow(index);
    this.#paintSelection(previous);
    this.#center(index, false);
    this.#mountFrame = requestAnimationFrame(() => {
      this.#initializing = false;
      this.#scrollMode = "idle";
      this.#mountFrame = 0;
    });
  }

  sync(index: number, center = true, smooth = false) {
    if (this.#initializing || index === this.#index) return;
    const previous = this.#index;
    this.#index = index;
    this.#renderWindow(index);
    this.#paintSelection(previous);
    if (center) this.scrollTo(index, smooth);
  }

  get controlling() {
    return this.#scrollMode === "user";
  }

  settle(index: number) {
    if (this.#initializing) return;
    const previous = this.#index;
    this.#index = index;
    this.#renderWindow(index);
    this.#paintSelection(previous);
  }

  scrollTo(index: number, smooth: boolean) {
    this.#scrollMode = "commanded";
    this.#renderWindow(index);
    this.#center(index, smooth);
  }

  #center(index: number, smooth: boolean) {
    const left =
      this.#padding + index * this.#step + this.#size / 2 - this.scroller.clientWidth / 2;
    this.#commandedLeft = Math.max(
      0,
      Math.min(left, this.scroller.scrollWidth - this.scroller.clientWidth),
    );
    this.#scrollMode = "commanded";
    this.scroller.scrollTo({ left: this.#commandedLeft, behavior: smooth ? "smooth" : "instant" });
  }

  #nearestIndex() {
    const center = this.scroller.scrollLeft + this.scroller.clientWidth / 2;
    return Math.max(
      0,
      Math.min(
        this.items.length - 1,
        Math.round((center - this.#padding - this.#size / 2) / this.#step),
      ),
    );
  }

  #onScroll = () => {
    this.#renderWindow(this.#nearestIndex());
    if (this.#touching || this.#scrollMode === "idle") this.#takeControl();
    this.#queueSelection();
    this.#scheduleSettle();
  };

  #scheduleSettle() {
    clearTimeout(this.#settleTimer);
    if (!this.#touching) this.#settleTimer = setTimeout(this.#onSettled, 160);
  }

  #queueSelection() {
    if (this.#initializing || this.#scrollMode !== "user" || this.#scrollFrame) return;
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0;
      if (this.#scrollMode === "user") this.#select(this.#nearestIndex(), false);
    });
  }

  #onSettled = () => {
    clearTimeout(this.#settleTimer);
    if (this.#initializing || this.#touching) return;
    if (this.#scrollMode === "commanded") {
      // Some engines fire scrollend between frames of a smooth scroll. Keep
      // programmatic centering from becoming a user selection until it arrives.
      if (Math.abs(this.scroller.scrollLeft - (this.#commandedLeft ?? 0)) > 1) {
        this.#scheduleSettle();
        return;
      }
      this.#commandedLeft = null;
      this.#scrollMode = "idle";
      return;
    }
    if (this.#scrollMode !== "user") return;
    cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = 0;
    this.#select(this.#nearestIndex(), false);
    this.#onSelect(this.#index, true);
    this.#scrollMode = "idle";
  };

  #onTouchStart = () => {
    this.#touching = true;
    clearTimeout(this.#settleTimer);
    this.#takeControl();
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length) return;
    this.#touching = false;
    this.#scheduleSettle();
  };

  #takeControl = () => {
    this.#commandedLeft = null;
    this.#scrollMode = "user";
  };

  #onWheel = (event: WheelEvent) => {
    this.#takeControl();
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && event.cancelable) event.preventDefault();
  };

  #select(index: number, settled: boolean) {
    if (index === this.#index) {
      if (settled) this.#onSelect(index, true);
      return;
    }
    const previous = this.#index;
    this.#index = index;
    this.#renderWindow(index);
    this.#paintSelection(previous);
    this.#onSelect(index, settled);
  }

  destroy() {
    this.#controller.abort();
    this.#observer.disconnect();
    for (const request of this.#requests.values()) request.abort();
    this.#requests.clear();
    cancelAnimationFrame(this.#scrollFrame);
    cancelAnimationFrame(this.#mountFrame);
    clearTimeout(this.#settleTimer);
    this.element.remove();
  }
}

/** Opt-in marker for a gallery's lightbox filmstrip. */
export class AppFilmstrip extends HTMLElement {
  connectedCallback() {
    this.hidden = true;
  }

  createSession(items: GalleryItem[] | GalleryItemSource, index: number, onSelect: SelectCallback) {
    return new FilmstripSession(items, index, onSelect);
  }
}

if (!customElements.get("app-filmstrip")) {
  customElements.define("app-filmstrip", AppFilmstrip);
}
