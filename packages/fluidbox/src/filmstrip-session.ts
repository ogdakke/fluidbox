import {
  FilmstripRuntime,
  filmstripCommandOptions,
  type FilmstripLayout,
} from "./filmstrip-runtime";
import { filmstripThumbnailSources, loadFilmstripThumbnail } from "./filmstrip-thumbnail";
import type {
  FluidboxController,
  FluidboxDispose,
  FluidboxItem,
  FluidboxSource,
} from "./public-api";

export interface FluidboxFilmstripItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** The thumbnail button. Fill it with your own markup. */
  readonly target: HTMLButtonElement;
  /** Aborted when the thumbnail scrolls out of the rendered window. */
  readonly signal: AbortSignal;
}

export interface FilmstripSessionOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Replaces the default thumbnail image. */
  readonly renderItem?: (context: FluidboxFilmstripItemContext<TItem>) => void | FluidboxDispose;
}

/** Plain DOM filmstrip, used by the custom-element adapter and the filmstrip() extension. */
export class FilmstripSession<TItem extends FluidboxItem = FluidboxItem> {
  readonly dock: HTMLDivElement;
  readonly element: HTMLDivElement;
  readonly scroller: HTMLDivElement;
  readonly track: HTMLDivElement;
  readonly #source: FluidboxSource<TItem>;
  readonly #visible = new Map<number, HTMLButtonElement>();
  readonly #requests = new Map<number, AbortController>();
  readonly #runtime: FilmstripRuntime;
  readonly #disposers = new Map<number, FluidboxDispose>();
  readonly #renderItem: FilmstripSessionOptions<TItem>["renderItem"];
  #first = -1;
  #last = -1;
  #index: number;
  #step = 57;

  constructor(
    ownerDocument: Document,
    source: FluidboxSource<TItem>,
    controller: FluidboxController<TItem>,
    index: number,
    options: FilmstripSessionOptions<TItem> = {},
  ) {
    this.#source = source;
    this.#renderItem = options.renderItem;
    this.#index = index;
    this.dock = ownerDocument.createElement("div");
    this.element = ownerDocument.createElement("div");
    this.scroller = ownerDocument.createElement("div");
    this.track = ownerDocument.createElement("div");
    this.dock.dataset.fluidboxFilmstripDock = "";
    this.element.dataset.fluidboxFilmstrip = "";
    this.element.setAttribute("aria-label", "Gallery filmstrip");
    this.scroller.dataset.fluidboxFilmstripScroll = "";
    this.scroller.setAttribute("role", "listbox");
    this.scroller.setAttribute("aria-label", "Choose a gallery item");
    this.track.dataset.fluidboxFilmstripTrack = "";
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
    button.dataset.fluidboxFilmstripItem = "";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-label",
      item.media.type === "image" ? item.media.alt : item.media.title,
    );
    button.setAttribute("aria-posinset", String(index + 1));
    button.setAttribute("aria-setsize", String(this.#source.count));
    button.style.left = `${index * this.#step}px`;
    const request = new AbortController();
    this.#requests.set(index, request);
    if (this.#renderItem) {
      const dispose = this.#renderItem({ item, index, target: button, signal: request.signal });
      if (dispose) this.#disposers.set(index, dispose);
    } else {
      const image = this.element.ownerDocument.createElement("img");
      const sources = filmstripThumbnailSources(item);
      image.src = item.thumbnail?.src ?? item.preview?.src ?? sources[0] ?? "";
      image.alt = "";
      image.draggable = false;
      image.dataset.fluidboxFilmstripThumbnail = "";
      if (sources.length) void loadFilmstripThumbnail(image, sources, request.signal);
      button.append(image);
    }
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
      this.#disposers.get(index)?.();
      this.#disposers.delete(index);
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
    button.toggleAttribute("data-fluidbox-selected", selected);
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
    for (const dispose of this.#disposers.values()) dispose();
    this.#disposers.clear();
    this.dock.remove();
  }
}
