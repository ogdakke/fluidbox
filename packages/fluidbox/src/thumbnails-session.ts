import { ThumbnailsRuntime, type ThumbnailsLayout } from "./thumbnails-runtime";
import { thumbnailsThumbnailSources, loadThumbnailsThumbnail } from "./thumbnails-thumbnail";
import { paintItemData } from "./item-data";
import type {
  SessionController,
  FluidboxDispose,
  FluidboxItem,
  FluidboxSource,
} from "./runtime-types";
import type { FluidboxLabels } from "./labels";

export interface FluidboxThumbnailsItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** The thumbnail button. Fill it with your own markup. */
  readonly target: HTMLButtonElement;
  /** Aborted when the thumbnail scrolls out of the rendered window. */
  readonly signal: AbortSignal;
}

export interface ThumbnailsSessionOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Replaces the default thumbnail image. */
  readonly renderItem?: (context: FluidboxThumbnailsItemContext<TItem>) => void | FluidboxDispose;
  readonly labels: Pick<FluidboxLabels, "thumbnails" | "thumbnailsList" | "position">;
}

/** Plain DOM thumbnails, used by the thumbnails() add-on for every binding and the custom elements. */
export class ThumbnailsSession<TItem extends FluidboxItem = FluidboxItem> {
  readonly dock: HTMLDivElement;
  readonly element: HTMLDivElement;
  readonly scroller: HTMLDivElement;
  readonly track: HTMLDivElement;
  readonly #source: FluidboxSource<TItem>;
  readonly #visible = new Map<number, HTMLButtonElement>();
  readonly #requests = new Map<number, AbortController>();
  readonly #runtime: ThumbnailsRuntime;
  readonly #disposers = new Map<number, FluidboxDispose>();
  readonly #renderItem: ThumbnailsSessionOptions<TItem>["renderItem"];
  readonly #labels: ThumbnailsSessionOptions<TItem>["labels"];
  #first = -1;
  #last = -1;
  #index: number;
  #step = 57;
  #vertical = false;

  constructor(
    ownerDocument: Document,
    source: FluidboxSource<TItem>,
    controller: SessionController<TItem>,
    index: number,
    options: ThumbnailsSessionOptions<TItem>,
  ) {
    this.#source = source;
    this.#renderItem = options.renderItem;
    this.#labels = options.labels;
    this.#index = index;
    this.dock = ownerDocument.createElement("div");
    this.element = ownerDocument.createElement("div");
    this.scroller = ownerDocument.createElement("div");
    this.track = ownerDocument.createElement("div");
    this.dock.dataset.fluidboxThumbnailsDock = "";
    // It reveals and hides with the viewer's layer, as your content does.
    this.dock.dataset.fluidboxChrome = "";
    this.element.dataset.fluidboxThumbnails = "";
    // Its touches, wheel and keys scrub the strip, not the viewer.
    this.element.dataset.fluidboxOwnsInput = "";
    this.element.setAttribute("role", "group");
    this.element.setAttribute("aria-label", options.labels.thumbnails);
    this.scroller.dataset.fluidboxThumbnailsScroll = "";
    this.scroller.setAttribute("role", "listbox");
    this.scroller.setAttribute("aria-orientation", "horizontal");
    this.scroller.setAttribute("aria-label", options.labels.thumbnailsList);
    this.track.dataset.fluidboxThumbnailsTrack = "";
    this.scroller.append(this.track);
    this.element.append(this.scroller);
    this.dock.append(this.element);
    this.#runtime = new ThumbnailsRuntime({
      element: this.element,
      scroller: this.scroller,
      count: source.count,
      index,
      onSelect: (nextIndex, settled, input) => {
        if (!settled && controller.state.index === nextIndex) return;
        void controller.goTo({ index: nextIndex }, { reason: input, scrub: !settled });
      },
      onWindowChange: (center, layout, force) => this.#applyWindow(center, layout, force),
      onAxisChange: (vertical) => {
        this.scroller.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
      },
      // Only a looping gallery has a next item at the end and a previous one at the start.
      loops: () => controller.state.hasNext && controller.state.hasPrevious,
    });
  }

  #applyWindow(center: number, layout: ThumbnailsLayout, force: boolean) {
    force ||= layout.step !== this.#step || layout.vertical !== this.#vertical;
    this.#step = layout.step;
    this.#vertical = layout.vertical;
    const length = `${Math.max(0, this.#source.count * layout.step - (layout.step - layout.size))}px`;
    this.track.style.removeProperty(this.#vertical ? "width" : "height");
    this.track.style.setProperty(this.#vertical ? "height" : "width", length);
    this.#renderWindow(center, force);
  }

  /** Put a thumbnail at its place along the strip. */
  #place(button: HTMLButtonElement, index: number) {
    // From the strip's start, so a right-to-left strip runs from the right.
    button.style.removeProperty(this.#vertical ? "inset-inline-start" : "top");
    button.style.setProperty(
      this.#vertical ? "top" : "inset-inline-start",
      `${index * this.#step}px`,
    );
  }

  #makeButton(index: number) {
    const item = this.#source.getItem(index);
    const button = this.element.ownerDocument.createElement("button");
    button.type = "button";
    button.dataset.fluidboxThumbnailsItem = "";
    button.dataset.index = String(index);
    paintItemData(button, item.data);
    button.setAttribute("role", "option");
    // An item without a name, as a decorative photo, is named by its place.
    button.setAttribute(
      "aria-label",
      (item.type === "image" ? item.alt : item.title) ||
        this.#labels.position(index, this.#source.count),
    );
    button.setAttribute("aria-posinset", String(index + 1));
    button.setAttribute("aria-setsize", String(this.#source.count));
    this.#place(button, index);
    const request = new AbortController();
    this.#requests.set(index, request);
    if (this.#renderItem) {
      const dispose = this.#renderItem({ item, index, target: button, signal: request.signal });
      if (dispose) this.#disposers.set(index, dispose);
    } else {
      const image = this.element.ownerDocument.createElement("img");
      const sources = thumbnailsThumbnailSources(item);
      // The smallest candidate: a thumbnail's plain src can be its largest, as
      // with Next's getImageProps, and an src starts downloading as it is set.
      image.src = sources[0] ?? "";
      image.alt = "";
      image.draggable = false;
      image.dataset.fluidboxThumbnailsThumbnail = "";
      if (sources.length) void loadThumbnailsThumbnail(image, sources, request.signal);
      button.append(image);
    }
    button.addEventListener("click", () => this.#runtime.choose(index, false));
    this.#paintButton(button, index === this.#index);
    return button;
  }

  #renderWindow(center: number, force = false) {
    const extent = this.#vertical ? this.scroller.clientHeight : this.scroller.clientWidth;
    const radius = Math.ceil((extent || 800) / this.#step) + 4;
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
      this.#place(button, index);
      if (!existing) this.track.insertBefore(button, insertionPoint);
      else insertionPoint = button.nextSibling;
      this.#visible.set(index, button);
    }
  }

  #paintButton(button: HTMLButtonElement, selected: boolean) {
    button.setAttribute("aria-selected", String(selected));
    button.toggleAttribute("data-fluidbox-selected", selected);
    button.toggleAttribute("data-active", selected);
    button.tabIndex = selected ? 0 : -1;
  }

  mount() {
    this.#runtime.mount();
  }

  /** Lay the strip out again from its CSS, now that the viewer is in the document. */
  measure() {
    this.#runtime.measure();
  }

  sync(index: number) {
    const previous = this.#index;
    this.#index = index;
    this.#runtime.sync(index);
    const old = this.#visible.get(previous);
    if (old) this.#paintButton(old, false);
    const current = this.#visible.get(index);
    if (current) this.#paintButton(current, true);
    // Focus follows the selection, as in a listbox, while it is in the strip.
    if (
      current &&
      old !== current &&
      this.element.contains(this.element.ownerDocument.activeElement)
    ) {
      current.focus({ preventScroll: true });
    }
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
