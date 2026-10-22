import { createFluidboxSync } from "./controlled";
import { createFluidbox } from "./create-fluidbox";
import { forwardEvents } from "./events";
import { FluidboxFilmstripElement, FluidboxSheetElement } from "./filmstrip";
import { FluidboxItemElement, type DeclarativeFluidboxDefinition } from "./item";
import { idOf, toList } from "./items";
import type { FluidboxLabels } from "./labels";
import type {
  Fluidbox,
  FluidboxCommandOptions,
  FluidboxEventMap,
  FluidboxFilmstripOptions,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItems,
  FluidboxLoading,
  FluidboxOptions,
  FluidboxOriginAdapter,
  FluidboxRenderer,
  FluidboxSheet,
  FluidboxSheetOptions,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxTarget,
  FluidboxUpdateOptions,
  FluidboxViewerContext,
  FluidboxViewerRenderer,
  FluidboxZoomCommandOptions,
} from "./public-api";
import { FluidboxToggleEvent } from "./public-api";
import { latestOrigins } from "./origins";
import { bindTrigger, frameLayerOf, type FluidboxTrigger } from "./trigger";

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

/**
 * Attributes that change the items. A trigger's own content is the page's to
 * change, as an album cover does, so changes inside a trigger never count.
 */
const ITEM_ATTRIBUTES = new Set([
  "item-id",
  "data-fluidbox-item-id",
  "returns",
  "slot",
  "placeholder",
  "aria-label",
]);
/** Attributes whose change updates the viewer. */
const VIEWER_ATTRIBUTES = ["nozoom", "zoom-step", "zoom-max", "loop", "loading"];
/** Your state for the viewer: `open`, and the `index` it shows. */
const CONTROL_ATTRIBUTES = ["open", "index"];
const LOADINGS: readonly string[] = ["hover", "press", "eager"] satisfies FluidboxLoading[];

/** The `<fluidbox-item>` trigger an element is in, or is. */
const triggerOf = (node: Node) =>
  (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
    "fluidbox-item > [slot=trigger]",
  ) ?? null;

const isOverlay = (node: Node) =>
  node instanceof Element &&
  (node.matches("[data-fluidbox-thumbnail-overlay]") ||
    !!node.querySelector("[data-fluidbox-thumbnail-overlay]"));

const closedState: FluidboxState = Object.freeze({
  status: "closed",
  id: null,
  index: null,
  item: null,
  count: 0,
  hasPrevious: false,
  hasNext: false,
  zoom: null,
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
  static readonly observedAttributes = [...VIEWER_ATTRIBUTES, ...CONTROL_ATTRIBUTES];

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
  /** Refreshes chained on #refreshPromise that have not settled yet. */
  #refreshing = 0;
  #refreshPromise: Promise<void> = Promise.resolve();
  #unsubscribe: (() => void) | undefined;
  #events: AbortController | undefined;
  #lastStatus: FluidboxState["status"] = "closed";
  #listeners = new Set<(state: FluidboxState) => void>();
  #readyWaiters: Array<{ resolve(fluidbox: Fluidbox): void; reject(error: unknown): void }> = [];
  #lifetime: AbortController | undefined;
  #updateQueued = false;
  #sync: ((open?: boolean, index?: number) => void) | undefined;
  /** What the items set through `items` or `setItems` came to, once applied. */
  #itemsResult: Promise<boolean> | undefined;
  /** A new function when `viewer` changes, so the update draws the viewer again. */
  #viewerRenderer: FluidboxViewerRenderer<any> = (context) => this.#mountViewer(context);

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.#lifetime = new AbortController();
    this.addEventListener("fluidbox-addon-change", () => this.#queueUpdate(), {
      signal: this.#lifetime.signal,
    });
    this.#observer = new MutationObserver((records) => {
      let refresh = false;
      for (const record of records) {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (
          nodes.some(
            (node) =>
              node instanceof FluidboxSheetElement || node instanceof FluidboxFilmstripElement,
          )
        ) {
          this.#queueUpdate();
        }
        const trigger = triggerOf(record.target);
        if (trigger) {
          // Inside a trigger only an overlay coming or going, or the trigger's
          // own slot, changes what the gallery binds.
          if (
            (record.type === "childList" && nodes.some(isOverlay)) ||
            (record.target === trigger && record.attributeName === "slot")
          ) {
            refresh = true;
          }
          continue;
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

  attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (previous === next) return;
    if (!CONTROL_ATTRIBUTES.includes(name)) this.#queueUpdate();
    else if (this.#fluidbox)
      void this.#ready().then(
        () => this.#control(),
        () => {},
      );
  }

  /** The fluidbox behind the gallery, once it is ready. A rebuild replaces it. */
  get fluidbox(): Fluidbox | null {
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
  get items(): FluidboxItems | null {
    return this.#items;
  }

  set items(items: FluidboxItems | null) {
    this.#items = items;
    this.#queueRefresh();
  }

  /** Replace the items, as the `items` property does. Resolves once they apply. */
  async setItems(items: FluidboxItems): Promise<boolean> {
    this.items = items;
    await this.#ready();
    return (await this.#itemsResult) ?? true;
  }

  /** Origins for items that have no trigger in the gallery. */
  get origins(): FluidboxOriginAdapter | undefined {
    return this.#origins;
  }

  set origins(origins: FluidboxOriginAdapter | undefined) {
    this.#origins = origins;
  }

  /** Renderers of `custom` items, by name. Read when a slide mounts. */
  get renderers(): Readonly<Record<string, FluidboxRenderer<any>>> {
    return this.#renderers;
  }

  set renderers(renderers: Readonly<Record<string, FluidboxRenderer<any>>>) {
    this.#renderers = renderers;
    this.#syncRenderers();
  }

  /** Your own controls and captions, instead of a `<template slot="viewer">` or the defaults. */
  get viewer(): FluidboxViewerRenderer<any> | undefined {
    return this.#viewer;
  }

  set viewer(viewer: FluidboxViewerRenderer<any> | undefined) {
    if (viewer === this.#viewer) return;
    this.#viewer = viewer;
    this.#viewerRenderer = (context) => this.#mountViewer(context);
    this.#queueUpdate();
  }

  get labels(): Partial<FluidboxLabels> | undefined {
    return this.#labels;
  }

  set labels(labels: Partial<FluidboxLabels> | undefined) {
    this.#labels = labels;
    this.#queueUpdate();
  }

  /** Zoom options, or false to turn zoom off. Overrides `nozoom` and the zoom attributes. */
  get zoom(): FluidboxOptions["zoom"] | undefined {
    return this.#zoom ?? this.#zoomAttributes();
  }

  set zoom(zoom: FluidboxOptions["zoom"] | undefined) {
    if (zoom === this.#zoom) return;
    this.#zoom = zoom;
    this.#queueUpdate();
  }

  /** When the viewer's code loads, as the `loading` attribute says: `hover` (the default), `press` or `eager`. */
  get loading(): FluidboxLoading {
    const value = this.getAttribute("loading") ?? "";
    return LOADINGS.includes(value) ? (value as FluidboxLoading) : "hover";
  }

  set loading(loading: FluidboxLoading) {
    this.setAttribute("loading", loading);
  }

  /** Follow the viewer state, across the rebuilds a change of options makes. */
  subscribe(listener: (state: FluidboxState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  open(target?: FluidboxTarget, options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.open(target, options));
  }

  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget): () => void {
    if (this.#fluidbox) return this.#fluidbox.preload(target);
    let released = false;
    let dispose: (() => void) | undefined;
    this.whenReady().then(
      (fluidbox) => {
        if (!released) dispose = fluidbox.preload(target);
      },
      () => {},
    );
    return () => {
      released = true;
      dispose?.();
    };
  }

  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.load());
  }

  close(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.close(options));
  }

  next(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.next(options));
  }

  previous(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.previous(options));
  }

  zoomTo(scale: number, options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.zoomTo(scale, options));
  }

  zoomIn(options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.zoomIn(options));
  }

  zoomOut(options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.zoomOut(options));
  }

  resetZoom(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.resetZoom(options));
  }

  /**
   * Run a command at once when nothing is queued to rebuild or update the
   * fluidbox, as a press or a key does, so it lands in order with them.
   * Otherwise wait for that work, so the command reaches the new options.
   */
  #run(command: (fluidbox: Fluidbox) => Promise<boolean>): Promise<boolean> {
    const settled = !this.#refreshQueued && !this.#updateQueued && !this.#refreshing;
    if (settled && this.#fluidbox) return command(this.#fluidbox);
    return this.#ready().then(command);
  }

  async #ready() {
    await Promise.resolve();
    await this.#refreshPromise;
    if (!this.#fluidbox) {
      throw new DOMException("fluidbox-gallery is not connected yet.", "InvalidStateError");
    }
    return this.#fluidbox;
  }

  /** Bring the viewer to the `open` and `index` attributes, where they changed. */
  #control() {
    const index = Number.parseInt(this.getAttribute("index") ?? "", 10);
    this.#sync?.(this.hasAttribute("open"), Number.isNaN(index) ? undefined : index);
  }

  #zoomAttributes(): FluidboxOptions["zoom"] | undefined {
    if (this.hasAttribute("nozoom")) return false;
    const number = (name: string) => {
      const value = Number(this.getAttribute(name));
      return this.hasAttribute(name) && Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const step = number("zoom-step");
    const max = number("zoom-max");
    return step || max ? { ...(step ? { step } : {}), ...(max ? { max } : {}) } : undefined;
  }

  /** Hand the viewer the current options. It loads the add-ons they turn on. */
  #queueUpdate() {
    if (!this.#fluidbox || this.#updateQueued) return;
    this.#updateQueued = true;
    queueMicrotask(() => {
      this.#updateQueued = false;
      if (this.isConnected) this.#fluidbox?.update(this.#options());
    });
  }

  #options() {
    const sheetElement = this.querySelector<FluidboxSheetElement>(":scope > fluidbox-sheet");
    const filmstripElement = this.querySelector<FluidboxFilmstripElement>(
      ":scope > fluidbox-filmstrip",
    );
    const filmstrip: boolean | FluidboxFilmstripOptions | undefined = filmstripElement
      ? filmstripElement.render
        ? { render: filmstripElement.render }
        : true
      : undefined;
    return {
      labels: this.#labels,
      zoom: this.zoom,
      loop: this.hasAttribute("loop"),
      loading: this.loading,
      controls: undefined,
      viewer: this.#viewerRenderer,
      filmstrip,
      sheet: sheetElement ? this.#sheetOptions(sheetElement) : undefined,
    } satisfies FluidboxUpdateOptions;
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
      this.#refreshing += 1;
      this.#refreshPromise = this.#refreshPromise
        .then(() => this.#refresh())
        .finally(() => {
          this.#refreshing -= 1;
        })
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
      this.#create(list);
      this.#itemsResult = undefined;
    } else {
      const fluidbox = this.#fluidbox;
      // Markup that compiles to the same items changes nothing. Setting them
      // anyway would restart an open or close that is under way. Items set
      // through the property always apply.
      if (this.#items || !sameItems(fluidbox.items, list)) {
        this.#itemsResult = fluidbox.setItems(list);
        await this.#itemsResult;
      }
      // A rebuild or disconnect during the update leaves nothing to bind.
      if (this.#fluidbox !== fluidbox || !this.isConnected) return;
    }
    const fluidbox = this.#fluidbox!;
    this.#bindTriggers(fluidbox);
    this.#control();
    for (const waiter of this.#readyWaiters) waiter.resolve(fluidbox);
    this.#readyWaiters = [];
  }

  #create(items: FluidboxItems) {
    const fluidbox = createFluidbox({
      ...this.#options(),
      items,
      // The origins property can change after the viewer is made.
      origins: latestOrigins(() => this.#origins),
      renderers: this.#runtimeRenderers,
    });
    this.#fluidbox = fluidbox;
    this.#sync = createFluidboxSync(fluidbox);
    this.#events = new AbortController();
    forwardEvents(fluidbox, this, this.#events.signal);
    this.#unsubscribe = fluidbox.subscribe((state) => {
      this.#keepFocus(state);
      for (const listener of this.#listeners) listener(state);
    });
  }

  #sheetOptions(element: FluidboxSheetElement): FluidboxSheetOptions<FluidboxItem> {
    const dismiss = element.getAttribute("dismiss");
    return {
      snapPoints: snapPoints(element.getAttribute("snap-points")),
      ...(dismiss === "flight" || dismiss === "scroll" || dismiss === "none" ? { dismiss } : {}),
      render: element.render ?? this.#sheetTemplate,
    };
  }

  /** Fills the sheet with the item's `<template slot="sheet">`, else the sheet's own. */
  #sheetTemplate: FluidboxRenderer<FluidboxItem> = (context) => {
    const own = this.querySelector<HTMLTemplateElement>(":scope > fluidbox-sheet > template");
    const template = this.#definitions.get(idOf(context.item))?.sheet ?? own;
    if (template) context.target.append(template.content.cloneNode(true));
  };

  /** One trigger per `<fluidbox-item>`, or per `data-fluidbox-item-id` descendant with `items` set. */
  #bindTriggers(fluidbox: Fluidbox) {
    const wanted = new Map<
      HTMLElement,
      { target: string; returns: readonly string[]; item?: FluidboxItemElement }
    >();
    if (this.#items) {
      for (const element of this.querySelectorAll<HTMLElement>("[data-fluidbox-item-id]")) {
        const returns = element.dataset.fluidboxReturns?.split(/\s+/).filter(Boolean) ?? [];
        wanted.set(element, { target: element.dataset.fluidboxItemId!, returns });
      }
    } else {
      for (const item of this.#elements()) {
        const trigger = item.trigger;
        if (trigger) wanted.set(trigger, { target: item.itemId, returns: item.returns, item });
      }
    }
    for (const [element, { trigger }] of this.#triggers) {
      if (wanted.has(element)) continue;
      trigger.destroy();
      this.#triggers.delete(element);
    }
    for (const dispose of this.#overlays) dispose();
    this.#overlays = [];
    for (const [element, { target, returns, item }] of wanted) {
      const options = {
        target,
        returns,
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
        const travel = overlay.dataset.fluidboxThumbnailOverlay === "travel";
        this.#overlays.push(
          fluidbox.bindOverlay(overlay, target, {
            returns,
            travel,
            frameLayer: travel ? frameLayerOf(overlay) : undefined,
          }),
        );
      }
    }
  }

  /**
   * Fill the viewer with the `viewer` property, else a `<template slot="viewer">`
   * (where `<fluidbox-controls>` stands for the default controls, and
   * `<fluidbox-controls zoom>` adds the zoom controls), else the default
   * controls. Buttons marked `data-fluidbox-close`, `-previous`, `-next`,
   * `-zoom-in`, `-zoom-out` or `-zoom-reset` work wherever they are.
   */
  #mountViewer(context: FluidboxViewerContext<any>) {
    const { target } = context;
    const ownerDocument = target.ownerDocument;
    const template = this.querySelector<HTMLTemplateElement>(":scope > template[slot=viewer]");
    let dispose: void | (() => void);
    // The viewer's layer expands each <fluidbox-controls> into the default buttons.
    if (this.#viewer) dispose = this.#viewer(context);
    else if (template) target.append(ownerDocument.importNode(template.content, true));
    else target.append(ownerDocument.createElement("fluidbox-controls"));
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
