import type { GalleryItem } from "./gallery-strip";

type SelectCallback = (index: number, settled: boolean) => void;
type ScrollMode = "idle" | "commanded" | "user";

export class FilmstripSession {
  readonly element = document.createElement("div");
  readonly scroller = document.createElement("div");
  readonly items: HTMLButtonElement[];
  #index: number;
  #onSelect: SelectCallback;
  #controller = new AbortController();
  #scrollFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;
  #scrollMode: ScrollMode = "idle";
  #touching = false;
  #initializing = true;
  #mountFrame = 0;

  constructor(items: GalleryItem[], index: number, onSelect: SelectCallback) {
    this.#index = index;
    this.#onSelect = onSelect;
    this.element.dataset.lightboxFilmstrip = "";
    this.element.setAttribute("aria-label", "Gallery filmstrip");
    this.scroller.dataset.lightboxFilmstripScroll = "";
    this.scroller.setAttribute("role", "listbox");
    this.scroller.setAttribute("aria-label", "Choose a gallery item");
    this.items = items.map((item, itemIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lightboxFilmstripItem = "";
      button.dataset.index = String(itemIndex);
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", item.alt || `Item ${itemIndex + 1}`);
      const image = new Image();
      image.alt = "";
      image.draggable = false;
      image.dataset.lightboxFilmstripThumbnail = "";
      const source = this.#thumbnailSource(item);
      const fallback = this.#thumbnailFallback(item);
      const placeholder = item.thumbnail?.src;
      image.src = placeholder || source || fallback || "";
      void this.#loadThumbnail(image, source, fallback);
      button.append(image);
      button.addEventListener(
        "click",
        () => {
          this.#select(itemIndex, false);
          this.scrollTo(itemIndex, false);
        },
        { signal: this.#controller.signal },
      );
      this.scroller.append(button);
      return button;
    });
    this.element.append(this.scroller);
    this.scroller.addEventListener("scroll", this.#onScroll, {
      passive: true,
      signal: this.#controller.signal,
    });
    this.scroller.addEventListener("scrollend", this.#onSettled, {
      signal: this.#controller.signal,
    });
    this.scroller.addEventListener("touchstart", this.#onTouchStart, {
      passive: true,
      signal: this.#controller.signal,
    });
    for (const type of ["touchend", "touchcancel"] as const) {
      this.scroller.addEventListener(type, this.#onTouchEnd, {
        passive: true,
        signal: this.#controller.signal,
      });
    }
    for (const type of ["pointerdown", "keydown"] as const) {
      this.scroller.addEventListener(type, this.#takeControl, {
        capture: true,
        passive: true,
        signal: this.#controller.signal,
      });
    }
    this.scroller.addEventListener("wheel", this.#onWheel, {
      capture: true,
      passive: false,
      signal: this.#controller.signal,
    });
    this.#paintSelection();
  }

  #thumbnailSource(item: GalleryItem) {
    const source = item.src || item.thumbnail?.dataset.src || item.thumbnail?.currentSrc;
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
    return item.thumbnail?.dataset.src || item.src || item.thumbnail?.currentSrc;
  }

  async #loadThumbnail(target: HTMLImageElement, source?: string, fallback?: string) {
    for (const candidate of new Set([source, fallback])) {
      if (!candidate) continue;
      const loader = new Image();
      loader.src = candidate;
      try {
        await loader.decode();
        target.src = candidate;
        return;
      } catch {
        // Keep showing the thumbhash while the next source is tried.
      }
    }
  }

  mount(index = this.#index) {
    this.#index = index;
    this.#paintSelection();
    this.#scrollMode = "commanded";
    this.#center(index, false);
    this.#mountFrame = requestAnimationFrame(() => {
      this.#center(index, false);
      this.#mountFrame = requestAnimationFrame(() => {
        this.#mountFrame = 0;
      });
    });
  }

  activate(index = this.#index) {
    this.#index = index;
    this.#paintSelection();
    this.#center(index, false);
    this.#mountFrame = requestAnimationFrame(() => {
      this.#initializing = false;
      this.#scrollMode = "idle";
      this.#mountFrame = 0;
    });
  }

  sync(index: number, center = true, smooth = false) {
    if (this.#initializing) return;
    if (index === this.#index) return;
    this.#index = index;
    this.#paintSelection();
    if (center) this.scrollTo(index, smooth);
  }

  get controlling() {
    return this.#scrollMode === "user";
  }

  settle(index: number) {
    if (this.#initializing) return;
    this.#index = index;
    this.#paintSelection();
  }

  scrollTo(index: number, smooth: boolean) {
    this.#scrollMode = "commanded";
    this.#center(index, smooth);
  }

  #center(index: number, smooth: boolean) {
    const target = this.items[index];
    if (!target) return;
    const left = this.#itemCenter(index) - this.scroller.clientWidth / 2;
    this.scroller.scrollTo({ left, behavior: smooth ? "smooth" : "instant" });
  }

  #itemCenter(index: number) {
    const target = this.items[index];
    return target ? target.offsetLeft + target.offsetWidth / 2 : 0;
  }

  #onScroll = () => {
    if (this.#touching || this.#scrollMode === "idle") this.#takeControl();
    this.#queueSelection();
    this.#scheduleSettle();
  };

  #scheduleSettle() {
    clearTimeout(this.#settleTimer);
    if (!this.#touching) this.#settleTimer = setTimeout(this.#onSettled, 160);
  }

  #queueSelection() {
    if (this.#initializing || this.#scrollMode !== "user") return;
    if (this.#scrollFrame) return;
    this.#scrollFrame = requestAnimationFrame(() => {
      this.#scrollFrame = 0;
      if (this.#scrollMode !== "user") return;
      this.#select(this.#nearestIndex(), false);
    });
  }

  #nearestIndex() {
    const center = this.scroller.getBoundingClientRect().left + this.scroller.clientWidth / 2;
    let nearest = this.#index;
    let distance = Number.POSITIVE_INFINITY;
    for (const [index, button] of this.items.entries()) {
      const rect = button.getBoundingClientRect();
      const nextDistance = Math.abs(rect.left + rect.width / 2 - center);
      if (nextDistance < distance) {
        nearest = index;
        distance = nextDistance;
      }
    }
    return nearest;
  }

  #onSettled = () => {
    clearTimeout(this.#settleTimer);
    if (this.#initializing || this.#touching) return;
    if (this.#scrollMode === "commanded") {
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
    this.#scrollMode = "user";
  };

  #onWheel = (event: WheelEvent) => {
    this.#takeControl();
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && event.cancelable) {
      event.preventDefault();
    }
  };

  #select(index: number, settled: boolean) {
    if (index === this.#index) {
      if (settled) this.#onSelect(index, true);
      return;
    }
    this.#index = index;
    this.#paintSelection();
    this.#onSelect(index, settled);
  }

  #paintSelection() {
    for (let index = 0; index < this.items.length; index++) {
      const selected = index === this.#index;
      this.items[index]!.setAttribute("aria-selected", String(selected));
      this.items[index]!.toggleAttribute("data-lightbox-selected", selected);
      this.items[index]!.tabIndex = selected ? 0 : -1;
    }
  }

  destroy() {
    this.#controller.abort();
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

  createSession(items: GalleryItem[], index: number, onSelect: SelectCallback) {
    return new FilmstripSession(items, index, onSelect);
  }
}

if (!customElements.get("app-filmstrip")) {
  customElements.define("app-filmstrip", AppFilmstrip);
}
