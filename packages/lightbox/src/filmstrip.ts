import { asGalleryItemSource, type GalleryItem, type GalleryItemSource } from "./gallery-strip";
import { FilmstripRuntime, type FilmstripLayout } from "./filmstrip-runtime";

type SelectCallback = (index: number, settled: boolean) => void;

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
  #runtime: FilmstripRuntime;
  #step = 57;

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
    this.#runtime = new FilmstripRuntime({
      element: this.element,
      scroller: this.scroller,
      count: this.items.length,
      index,
      deferActivation: true,
      onSelect: (nextIndex, settled) => this.#select(nextIndex, settled),
      onWindowChange: (center, layout, force) => this.#applyWindow(center, layout, force),
    });
  }

  #applyWindow(center: number, layout: FilmstripLayout, force: boolean) {
    force ||= layout.step !== this.#step;
    this.#step = layout.step;
    this.track.style.width = `${Math.max(0, this.items.length * layout.step - (layout.step - layout.size))}px`;
    this.#renderWindow(center, force);
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
      this.#runtime.choose(index, false);
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
    this.#runtime.mount();
  }

  activate(index = this.#index) {
    const previous = this.#index;
    this.#index = index;
    this.#renderWindow(index);
    this.#paintSelection(previous);
    this.#runtime.activate(index);
  }

  sync(index: number, center = true, smooth = false) {
    if (!this.#runtime.sync(index, center, smooth)) return;
    const previous = this.#index;
    this.#index = index;
    this.#paintSelection(previous);
  }

  get controlling() {
    return this.#runtime.controlling;
  }

  settle(index: number) {
    if (!this.#runtime.settle(index)) return;
    const previous = this.#index;
    this.#index = index;
    this.#paintSelection(previous);
  }

  scrollTo(index: number, smooth: boolean) {
    this.#runtime.scrollTo(index, smooth);
  }

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
    this.#runtime.destroy();
    for (const request of this.#requests.values()) request.abort();
    this.#requests.clear();
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
