import { controlButton, controlNames } from "./controls";
import { loadAddons } from "./addons";
import { createFluidbox } from "./create-fluidbox";
import { forwardEvents } from "./events";
import { FluidboxFilmstripElement, FluidboxSheetElement } from "./filmstrip";
import { FluidboxItemElement, type DeclarativeFluidboxDefinition } from "./item";
import { idOf, toList } from "./items";
import { resolveLabels, type FluidboxLabels } from "./labels";
import type {
  Fluidbox,
  FluidboxCommandOptions,
  FluidboxEventMap,
  FluidboxFilmstrip,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItems,
  FluidboxOptions,
  FluidboxOriginAdapter,
  FluidboxRenderer,
  FluidboxSheet,
  FluidboxSheetOptions,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxTarget,
  FluidboxViewerContext,
  FluidboxViewerRenderer,
} from "./public-api";
import { FluidboxToggleEvent } from "./public-api";
import { latestOrigins } from "./origins";
import { bindTrigger, type FluidboxTrigger } from "./trigger";

/** Markup attributes whose change re-reads the items. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.prototype && proto !== Array.prototype) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => same((a as never)[key], (b as never)[key]));
}

function sameItems(a: FluidboxItemList, b: FluidboxItemList) {
  if (a.count !== b.count) return false;
  for (let index = 0; index < a.count; index++) if (!same(a.get(index), b.get(index))) return false;
  return true;
}

const ITEM_ATTRIBUTES = new Set([
  "item-id",
  "data-fluidbox-item-id",
  "returns",
  "slot",
  "src",
  "srcset",
  "sizes",
  "media",
  "type",
  "width",
  "height",
  "alt",
  "title",
  "poster",
  "placeholder",
  "aria-label",
  "autoplay",
  "loop",
  "muted",
  "playsinline",
  "controls",
  "preload",
  "allow",
  "referrerpolicy",
  "sandbox",
]);
/** Attributes whose change rebuilds the viewer. */
const VIEWER_ATTRIBUTES = ["zoom", "zoom-step", "zoom-max"];

const closedState: FluidboxState = Object.freeze({
  status: "closed",
  id: null,
  index: null,
  item: null,
  count: 0,
  hasPrevious: false,
  hasNext: false,
});

function snapPoints(value: string | null): FluidboxSheetSnapPoint[] | undefined {
  const points = value
    ?.split(/\s+/)
    .filter(Boolean)
    .map((point): FluidboxSheetSnapPoint | null => {
      if (point === "content" || /^\d+(\.\d+)?%$/.test(point))
        return point as FluidboxSheetSnapPoint;
      const pixels = Number.parseFloat(point);
      return Number.isFinite(pixels) ? pixels : null;
    })
    .filter((point): point is FluidboxSheetSnapPoint => point !== null);
  return points?.length ? points : undefined;
}

/**
 * The fluidbox as markup: `<fluidbox-item>` children, or an `items` property
 * with descendants marked `data-fluidbox-item-id` as triggers. It takes the
 * same options as createFluidbox as properties, has the same commands, and
 * fires the same events.
 *
 * Children that turn features on: `<fluidbox-filmstrip>`, `<fluidbox-sheet>`
 * (each needs its entry imported), and a `<template slot="viewer">` for your
 * own controls, where `<fluidbox-controls>` stands for the default ones.
 */
export class FluidboxGalleryElement extends HTMLElement {
  static readonly observedAttributes = VIEWER_ATTRIBUTES;

  addEventListener<K extends keyof FluidboxGalleryEventMap>(
    type: K,
    listener: (this: FluidboxGalleryElement, event: FluidboxGalleryEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof FluidboxGalleryEventMap>(
    type: K,
    listener: (this: FluidboxGalleryElement, event: FluidboxGalleryEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    super.removeEventListener(type, listener, options);
  }

  #fluidbox: Fluidbox | null = null;
  #items: FluidboxItems | null = null;
  #origins: FluidboxOriginAdapter | undefined;
  #renderers: Readonly<Record<string, FluidboxRenderer<any>>> = {};
  #viewer: FluidboxViewerRenderer<any> | undefined;
  #labels: Partial<FluidboxLabels> | undefined;
  #zoom: FluidboxOptions["zoom"] | undefined;
  #definitions = new Map<string, DeclarativeFluidboxDefinition>();
  /** The renderers the viewer looks up by name: markup content, then the renderers property. */
  #runtimeRenderers: Record<string, FluidboxRenderer<any>> = {};
  #triggers = new Map<HTMLElement, { element: HTMLElement; trigger: FluidboxTrigger }>();
  #overlays: (() => void)[] = [];
  #observer: MutationObserver | undefined;
  #refreshQueued = false;
  #refreshPromise: Promise<void> = Promise.resolve();
  #unsubscribe: (() => void) | undefined;
  #events: AbortController | undefined;
  #lastStatus: FluidboxState["status"] = "closed";
  #listeners = new Set<(state: FluidboxState) => void>();
  #readyWaiters: Array<{ resolve(fluidbox: Fluidbox): void; reject(error: unknown): void }> = [];
  #lifetime: AbortController | undefined;

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.#lifetime = new AbortController();
    this.addEventListener("fluidbox-addon-change", () => this.#rebuild(), {
      signal: this.#lifetime.signal,
    });
    this.#observer = new MutationObserver((records) => {
      let refresh = false;
      for (const record of records) {
        const target = record.target as Element;
        if (target.closest?.("[data-fluidbox-dynamic-preview]")) continue;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (
          nodes.some(
            (node) =>
              node instanceof FluidboxSheetElement || node instanceof FluidboxFilmstripElement,
          )
        ) {
          this.#rebuild();
          return;
        }
        if (record.type === "childList" || ITEM_ATTRIBUTES.has(record.attributeName ?? "")) {
          refresh = true;
        }
      }
      if (refresh) this.#queueRefresh();
    });
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true });
    this.#queueRefresh();
  }

  disconnectedCallback() {
    for (const waiter of this.#readyWaiters) {
      waiter.reject(
        new DOMException("fluidbox-gallery disconnected before it was ready.", "AbortError"),
      );
    }
    this.#readyWaiters = [];
    this.#lifetime?.abort();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#teardown();
  }

  attributeChangedCallback(_name: string, previous: string | null, next: string | null) {
    if (previous !== next) this.#rebuild();
  }

  /** The fluidbox behind the gallery, once it is ready. A rebuild replaces it. */
  get fluidbox() {
    return this.#fluidbox;
  }

  /** The viewer state, or a closed state before the gallery is ready. */
  get state(): FluidboxState {
    return this.#fluidbox?.state ?? closedState;
  }

  /** The sheet, while a `<fluidbox-sheet>` turns it on. */
  get sheet(): FluidboxSheet | null {
    return this.#fluidbox?.sheet ?? null;
  }

  /** The filmstrip, while a `<fluidbox-filmstrip>` turns it on. */
  get filmstrip(): FluidboxFilmstrip | null {
    return this.#fluidbox?.filmstrip ?? null;
  }

  /** Resolves with the fluidbox once the gallery has read its items. */
  whenReady(): Promise<Fluidbox> {
    if (this.#fluidbox) return Promise.resolve(this.#fluidbox);
    if (!this.isConnected) {
      return Promise.reject(
        new DOMException("fluidbox-gallery is not connected.", "InvalidStateError"),
      );
    }
    return new Promise((resolve, reject) => this.#readyWaiters.push({ resolve, reject }));
  }

  /** Items to use instead of the `<fluidbox-item>` children. */
  get items() {
    return this.#items;
  }

  set items(items: FluidboxItems | null) {
    this.#items = items;
    this.#queueRefresh();
  }

  /** Origins for items that have no trigger in the gallery. */
  get origins() {
    return this.#origins;
  }

  set origins(origins: FluidboxOriginAdapter | undefined) {
    this.#origins = origins;
  }

  /** Renderers of `custom` items, by name. Read when a slide mounts. */
  get renderers() {
    return this.#renderers;
  }

  set renderers(renderers: Readonly<Record<string, FluidboxRenderer<any>>>) {
    this.#renderers = renderers;
    this.#syncRenderers();
  }

  /** Your own controls and captions, instead of a `<template slot="viewer">` or the defaults. */
  get viewer() {
    return this.#viewer;
  }

  set viewer(viewer: FluidboxViewerRenderer<any> | undefined) {
    if (viewer === this.#viewer) return;
    this.#viewer = viewer;
    this.#rebuild();
  }

  get labels() {
    return this.#labels;
  }

  set labels(labels: Partial<FluidboxLabels> | undefined) {
    this.#labels = labels;
    this.#rebuild();
  }

  /** Zoom options, or false to turn zoom off. Overrides the zoom attributes. */
  get zoom(): FluidboxOptions["zoom"] | undefined {
    return this.#zoom ?? this.#zoomAttributes();
  }

  set zoom(zoom: FluidboxOptions["zoom"] | undefined) {
    if (zoom === this.#zoom) return;
    this.#zoom = zoom;
    this.#rebuild();
  }

  /** Follow the viewer state, across the rebuilds a change of options makes. */
  subscribe(listener: (state: FluidboxState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async open(target?: FluidboxTarget, options?: FluidboxCommandOptions) {
    return (await this.#ready()).open(target, options);
  }

  async close(options?: FluidboxCommandOptions) {
    return (await this.#ready()).close(options);
  }

  async next(options?: FluidboxCommandOptions) {
    return (await this.#ready()).next(options);
  }

  async previous(options?: FluidboxCommandOptions) {
    return (await this.#ready()).previous(options);
  }

  async #ready() {
    await Promise.resolve();
    await this.#refreshPromise;
    if (!this.#fluidbox) {
      throw new DOMException("fluidbox-gallery is not connected yet.", "InvalidStateError");
    }
    return this.#fluidbox;
  }

  #zoomAttributes(): FluidboxOptions["zoom"] | undefined {
    if (this.getAttribute("zoom") === "off") return false;
    const number = (name: string) => {
      const value = Number(this.getAttribute(name));
      return this.hasAttribute(name) && Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const step = number("zoom-step");
    const max = number("zoom-max");
    return step || max ? { ...(step ? { step } : {}), ...(max ? { max } : {}) } : undefined;
  }

  /** Drop the viewer so the next refresh builds one with the current options. */
  #rebuild() {
    if (!this.#fluidbox) return;
    this.#teardown();
    this.#queueRefresh();
  }

  #teardown() {
    // Whoever follows the gallery hears the viewer it drops close.
    const dropped = this.#fluidbox?.state;
    if (dropped && dropped.status !== "closed") {
      const closed: FluidboxState = Object.freeze({ ...closedState, count: dropped.count });
      this.#lastStatus = "closed";
      for (const listener of this.#listeners) listener(closed);
      this.dispatchEvent(
        new FluidboxToggleEvent("toggle", { oldState: "open", newState: "closed", reason: "api" }),
      );
    }
    for (const { trigger } of this.#triggers.values()) trigger.destroy();
    this.#triggers.clear();
    for (const dispose of this.#overlays) dispose();
    this.#overlays = [];
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#events?.abort();
    this.#events = undefined;
    this.#fluidbox?.destroy();
    this.#fluidbox = null;
  }

  #queueRefresh() {
    if (!this.isConnected || this.#refreshQueued) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      if (!this.isConnected) return;
      this.#refreshPromise = this.#refreshPromise
        .then(() => this.#refresh())
        .catch((error: unknown) => {
          for (const waiter of this.#readyWaiters) waiter.reject(error);
          this.#readyWaiters = [];
          // Report it, but keep the chain alive so corrected markup refreshes again.
          queueMicrotask(() => {
            throw error;
          });
        });
    });
  }

  #syncRenderers() {
    for (const key of Object.keys(this.#runtimeRenderers)) delete this.#runtimeRenderers[key];
    Object.assign(this.#runtimeRenderers, this.#renderers);
    for (const definition of this.#definitions.values()) {
      if (definition.renderer) {
        this.#runtimeRenderers[definition.renderer[0]] = definition.renderer[1];
      }
    }
  }

  #elements() {
    return Array.from(this.children).filter(
      (child): child is FluidboxItemElement => child instanceof FluidboxItemElement,
    );
  }

  async #refresh() {
    const definitions = new Map<string, DeclarativeFluidboxDefinition>();
    let items = this.#items;
    if (!items) {
      items = this.#elements().map((element) => {
        const definition = element.compile();
        const id = idOf(definition.item);
        if (definitions.has(id)) throw new TypeError(`Duplicate fluidbox item id: ${id}`);
        definitions.set(id, definition);
        return definition.item;
      });
    }
    const list = toList(items);
    this.#definitions = definitions;
    this.#syncRenderers();
    if (!this.#fluidbox) {
      // An add-on loads only for a gallery that holds its element, and again
      // for one added while the first was loading.
      const wanted = () =>
        loadAddons([
          ...(this.querySelector(":scope > fluidbox-sheet") ? (["sheet"] as const) : []),
          ...(this.querySelector(":scope > fluidbox-filmstrip") ? (["filmstrip"] as const) : []),
        ]);
      for (let loading = wanted(); loading; loading = wanted()) await loading;
      if (this.#fluidbox || !this.isConnected) return;
      this.#create(list);
    } else {
      const fluidbox = this.#fluidbox;
      // Markup that compiles to the same items changes nothing. Setting them
      // anyway would restart an open or close that is under way. Items set
      // through the property always apply.
      if (this.#items || !sameItems(fluidbox.items, list)) await fluidbox.setItems(list);
      // A rebuild or disconnect during the update leaves nothing to bind.
      if (this.#fluidbox !== fluidbox || !this.isConnected) return;
    }
    const fluidbox = this.#fluidbox!;
    this.#bindTriggers(fluidbox);
    for (const waiter of this.#readyWaiters) waiter.resolve(fluidbox);
    this.#readyWaiters = [];
  }

  #create(items: FluidboxItems) {
    const sheetElement = this.querySelector<FluidboxSheetElement>(":scope > fluidbox-sheet");
    const filmstripElement = this.querySelector<FluidboxFilmstripElement>(
      ":scope > fluidbox-filmstrip",
    );
    const fluidbox = createFluidbox({
      items,
      labels: this.#labels,
      // The origins property can change after the viewer is made.
      origins: latestOrigins(() => this.#origins),
      renderers: this.#runtimeRenderers,
      zoom: this.zoom,
      viewer: (context) => this.#mountViewer(context),
      filmstrip: filmstripElement
        ? filmstripElement.render
          ? { render: filmstripElement.render }
          : true
        : undefined,
      sheet: sheetElement ? this.#sheetOptions(sheetElement) : undefined,
    });
    this.#fluidbox = fluidbox;
    this.#events = new AbortController();
    forwardEvents(fluidbox, this, this.#events.signal);
    this.#unsubscribe = fluidbox.subscribe((state) => {
      this.#keepFocus(state);
      for (const listener of this.#listeners) listener(state);
    });
  }

  #sheetOptions(element: FluidboxSheetElement): FluidboxSheetOptions<FluidboxItem> {
    const own = element.querySelector<HTMLTemplateElement>(":scope > template");
    const dismiss = element.getAttribute("dismiss");
    return {
      snapPoints: snapPoints(element.getAttribute("snap-points")),
      ...(dismiss === "flight" || dismiss === "scroll" || dismiss === "none" ? { dismiss } : {}),
      render:
        element.render ??
        ((context) => {
          const template = this.#definitions.get(idOf(context.item))?.sheet ?? own;
          if (template) context.target.append(template.content.cloneNode(true));
        }),
    };
  }

  /** One trigger per `<fluidbox-item>`, or per `data-fluidbox-item-id` descendant with `items` set. */
  #bindTriggers(fluidbox: Fluidbox) {
    const wanted = new Map<
      HTMLElement,
      { targets: readonly string[]; item?: FluidboxItemElement }
    >();
    if (this.#items) {
      for (const element of this.querySelectorAll<HTMLElement>("[data-fluidbox-item-id]")) {
        wanted.set(element, { targets: [element.dataset.fluidboxItemId!] });
      }
    } else {
      for (const item of this.#elements()) {
        const trigger = item.trigger;
        if (trigger) wanted.set(trigger, { targets: item.originIds, item });
      }
    }
    for (const [element, { trigger }] of this.#triggers) {
      if (wanted.has(element)) continue;
      trigger.destroy();
      this.#triggers.delete(element);
    }
    for (const dispose of this.#overlays) dispose();
    this.#overlays = [];
    for (const [element, { targets, item }] of wanted) {
      const options = {
        targets,
        onPreviewChange: item
          ? (selected: FluidboxItem) => item.previewChange(idOf(selected), selected)
          : undefined,
      };
      const bound = this.#triggers.get(element);
      if (bound) {
        bound.trigger.update(options);
        bound.trigger.refresh();
      } else {
        this.#triggers.set(element, { element, trigger: bindTrigger(fluidbox, element, options) });
      }
      const overlay = element.querySelector<HTMLElement>("[data-fluidbox-thumbnail-overlay]");
      if (overlay) {
        this.#overlays.push(
          fluidbox.bindOverlay(overlay, targets, {
            travel: overlay.dataset.fluidboxThumbnailOverlay === "travel",
          }),
        );
      }
    }
  }

  /**
   * Fill the viewer with the `viewer` property, else a `<template slot="viewer">`
   * (where `<fluidbox-controls>` stands for the default controls), else the
   * default controls. Buttons marked `data-fluidbox-close`, `-previous` or
   * `-next` work wherever they are.
   */
  #mountViewer(context: FluidboxViewerContext<any>) {
    const { target } = context;
    const ownerDocument = target.ownerDocument;
    const labels = resolveLabels(this.#labels);
    const defaults = () => controlNames.map((name) => controlButton(ownerDocument, name, labels));
    const template = this.querySelector<HTMLTemplateElement>(":scope > template[slot=viewer]");
    let dispose: void | (() => void);
    if (this.#viewer) {
      dispose = this.#viewer(context);
    } else if (template) {
      const content = ownerDocument.importNode(template.content, true);
      for (const placeholder of content.querySelectorAll("fluidbox-controls")) {
        placeholder.replaceWith(...defaults());
      }
      target.append(content);
    } else {
      target.append(...defaults());
    }
    return () => {
      dispose?.();
      target.replaceChildren();
    };
  }

  /** Focus the gallery after a close whose trigger is gone, as a recycled thumbnail is. */
  #keepFocus(state: FluidboxState) {
    const closed = state.status === "closed" && this.#lastStatus !== "closed";
    this.#lastStatus = state.status;
    if (!closed) return;
    queueMicrotask(() => {
      const active = this.ownerDocument.activeElement;
      if (!active || active === this.ownerDocument.body) this.focus({ preventScroll: true });
    });
  }
}

/** The gallery's events: the fluidbox's, and an element's own. */
export type FluidboxGalleryEventMap = Omit<HTMLElementEventMap, keyof FluidboxEventMap> &
  FluidboxEventMap;

declare global {
  interface HTMLElementTagNameMap {
    "fluidbox-gallery": FluidboxGalleryElement;
  }
}
