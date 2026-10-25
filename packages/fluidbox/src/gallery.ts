import { createFluidboxSync } from "./controlled";
import { createFluidbox } from "./create-fluidbox";
import type * as PartsModule from "./elements-parts";
import { onDefine, registeredSlide } from "./elements-registry";
import { forwardEvents } from "./events";
import { FluidboxThumbnailsElement, FluidboxSheetElement } from "./thumbnails";
import { FluidboxItemElement, type DeclarativeFluidboxDefinition } from "./item";
import { idOf, toList } from "./items";
import { holdSlideCommit } from "./kit";
import { resolveLabels, type FluidboxLabels } from "./labels";
import type {
  Fluidbox,
  FluidboxCommandOptions,
  FluidboxEventMap,
  FluidboxThumbnailsOptions,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItems,
  FluidboxPreload,
  FluidboxOptions,
  FluidboxRenderer,
  FluidboxSlideRenderer,
  FluidboxSheet,
  FluidboxSheetOptions,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxTarget,
  FluidboxUpdateOptions,
  FluidboxValue,
  FluidboxViewerContext,
  FluidboxViewerRenderer,
  FluidboxZoomCommandOptions,
} from "./public-api";
import { FluidboxValueChangeEvent } from "./public-api";
import { latestFindTrigger } from "./origins";
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

/**
 * Attributes that change the items. A trigger's own content is the page's to
 * change, as an album cover does, so changes inside a trigger never count.
 */
const ITEM_ATTRIBUTES = new Set([
  "value",
  "data-fluidbox-value",
  "type",
  "slot",
  "placeholder",
  "caption",
  "aria-label",
]);
/** Attributes whose change updates the viewer. */
const VIEWER_ATTRIBUTES = [
  "nozoom",
  "zoom-step",
  "zoom-max",
  "zoom-click",
  "zoom-tap",
  "loop",
  "preload",
  "wheel",
];
const PRELOADS: readonly string[] = ["intent", "press", "eager"] satisfies FluidboxPreload[];
const WHEELS: readonly string[] = ["dismiss", "zoom", "navigate", "none"] satisfies NonNullable<
  FluidboxOptions["wheel"]
>[];

/** The `<fluidbox-item>` trigger an element is in, or is. */
const triggerOf = (node: Node) =>
  (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
    "fluidbox-item > [slot=trigger]",
  ) ?? null;

/** A marked overlay, but not the still copy a flight leaves on the card. */
const OVERLAY = "[data-fluidbox-trigger-overlay]:not([data-fluidbox-ghost])";

/** An overlay coming or going, but not a frame layer the flight moves out and back. */
const isOverlay = (node: Node) =>
  node instanceof Element &&
  !node.matches("[data-fluidbox-travel-layer]") &&
  (node.matches(OVERLAY) || !!node.querySelector(OVERLAY));

/** How a marked overlay goes with the flight, from its attribute. */
const overlayFlight = (overlay: HTMLElement) => {
  const flight = overlay.dataset.fluidboxTriggerOverlay;
  return flight === "copy" || flight === "frame" ? flight : "none";
};

/**
 * The parts of the viewer and slide templates, loaded once a gallery has
 * templates, so a gallery without them never loads them.
 */
type Parts = typeof PartsModule;
let parts: Parts | undefined;
let partsLoading: Promise<Parts> | undefined;
const loadParts = () =>
  (partsLoading ??= import("./elements-parts").then(
    (loaded) => (parts = loaded),
    (error: unknown) => {
      // A failed load tries again on the next viewer.
      partsLoading = undefined;
      throw error;
    },
  ));

/** Whether the fluidbox has an item of id `value`. */
function hasItem(fluidbox: Fluidbox, value: string) {
  const { items } = fluidbox;
  if (items.indexOf) return items.indexOf(value) >= 0;
  for (let at = 0; at < items.count; at++) if (idOf(items.get(at)) === value) return true;
  return false;
}

/** One factory per icon template, so the same templates make the same icons option. */
const iconFactories = new WeakMap<HTMLTemplateElement, () => Node>();

const closedState: FluidboxState = Object.freeze({
  status: "closed",
  value: null,
  index: null,
  item: null,
  count: 0,
  hasPrevious: false,
  hasNext: false,
  zoom: null,
  fullscreen: false,
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
 * with descendants marked `data-fluidbox-value` as triggers. It takes the
 * same options as createFluidbox as properties, has the same commands, and
 * fires the same events. The `value` attribute opens, moves or closes the
 * viewer when it changes.
 *
 * Children that turn features on: `<fluidbox-thumbnails>`, `<fluidbox-sheet>`
 * (each needs its entry imported), a `<template slot="viewer">` for your own
 * controls and captions, and a `<template data-fluidbox-slide="type">` for
 * the slides of an item type.
 */
export class FluidboxGalleryElement extends HTMLElement {
  static readonly observedAttributes = [...VIEWER_ATTRIBUTES, "value"];

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
  #findTrigger: FluidboxOptions["findTrigger"];
  #revealTrigger: FluidboxOptions["revealTrigger"];
  #slides: Readonly<Record<string, FluidboxSlideRenderer<any>>> = {};
  #viewer: FluidboxViewerRenderer<any> | undefined;
  #icons: FluidboxOptions["icons"];
  #labels: Partial<FluidboxLabels> | undefined;
  #zoom: FluidboxOptions["zoom"] | undefined;
  #dismiss: FluidboxOptions["dismiss"];
  #shareUrl: FluidboxOptions["shareUrl"];
  #definitions = new Map<string, DeclarativeFluidboxDefinition>();
  /** The slides of markup content, by the item type it gets. */
  #markupSlides = new Map<string, FluidboxSlideRenderer<any>>();
  /** One slide per slide template, so a template keeps its slide. */
  #templateSlides = new WeakMap<HTMLTemplateElement, FluidboxSlideRenderer<any>>();
  /**
   * The slides the viewer looks up by type as a slide mounts: the `slides`
   * property, a slide template, a slide registered for the page, then the
   * markup's own.
   */
  #slideLookup = new Proxy({} as Record<string, FluidboxSlideRenderer<any>>, {
    get: (_, type) => (typeof type === "string" ? this.#slideFor(type) : undefined),
    has: (_, type) => typeof type === "string" && !!this.#slideFor(type),
  });
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
  #readyWaiters: Array<{
    resolve(fluidbox: Fluidbox): void;
    reject(error: unknown): void;
  }> = [];
  #lifetime: AbortController | undefined;
  #updateQueued = false;
  #sync: ((value?: FluidboxValue) => void) | undefined;
  /** The `value` attribute the viewer was last brought to; undefined before the first. */
  #synced: FluidboxValue | undefined;
  /** What the items set through `items` or `setItems` came to, once applied. */
  #itemsResult: Promise<boolean> | undefined;
  /** A new function when `viewer` or the viewer template changes, so the update draws the viewer again. */
  #viewerRenderer: FluidboxViewerRenderer<any> = (context) => this.#mountViewer(context);
  #viewerTemplate: HTMLTemplateElement | null = null;
  /** The viewer was drawn before the parts arrived, so it draws again once they do. */
  #drawnWithoutParts = false;
  /** The slides changed while the viewer was open. */
  #rebuildOnClose = false;

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.#lifetime = new AbortController();
    this.addEventListener("fluidbox-addon-change", () => this.#queueUpdate(), {
      signal: this.#lifetime.signal,
    });
    // A markup reader registered later reads the items again; a slide draws them anew.
    this.#lifetime.signal.addEventListener(
      "abort",
      onDefine((kind) => (kind === "slide" ? this.#slidesChanged() : this.#queueRefresh())),
      {
        once: true,
      },
    );
    this.#observer = new MutationObserver((records) => {
      let refresh = false;
      for (const record of records) {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (
          nodes.some(
            (node) =>
              node instanceof FluidboxSheetElement ||
              node instanceof FluidboxThumbnailsElement ||
              (node instanceof HTMLTemplateElement && node.matches("[slot=viewer]")),
          )
        ) {
          this.#queueUpdate();
        }
        if (
          nodes.some(
            (node) => node instanceof Element && node.matches("template[data-fluidbox-slide]"),
          )
        )
          this.#slidesChanged();
        // The gallery's own attributes are its options and value.
        if (record.target === this && record.type === "attributes") continue;
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
    if (name !== "value") this.#queueUpdate();
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

  /** Find the trigger of an item that has none in the gallery. Read on each use. */
  get findTrigger(): FluidboxOptions["findTrigger"] {
    return this.#findTrigger;
  }

  set findTrigger(findTrigger: FluidboxOptions["findTrigger"]) {
    this.#findTrigger = findTrigger;
  }

  /** Bring an item's trigger into view. Without it, the viewer scrolls it into view. */
  get revealTrigger(): FluidboxOptions["revealTrigger"] {
    return this.#revealTrigger;
  }

  set revealTrigger(revealTrigger: FluidboxOptions["revealTrigger"]) {
    this.#revealTrigger = revealTrigger;
  }

  /**
   * The open item's id, as the `value` attribute has it, or null for closed.
   * Setting it opens, moves or closes the viewer; the viewer changing on its
   * own leaves it, as `valuechange` reports.
   */
  get value(): string | null {
    return this.getAttribute("value");
  }

  set value(value: string | null) {
    if (value === null) this.removeAttribute("value");
    else this.setAttribute("value", value);
  }

  /**
   * Slides by item type, over the gallery's slide templates and the slides
   * registered for the page. Read when a slide mounts.
   */
  get slides(): Readonly<Record<string, FluidboxSlideRenderer<any>>> {
    return this.#slides;
  }

  set slides(slides: Readonly<Record<string, FluidboxSlideRenderer<any>>>) {
    this.#slides = slides;
    this.#slidesChanged();
  }

  /** Turn off dragging to dismiss, or closing on a backdrop tap. */
  get dismiss(): FluidboxOptions["dismiss"] {
    return this.#dismiss;
  }

  set dismiss(dismiss: FluidboxOptions["dismiss"]) {
    this.#dismiss = dismiss;
    this.#queueUpdate();
  }

  /** What a wheel does, as the `wheel` attribute says: `dismiss`, `zoom`, `navigate` or `none`. */
  get wheel(): FluidboxOptions["wheel"] {
    const value = this.getAttribute("wheel") ?? "";
    return WHEELS.includes(value) ? (value as FluidboxOptions["wheel"]) : undefined;
  }

  set wheel(wheel: FluidboxOptions["wheel"]) {
    if (wheel) this.setAttribute("wheel", wheel);
    else this.removeAttribute("wheel");
  }

  /** The link Share shares for an item. Without one, Share hides. */
  get shareUrl(): FluidboxOptions["shareUrl"] {
    return this.#shareUrl;
  }

  set shareUrl(shareUrl: FluidboxOptions["shareUrl"]) {
    this.#shareUrl = shareUrl;
    this.#queueUpdate();
  }

  /** Your own controls and captions, instead of a `<template slot="viewer">` or the defaults. */
  get viewer(): FluidboxViewerRenderer<any> | undefined {
    return this.#viewer;
  }

  set viewer(viewer: FluidboxViewerRenderer<any> | undefined) {
    if (viewer === this.#viewer) return;
    this.#viewer = viewer;
    this.#viewerRenderer = (context) => this.#mountViewer(context);
    if (viewer) this.#loadParts();
    this.#queueUpdate();
  }

  /** Your icons for the default controls. They win over a `<template data-fluidbox-icon>`. */
  get icons(): FluidboxOptions["icons"] {
    return this.#icons;
  }

  set icons(icons: FluidboxOptions["icons"]) {
    this.#icons = icons;
    this.#queueUpdate();
  }

  /**
   * The icons for the default controls: each `<template data-fluidbox-icon="close">`
   * in the gallery, cloned into every button of that control, then the `icons` property.
   */
  #iconOptions(): FluidboxOptions["icons"] {
    const icons: Record<string, () => Node> = {};
    for (const template of this.querySelectorAll<HTMLTemplateElement>(
      ":scope > template[data-fluidbox-icon]",
    )) {
      let factory = iconFactories.get(template);
      if (!factory) {
        factory = () => template.content.cloneNode(true);
        iconFactories.set(template, factory);
      }
      icons[template.dataset.fluidboxIcon!] = factory;
    }
    return { ...icons, ...this.#icons };
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

  /** When the viewer's code loads, as the `preload` attribute says: `intent` (the default), `press` or `eager`. */
  #preload(): FluidboxPreload {
    const value = this.getAttribute("preload") ?? "";
    return PRELOADS.includes(value) ? (value as FluidboxPreload) : "intent";
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

  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.zoomReset(options));
  }

  /** Enter or leave full screen; without an argument, switch. */
  setFullscreen(on?: boolean): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.setFullscreen(on));
  }

  /** Save the item on show's file. */
  download(): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.download());
  }

  /** Share the item on show's link, or copy it. */
  share(): Promise<boolean> {
    return this.#run((fluidbox) => fluidbox.share());
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

  /**
   * Bring the viewer to the `value` attribute when it changed: a request, as
   * a binding's `value` is, so a viewer that moved on its own stays. A value
   * counts as used once it found its item, or closed: one that names no item
   * yet, as items set after the gallery connects, waits for them.
   */
  #control() {
    const fluidbox = this.#fluidbox;
    const value = this.getAttribute("value");
    if (!fluidbox || value === this.#synced) return;
    if (value !== null && !hasItem(fluidbox, value)) {
      // With no items yet there is nothing to tell; with some, it counts as null.
      if (fluidbox.items.count) this.#sync?.(value);
      return;
    }
    this.#synced = value;
    this.#sync?.(value);
  }

  #zoomAttributes(): FluidboxOptions["zoom"] | undefined {
    if (this.hasAttribute("nozoom")) return false;
    const number = (name: string) => {
      const value = Number(this.getAttribute(name));
      return this.hasAttribute(name) && Number.isFinite(value) && value > 0 ? value : undefined;
    };
    // `off` is false; anything else it doesn't name leaves the default.
    const mode = <T extends string>(name: string, modes: readonly T[]) => {
      const value = this.getAttribute(name);
      return value === "off" ? false : modes.find((each) => each === value);
    };
    const zoom = {
      step: number("zoom-step"),
      max: number("zoom-max"),
      click: mode("zoom-click", ["single", "double"] as const),
      tap: mode("zoom-tap", ["double"] as const),
    };
    const given = Object.entries(zoom).filter(([, value]) => value !== undefined);
    return given.length ? Object.fromEntries(given) : undefined;
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
    const thumbnailsElement = this.querySelector<FluidboxThumbnailsElement>(
      ":scope > fluidbox-thumbnails",
    );
    const thumbnails: boolean | FluidboxThumbnailsOptions | undefined = thumbnailsElement
      ? thumbnailsElement.render
        ? { render: thumbnailsElement.render }
        : true
      : undefined;
    // Without content of yours, the viewer draws Previous, Next and Close.
    const template = this.querySelector<HTMLTemplateElement>(":scope > template[slot=viewer]");
    if (template !== this.#viewerTemplate) {
      this.#viewerTemplate = template;
      this.#viewerRenderer = (context) => this.#mountViewer(context);
    }
    return {
      labels: this.#labels,
      zoom: this.zoom,
      loop: this.hasAttribute("loop"),
      preload: this.#preload(),
      controls: undefined,
      icons: this.#iconOptions(),
      viewer: this.#viewer || template ? this.#viewerRenderer : undefined,
      thumbnails,
      sheet: sheetElement ? this.#sheetOptions(sheetElement) : undefined,
      dismiss: this.#dismiss,
      wheel: this.wheel,
      shareUrl: this.#shareUrl,
    } satisfies FluidboxUpdateOptions;
  }

  /**
   * The viewer keeps the slides it drew, so new ones take a new viewer: at
   * once while closed, else as it closes. It keeps the value it had.
   */
  #slidesChanged() {
    const fluidbox = this.#fluidbox;
    if (!fluidbox) return;
    if (fluidbox.state.status !== "closed") {
      this.#rebuildOnClose = true;
      return;
    }
    this.#rebuildOnClose = false;
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
        new FluidboxValueChangeEvent("valuechange", {
          value: null,
          previousValue: dropped.value,
          index: null,
          item: null,
          action: "close",
          reason: "api",
        }),
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

  #slideFor(type: string): FluidboxSlideRenderer<any> | undefined {
    if (Object.hasOwn(this.#slides, type)) return this.#slides[type];
    const template = Array.from(
      this.querySelectorAll<HTMLTemplateElement>("template[data-fluidbox-slide]"),
    ).find(
      (each) => each.dataset.fluidboxSlide === type && each.closest("fluidbox-gallery") === this,
    );
    if (template) {
      let slide = this.#templateSlides.get(template);
      if (!slide) {
        let stamp: FluidboxSlideRenderer<any> | undefined;
        const stamped = (loaded: Parts) =>
          (stamp ??= loaded.templateSlide(template, () => this.#partsContext()));
        slide = (each) => {
          if (parts) return stamped(parts)(each);
          // An open that beats the parts waits for them, as for a framework's render.
          const release = holdSlideCommit(each);
          let dispose: void | (() => void);
          void loadParts().then((loaded) => {
            if (!each.signal.aborted) dispose = stamped(loaded)(each);
            release();
          }, release);
          return () => {
            release();
            dispose?.();
          };
        };
        this.#templateSlides.set(template, slide);
      }
      return slide;
    }
    return registeredSlide(type) ?? this.#markupSlides.get(type);
  }

  /** Load the parts for a gallery that has templates or viewer content of its own. */
  #loadParts() {
    if (parts) return;
    void loadParts().then(
      () => {
        if (!this.#drawnWithoutParts) return;
        this.#drawnWithoutParts = false;
        this.#viewerRenderer = (context) => this.#mountViewer(context);
        this.#queueUpdate();
      },
      () => {},
    );
  }

  /** What the parts in the viewer template and the slide templates draw with. */
  #partsContext() {
    return {
      fluidbox: this.#fluidbox!,
      labels: resolveLabels(this.#labels),
      icons: this.#iconOptions(),
    };
  }

  #elements() {
    return Array.from(this.children).filter(
      (child): child is FluidboxItemElement => child instanceof FluidboxItemElement,
    );
  }

  async #refresh() {
    if (this.querySelector(":scope > template[slot=viewer], template[data-fluidbox-slide]"))
      this.#loadParts();
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
    // An array goes as it is, so the fluidbox can tell equal items from new ones.
    const given = Array.isArray(items) ? items : list;
    this.#definitions = definitions;
    this.#markupSlides = new Map(
      Array.from(definitions.values(), (definition) => definition.renderer).filter(
        (renderer) => !!renderer,
      ),
    );
    if (!this.#fluidbox) {
      this.#create(given);
      this.#itemsResult = undefined;
    } else {
      const fluidbox = this.#fluidbox;
      // Markup that compiles to the same items changes nothing. Setting them
      // anyway would restart an open or close that is under way. Items set
      // through the property always apply.
      if (this.#items || !sameItems(fluidbox.items, list)) {
        this.#itemsResult = fluidbox.setItems(given);
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
    // The findTrigger and revealTrigger properties can change after the viewer is made.
    const fluidbox = createFluidbox(
      latestFindTrigger({ ...this.#options(), items, slides: this.#slideLookup }, () => ({
        findTrigger: this.#findTrigger,
        revealTrigger: this.#revealTrigger,
      })),
    );
    this.#fluidbox = fluidbox;
    this.#sync = createFluidboxSync(fluidbox);
    // A gallery moved in the page keeps the viewer as it was: the value it
    // already used, or a change to it that was canceled, isn't asked again.
    this.#events = new AbortController();
    forwardEvents(fluidbox, this, this.#events.signal);
    this.#unsubscribe = fluidbox.subscribe((state) => {
      this.#keepFocus(state);
      if (this.#rebuildOnClose && state.status === "closed")
        queueMicrotask(() => this.#slidesChanged());
      for (const listener of this.#listeners) listener(state);
    });
  }

  #sheetOptions(element: FluidboxSheetElement): FluidboxSheetOptions<FluidboxItem> {
    const dismissMotion = element.getAttribute("dismiss-motion");
    return {
      snapPoints: snapPoints(element.getAttribute("snap-points")),
      ...(dismissMotion === "flight" || dismissMotion === "scroll" ? { dismissMotion } : {}),
      render: element.render ?? this.#sheetTemplate,
    };
  }

  /** Fills the sheet with the item's `<template slot="sheet">`, else the sheet's own. */
  #sheetTemplate: FluidboxRenderer<FluidboxItem> = (context) => {
    const own = this.querySelector<HTMLTemplateElement>(":scope > fluidbox-sheet > template");
    const template = this.#definitions.get(idOf(context.item))?.sheet ?? own;
    if (template) context.target.append(template.content.cloneNode(true));
  };

  /** One trigger per `<fluidbox-item>`, or per `data-fluidbox-value` descendant with `items` set. */
  #bindTriggers(fluidbox: Fluidbox) {
    const wanted = new Map<
      HTMLElement,
      { target: string; returns: readonly string[]; item?: FluidboxItemElement }
    >();
    if (this.#items) {
      for (const element of this.querySelectorAll<HTMLElement>("[data-fluidbox-value]")) {
        // An id, or ids separated by spaces: the first opens, every one closes back here.
        const [target, ...returns] = element.dataset.fluidboxValue!.split(/\s+/).filter(Boolean);
        if (target) wanted.set(element, { target, returns });
      }
    } else {
      for (const item of this.#elements()) {
        const trigger = item.trigger;
        const [target, ...returns] = item.ids;
        if (trigger) wanted.set(trigger, { target: target!, returns, item });
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
      const value = [target, ...returns];
      const options = {
        value,
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
      // The still copy a flight leaves on the card is never an overlay of its own.
      for (const overlay of element.querySelectorAll<HTMLElement>(OVERLAY)) {
        this.#overlays.push(
          fluidbox.bindOverlay(overlay, value, { flight: overlayFlight(overlay) }),
        );
      }
    }
  }

  /**
   * Fill the viewer with the `viewer` property, else a `<template slot="viewer">`.
   * Its parts expand: `<fluidbox-toolbar>` stands for Previous, Next and
   * Close, `<fluidbox-zoom-controls>` for the zoom controls, and so on.
   * Buttons marked `data-fluidbox-close`, `-previous`, `-next`, `-zoom-in`,
   * `-zoom-out`, `-zoom-reset`, `-retry` and the rest work wherever they are.
   */
  #mountViewer(context: FluidboxViewerContext<any>) {
    const { target, signal } = context;
    let dispose: void | (() => void);
    if (this.#viewer) dispose = this.#viewer(context);
    else if (this.#viewerTemplate) {
      target.append(target.ownerDocument.importNode(this.#viewerTemplate.content, true));
    }
    if (parts) parts.expandParts(target, { ...this.#partsContext(), signal });
    else {
      // Draw it again once the parts arrive, which a gallery with templates
      // started loading as it connected.
      this.#drawnWithoutParts = true;
      this.#loadParts();
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
