import {
  FilmstripRuntime,
  filmstripCommandOptions,
  type FilmstripLayout,
} from "./filmstrip-runtime";
import { filmstripThumbnailSources, loadFilmstripThumbnail } from "./filmstrip-thumbnail";
import type { LightboxController, LightboxItem, LightboxSource } from "./public-api";

/** Plain DOM filmstrip used by the custom-element adapter. */
export class FilmstripSession<TItem extends LightboxItem = LightboxItem> {
  readonly dock: HTMLDivElement;
  readonly element: HTMLDivElement;
  readonly scroller: HTMLDivElement;
  readonly track: HTMLDivElement;
  readonly #source: LightboxSource<TItem>;
  readonly #visible = new Map<number, HTMLButtonElement>();
  readonly #requests = new Map<number, AbortController>();
  readonly #runtime: FilmstripRuntime;
  #first = -1;
  #last = -1;
  #index: number;
  #step = 57;

  constructor(
    ownerDocument: Document,
    source: LightboxSource<TItem>,
    controller: LightboxController<TItem>,
    index: number,
  ) {
    this.#source = source;
    this.#index = index;
    this.dock = ownerDocument.createElement("div");
    this.element = ownerDocument.createElement("div");
    this.scroller = ownerDocument.createElement("div");
    this.track = ownerDocument.createElement("div");
    this.dock.dataset.lightboxFilmstripDock = "";
    this.element.dataset.lightboxFilmstrip = "";
    this.element.setAttribute("aria-label", "Gallery filmstrip");
    this.scroller.dataset.lightboxFilmstripScroll = "";
    this.scroller.setAttribute("role", "listbox");
    this.scroller.setAttribute("aria-label", "Choose a gallery item");
    this.track.dataset.lightboxFilmstripTrack = "";
    this.scroller.append(this.track);
    this.element.append(this.scroller);
    this.dock.append(this.element);
    this.#runtime = new FilmstripRuntime({
      element: this.element,
      scroller: this.scroller,
      count: source.count,
      index,
      onSelect: (nextIndex, settled) => {
        if (!settled && controller.state.requestedIndex === nextIndex) return;
        void controller.goTo({ index: nextIndex }, filmstripCommandOptions(settled));
      },
      onWindowChange: (center, layout, force) => this.#applyWindow(center, layout, force),
    });
  }

  #applyWindow(center: number, layout: FilmstripLayout, force: boolean) {
    force ||= layout.step !== this.#step;
    this.#step = layout.step;
    this.track.style.width = `${Math.max(0, this.#source.count * layout.step - (layout.step - layout.size))}px`;
    this.#renderWindow(center, force);
  }

  #makeButton(index: number) {
    const item = this.#source.getItem(index);
    const button = this.element.ownerDocument.createElement("button");
    button.type = "button";
    button.dataset.lightboxFilmstripItem = "";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-label",
      item.media.type === "image" ? item.media.alt : item.media.title,
    );
    button.setAttribute("aria-posinset", String(index + 1));
    button.setAttribute("aria-setsize", String(this.#source.count));
    button.style.left = `${index * this.#step}px`;
    const image = this.element.ownerDocument.createElement("img");
    const sources = filmstripThumbnailSources(item);
    image.src = item.thumbnail?.src ?? item.preview?.src ?? sources[0] ?? "";
    image.alt = "";
    image.draggable = false;
    image.dataset.lightboxFilmstripThumbnail = "";
    if (sources.length) {
      const request = new AbortController();
      this.#requests.set(index, request);
      void loadFilmstripThumbnail(image, sources, request.signal);
    }
    button.append(image);
    button.addEventListener("click", () => this.#runtime.choose(index, false));
    this.#paintButton(button, index === this.#index);
    return button;
  }

  #renderWindow(center: number, force = false) {
    const radius = Math.ceil((this.scroller.clientWidth || 800) / this.#step) + 4;
    const first = Math.max(0, center - radius);
    const last = Math.min(this.#source.count - 1, center + radius);
    if (!force && first === this.#first && last === this.#last) return;
    this.#first = first;
    this.#last = last;
    for (const [index, request] of this.#requests) {
      if (!force && index >= first && index <= last) continue;
      request.abort();
      this.#requests.delete(index);
    }
    const previous = new Map(this.#visible);
    for (const [index, button] of previous) {
      if (!force && index >= first && index <= last) continue;
      button.remove();
      this.#visible.delete(index);
    }
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

  mount() {
    this.#runtime.mount();
  }

  sync(index: number) {
    const previous = this.#index;
    this.#index = index;
    this.#runtime.sync(index);
    const old = this.#visible.get(previous);
    if (old) this.#paintButton(old, false);
    const current = this.#visible.get(index);
    if (current) this.#paintButton(current, true);
  }

  destroy() {
    this.#runtime.destroy();
    for (const request of this.#requests.values()) request.abort();
    this.#requests.clear();
    this.dock.remove();
  }
}

/** Declarative marker that opts its parent gallery into the default filmstrip UI. */
export class AppFilmstrip extends HTMLElement {
  connectedCallback() {
    this.hidden = true;
  }
}

if (!customElements.get("app-filmstrip")) customElements.define("app-filmstrip", AppFilmstrip);
