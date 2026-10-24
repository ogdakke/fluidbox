import { addon, loadAddons, type Addon } from "./addons";
import { hostKey, type FluidboxHost } from "./host";
import { idOf, idsIn, sameItems, targetKey, targetKeys, toList, toSource } from "./items";
import { resolveLabels, type FluidboxLabels } from "./labels";
import type { DomViewerDriver } from "./dom-viewer-driver";
import { publishOverlayPhase, resetOverlayPhase } from "./overlay-phase";
import { OriginRegistry } from "./origin-registry";
import {
  FluidboxValueChangeEvent,
  type Fluidbox,
  type FluidboxBindOptions,
  type FluidboxCommandOptions,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxPreload,
  type FluidboxOptions,
  type FluidboxOverlayOptions,
  type FluidboxReason,
  type FluidboxSheet,
  type FluidboxState,
  type FluidboxStatus,
  type FluidboxTarget,
  type FluidboxTriggerValue,
  type FluidboxUpdateOptions,
  type FluidboxValue,
  type FluidboxValueChangeAction,
  type FluidboxZoomCommandOptions,
  type FluidboxZoomState,
  FluidboxSheetEvent,
  FluidboxZoomEvent,
} from "./public-api";
import type {
  FluidboxDispose,
  FluidboxExtension,
  FluidboxItemId,
  FluidboxOrigin,
  FluidboxOriginAdapter,
  FluidboxViewerLayer,
  FluidboxSource,
  FluidboxThumbnailOverlayRegistration,
  SessionChangeReason,
  SessionCommandOptions,
  SessionCommandResult,
  SessionController,
  SessionReason,
  SessionTarget,
  ViewerGestures,
  ViewerSessionMotionContext,
} from "./runtime-types";
import { bindTrigger, resolveOrigin } from "./trigger";

const defaultControls = ["previous", "next", "close"] as const;
/** The factor of zoomIn, zoomOut and the zoom controls, as of the + and - keys. */
const ZOOM_FACTOR = 1.5;

const reasonOf = (reason: SessionChangeReason | FluidboxReason): FluidboxReason =>
  reason === "source-update" || reason === "source-empty" ? "items" : reason;

/**
 * Report a host callback's error as an uncaught one would be, without letting it
 * stop the command that called it.
 */
function report(error: unknown) {
  if (typeof reportError === "function") reportError(error);
  else
    queueMicrotask(() => {
      throw error;
    });
}

const happened = (result: SessionCommandResult) => result.status === "completed";
const completed = (changed: boolean): SessionCommandResult => ({ status: "completed", changed });
const prevented = (): SessionCommandResult => ({ status: "prevented" });
const aborted = (): SessionCommandResult => ({ status: "aborted" });

interface PendingCommand {
  readonly key: string;
  readonly controller: AbortController;
  readonly promise: Promise<SessionCommandResult>;
  resolve(result: SessionCommandResult): void;
  reject(error: unknown): void;
  settled: boolean;
  /** A scrub's move, which leaves the trigger out of view until a move ends it. */
  scrub?: boolean;
  restore?: () => void;
  removeExternalAbort?: () => void;
}

/** One overlay on one item's trigger. A trigger can have several, side by side. */
interface OverlayRegistration<TItem extends FluidboxItem> {
  readonly id: FluidboxItemId;
  readonly registration: FluidboxThumbnailOverlayRegistration<TItem>;
  /** Its registration with the viewer, once there is one. */
  dispose?: FluidboxDispose | void;
}

/** The viewer the fluidbox drives: the DOM viewer, or a stand-in in tests. */
export type FluidboxRuntimeDriver<TItem extends FluidboxItem> = Pick<
  DomViewerDriver<TItem>,
  keyof DomViewerDriver<TItem>
>;

/** The gestures that close the viewer, and what the wheel does, with their defaults. */
function gesturesOf({
  dismiss,
  wheel,
}: Pick<FluidboxOptions, "dismiss" | "wheel">): ViewerGestures {
  return {
    dismiss: { drag: dismiss?.drag ?? true, backdrop: dismiss?.backdrop ?? true },
    wheel: wheel ?? "dismiss",
  };
}

/** Options objects with the same members, so a binding may pass a fresh literal each render. */
function sameOptions(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => {
      const left = (a as Record<string, unknown>)[key];
      const right = (b as Record<string, unknown>)[key];
      return Array.isArray(left) && Array.isArray(right)
        ? left.length === right.length && left.every((each, index) => each === right[index])
        : left === right;
    })
  );
}

type Settings<TItem extends FluidboxItem> = Pick<
  FluidboxOptions<TItem>,
  "controls" | "icons" | "viewer" | "thumbnails" | "sheet"
>;

/**
 * Create a fluidbox: a viewer at the end of `<body>`, and the commands, state and
 * events that drive it. Browser only. Throws a TypeError for an array of items
 * with an empty id or a duplicate of one an item names itself by.
 */
export function createFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxOptions<TItem>,
): Fluidbox<TItem> {
  return new FluidboxRuntime(options);
}

/**
 * The fluidbox: its state and commands, which a driver paints. It has no
 * custom-element dependency; the driver owns the portal DOM and the motion.
 */
export class FluidboxRuntime<TItem extends FluidboxItem>
  extends EventTarget
  implements Fluidbox<TItem>
{
  /**
   * The viewer, which loads on a trigger's press or the first open rather than
   * with the page, so its gestures, transitions, slides and portal cost nothing until then.
   */
  #viewer: FluidboxRuntimeDriver<TItem> | undefined;
  #viewerLoad: Promise<FluidboxRuntimeDriver<TItem> | undefined> | undefined;
  /** Counts unloads, so a load that an unload overtook makes no viewer. */
  #generation = 0;
  #listening = false;
  #zoom: FluidboxOptions<TItem>["zoom"];
  #loop: boolean;
  readonly #slides: FluidboxOptions<TItem>["slides"];
  readonly #controls: SessionController<TItem> = this.#controller();
  /** Changed in place by update, so every part of the viewer reads the new strings. */
  readonly #labels: FluidboxLabels;
  #settings: Settings<TItem>;
  #preload: FluidboxPreload = "intent";
  readonly #lifetime = new AbortController();
  readonly #bindings = new Set<() => void>();
  /** Re-resolve each binding's targets after the items change. */
  readonly #refreshers = new Set<() => void>();
  #sheet: Addon<FluidboxSheet> | undefined;
  #thumbnails: Addon<null> | undefined;
  /** The add-on entries the settings need, while they load. Opening waits for them. */
  #addonsLoading: Promise<void> | undefined;
  #list: FluidboxItemList<TItem>;
  /** A copy of the array the list was made from, so equal items change nothing. */
  #array: readonly TItem[] | undefined;
  #source: FluidboxSource<TItem>;
  #state: FluidboxState<TItem>;
  readonly #origins: OriginRegistry;
  readonly #listeners = new Set<(state: FluidboxState<TItem>) => void>();
  readonly #overlays = new Set<OverlayRegistration<TItem>>();
  #pending: PendingCommand | undefined;
  #revealController: AbortController | undefined;
  /** The item whose origin the user last saw: the one opened or last revealed. */
  #revealedId: string | undefined;
  #sourceRefreshPending = false;
  /** The value the last valuechange announced, so a rolled-back command announces its way back. */
  #announced: FluidboxValue = null;
  /** The reason of the request whose status change comes next. */
  #reason: FluidboxReason = "api";
  /** The scale the zoom last rested at, and the item it belongs to. */
  #zoomScale = 1;
  #zoomId: string | null = null;
  /** Whether the viewer is the document's fullscreen element, as it last said. */
  #fullscreen = false;
  #gestures: ViewerGestures;
  #shareUrl: FluidboxOptions<TItem>["shareUrl"];
  readonly [hostKey]: FluidboxHost;

  constructor(options: FluidboxOptions<TItem>, driver?: FluidboxRuntimeDriver<TItem>) {
    super();
    this.#list = toList(options.items);
    this.#array = Array.isArray(options.items)
      ? [...(options.items as readonly TItem[])]
      : undefined;
    this.#source = toSource(this.#list);
    this.#labels = { ...resolveLabels(options.labels) };
    const { sheet, thumbnails, controls, icons, viewer } = options;
    this.#settings = { sheet, thumbnails, controls, icons, viewer };
    this.#origins = new OriginRegistry(this.#triggerAdapter(options));
    this.#zoom = options.zoom;
    this.#loop = !!options.loop;
    this.#slides = options.slides;
    this.#gestures = gesturesOf(options);
    this.#shareUrl = options.shareUrl;
    this.#state = this.#stateFor("closed", null);
    this[hostKey] = this.#host();
    this.#makeAddons();
    if (driver) this.#attach(driver);
    this.#setPreload(options.preload);
    // A deep link opens as a viewer the server rendered does: without motion.
    const value = options.value;
    if (value != null && this.#source.getIndex(value) !== null && typeof document !== "undefined") {
      queueMicrotask(() => void this.#command("open", value, "api", { instant: true }));
    }
  }

  #setPreload(preload: FluidboxPreload | undefined) {
    this.#preload = preload ?? "intent";
    // Browsers without idle callbacks load on the next task.
    if (this.#preload !== "eager" || this.#viewer || typeof window === "undefined") return;
    const idle = window.requestIdleCallback ?? setTimeout;
    idle(() => void this.load());
  }

  /** Give a new viewer what it would have seen, had it been there from the start. */
  #attach(viewer: FluidboxRuntimeDriver<TItem>) {
    viewer.setLoop(this.#loop);
    viewer.setGestures(this.#gestures);
    viewer.setSource(this.#source);
    viewer.connect(this.#controls, this.#portal(), this.#extensions());
    for (const overlay of this.#overlays) {
      overlay.dispose = viewer.registerThumbnailOverlay(overlay.id, overlay.registration);
    }
    this.#viewer = viewer;
  }

  #loadViewer() {
    if (this.#viewer) return Promise.resolve(this.#viewer);
    const generation = this.#generation;
    this.#viewerLoad ??= import("./dom-viewer-driver").then(
      ({ DomViewerDriver }) => {
        if (this.#lifetime.signal.aborted || generation !== this.#generation) return undefined;
        this.#attach(new DomViewerDriver<TItem>(document, this.#zoom, this.#slides, this.#labels));
        return this.#viewer;
      },
      (error: unknown) => {
        // A failed load, as when offline, tries again on the next press or open.
        if (generation === this.#generation) this.#viewerLoad = undefined;
        throw error;
      },
    );
    return this.#viewerLoad;
  }

  #openViewer(context: ViewerSessionMotionContext<TItem>) {
    if (this.#viewer) return this.#viewer.open(context);
    // The card's image is hidden now; keep it painted while the viewer loads.
    const thumbnail = context.origin?.thumbnail;
    if (thumbnail) thumbnail.dataset.fluidboxThumbnailCrossfade = "";
    const loading = this.#loadViewer();
    this.#listenWhileLoading(loading);
    return loading.then((viewer) => {
      if (viewer && !context.signal.aborted) return viewer.open(context);
      if (thumbnail) delete thumbnail.dataset.fluidboxThumbnailCrossfade;
      return undefined;
    });
  }

  /** Keys pressed while the viewer loads act as they would on an opening viewer. */
  #listenWhileLoading(loading: Promise<unknown>) {
    if (this.#listening) return;
    this.#listening = true;
    const waiting = new AbortController();
    document.addEventListener(
      "keydown",
      (event) => {
        const options = { reason: "keyboard" } as const;
        if (event.key === "Escape") void this.#close(options);
        else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          // The viewer reads in the direction of whatever holds focus, the trigger.
          const source = event.target instanceof Element ? event.target : document.documentElement;
          const rtl = getComputedStyle(source).direction === "rtl";
          void this.#step((event.key === "ArrowRight") !== rtl ? "next" : "previous", options);
        } else return;
        event.preventDefault();
      },
      { capture: true, signal: waiting.signal },
    );
    const stop = () => {
      this.#listening = false;
      waiting.abort();
    };
    loading.then(stop, stop);
  }

  /** The viewer's layer: the default controls, then your viewer content. */
  #portal(): FluidboxViewerLayer {
    const { controls, icons, viewer } = this.#settings;
    // The defaults until you draw your own viewer, and Close after, until it
    // draws its own: the one way out a screen reader's touch can count on.
    const shown = controls ?? (viewer ? (["close"] as const) : true);
    const names = shown === true ? defaultControls : shown || [];
    return { fluidbox: this, controls: names, viewer, labels: this.#labels, icons };
  }

  /** What the viewer and its add-ons drive this fluidbox with. */
  #controller(): SessionController<TItem> {
    const state = () => this.#state;
    return {
      get state() {
        return state();
      },
      close: (options = {}) => this.#close(options),
      goTo: (target, options = {}) => this.#goTo(target, options),
      next: (options = {}) => this.#step("next", options),
      previous: (options = {}) => this.#step("previous", options),
      allows: (target, reason) => this.#allowed("goTo", target, reason),
      subscribe: (listener) => this.subscribe(listener),
      zoomed: (scale, reason) => this.#zoomed(scale, reason),
      zoomableChanged: () => {
        const { status, index, item, zoom } = this.#state;
        const next = this.#zoomFor(status, index, item);
        if (next?.max !== zoom?.max || !next !== !zoom) this.#publish(status, index);
      },
      fullscreenChanged: (on) => {
        if (on === this.#fullscreen) return;
        this.#fullscreen = on;
        this.#publish(this.#state.status, this.#state.index);
      },
      mediaError: (event) => void this.dispatchEvent(event),
    };
  }

  /** Make the add-ons the settings turn on. Their entries load on first use. */
  #makeAddons() {
    const { sheet, thumbnails } = this.#settings;
    const loading = loadAddons([
      ...(sheet ? (["sheet"] as const) : []),
      ...(thumbnails ? (["thumbnails"] as const) : []),
    ]);
    if (loading) {
      // The latest load makes the add-ons of the settings it finds, which a
      // later update may have changed without loading anything new.
      const done: Promise<void> = loading.then(
        () => {
          if (this.#addonsLoading !== done || this.#lifetime.signal.aborted) return;
          this.#makeAddons();
          this.#viewer?.setExtensions(this.#extensions());
        },
        // A failed load, as when offline, opens without them and tries again on the next update.
        (error: unknown) => {
          if (this.#addonsLoading === done) this.#addonsLoading = undefined;
          throw error;
        },
      );
      this.#addonsLoading = done;
      return;
    }
    this.#addonsLoading = undefined;
    this.#sheet = sheet
      ? addon("sheet")(sheet === true ? {} : sheet, (stop, reason) => {
          this.dispatchEvent(new FluidboxSheetEvent("sheetchange", { snap: stop, reason }));
        })
      : undefined;
    this.#thumbnails = thumbnails
      ? addon("thumbnails")(thumbnails === true ? {} : thumbnails)
      : undefined;
  }

  #extensions() {
    return [
      this.#thumbnails?.extension as FluidboxExtension<TItem> | undefined,
      this.#sheet?.extension as FluidboxExtension<TItem> | undefined,
    ];
  }

  update(options: FluidboxUpdateOptions<TItem>) {
    if (this.#lifetime.signal.aborted) return;
    const has = (key: keyof FluidboxUpdateOptions<TItem>) => Object.hasOwn(options, key);
    const previous = this.#settings;
    const next: Settings<TItem> = {
      controls: has("controls") ? options.controls : previous.controls,
      icons: has("icons") ? options.icons : previous.icons,
      viewer: has("viewer") ? options.viewer : previous.viewer,
      thumbnails: has("thumbnails") ? options.thumbnails : previous.thumbnails,
      sheet: has("sheet") ? options.sheet : previous.sheet,
    };
    this.#settings = next;
    if (has("preload")) this.#setPreload(options.preload);
    if (has("shareUrl")) this.#shareUrl = options.shareUrl;
    if (has("dismiss") || has("wheel")) {
      this.#gestures = gesturesOf({
        dismiss: has("dismiss") ? options.dismiss : this.#gestures.dismiss,
        wheel: has("wheel") ? options.wheel : this.#gestures.wheel,
      });
      this.#viewer?.setGestures(this.#gestures);
      // A sheet reads whether a drag may close as it mounts.
      if (has("dismiss") && !this.#addonsLoading) this.#viewer?.setExtensions(this.#extensions());
    }
    if (has("zoom")) {
      this.#zoom = options.zoom;
      this.#viewer?.setZoom(options.zoom);
      // The zoom state may gain, lose or change its bounds.
      const { status, index, item, zoom } = this.#state;
      if (this.#zoomFor(status, index, item)?.max !== zoom?.max) this.#publish(status, index);
    }
    if (has("loop") && !!options.loop !== this.#loop) {
      this.#loop = !!options.loop;
      this.#viewer?.setLoop(this.#loop);
      // The ends gain or lose their neighbours.
      this.#publish(this.#state.status, this.#state.index);
    }
    let relabeled = false;
    if (has("labels")) {
      const labels = resolveLabels(options.labels);
      relabeled = Object.entries(labels).some(
        ([key, value]) => this.#labels[key as keyof FluidboxLabels] !== value,
      );
      if (relabeled) {
        Object.assign(this.#labels, labels);
        this.#viewer?.relabel();
      }
    }
    if (
      relabeled ||
      !sameOptions(next.controls, previous.controls) ||
      !sameOptions(next.icons, previous.icons) ||
      next.viewer !== previous.viewer
    ) {
      this.#viewer?.setPortal(this.#portal());
    }
    if (
      !sameOptions(next.thumbnails, previous.thumbnails) ||
      !sameOptions(next.sheet, previous.sheet)
    ) {
      // The outgoing sheet announces its return to rest as it is torn down.
      this.#makeAddons();
      if (!this.#addonsLoading) this.#viewer?.setExtensions(this.#extensions());
    }
  }

  get state() {
    return this.#state;
  }

  get items() {
    return this.#list;
  }

  get sheet() {
    return this.#sheet?.handle ?? null;
  }

  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions) {
    return this.#command("open", target, "api", options);
  }

  close(options?: FluidboxCommandOptions) {
    return this.#command("close", undefined, "api", options);
  }

  zoomTo(scale: number, options?: FluidboxZoomCommandOptions) {
    if (!Number.isFinite(scale)) {
      return Promise.reject(new RangeError(`Fluidbox zoom scale must be finite: ${scale}`));
    }
    return this.#zoomCommand(() => scale, "api", options);
  }

  zoomIn(options?: FluidboxZoomCommandOptions) {
    return this.#zoomCommand((from) => from * ZOOM_FACTOR, "api", options);
  }

  zoomOut(options?: FluidboxZoomCommandOptions) {
    return this.#zoomCommand((from) => from / ZOOM_FACTOR, "api", options);
  }

  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">) {
    return this.#zoomCommand(() => 1, "api", options);
  }

  #zoomCommand(
    /** The scale to zoom to, from the one the zoom rests at or is heading to. */
    scale: (from: number) => number,
    reason: "api" | "keyboard" | "pointer",
    options: FluidboxZoomCommandOptions = {},
  ): Promise<boolean> {
    const zoom = this.#state.zoom;
    if (this.#lifetime.signal.aborted || !zoom || !this.#viewer || options.signal?.aborted) {
      return Promise.resolve(false);
    }
    // A zoom under way counts as where it is heading, so steps in quick succession add up.
    const from = this.#viewer.zoomGoal() ?? zoom.scale;
    const target = Math.max(zoom.min, Math.min(zoom.max, scale(from)));
    return this.#viewer.zoomTo(target, { ...options, reason });
  }

  /** The zoom came to rest at another scale on the item on show. */
  #zoomed(scale: number, reason: FluidboxReason | undefined) {
    this.#zoomId = this.#state.value;
    if (scale === this.#zoomScale) return;
    this.#zoomScale = scale;
    if (this.#state.zoom && this.#state.zoom.scale !== scale) {
      this.#publish(this.#state.status, this.#state.index);
    }
    this.dispatchEvent(
      new FluidboxZoomEvent("zoomchange", { scale, reason: reason ?? this.#reason }),
    );
  }

  /** The zoom of the item on show: open on a box that zooms, with zoom on. */
  #zoomFor(
    status: FluidboxStatus,
    index: number | null,
    item: TItem | null,
  ): FluidboxZoomState | null {
    if (status !== "open" || index === null || !item || this.#zoom === false) return null;
    // The viewer knows whether the box on show zooms; until it is on the item, an image does.
    const box = this.#viewer?.zoomable(index) ?? (item.type === "image" ? {} : null);
    if (!box) return null;
    // The scale belongs to the item it rested on; another item starts fitted.
    const scale = this.#zoomId === idOf(item) ? this.#zoomScale : 1;
    return Object.freeze({ scale, min: 1, max: box.max ?? this.#zoom?.max ?? 4 });
  }

  setFullscreen(on?: boolean) {
    if (this.#state.status !== "open" || !this.#viewer) return Promise.resolve(false);
    return this.#viewer.setFullscreen(on ?? !this.#fullscreen);
  }

  download() {
    const item = this.#state.item;
    if (this.#state.status !== "open" || !item || !this.#viewer) return Promise.resolve(false);
    return this.#viewer.download(item);
  }

  share() {
    const item = this.#state.item;
    const url = item && this.#shareLink(item);
    if (this.#state.status !== "open" || !url || !this.#viewer) return Promise.resolve(false);
    return this.#viewer.share(item, url);
  }

  /** The link Share shares, resolved against the page; undefined when there is none. */
  #shareLink(item: TItem) {
    const url = this.#shareUrl?.(item);
    return url ? new URL(url, location.href).href : undefined;
  }

  next(options?: FluidboxCommandOptions) {
    return this.#command("next", undefined, "api", options);
  }

  previous(options?: FluidboxCommandOptions) {
    return this.#command("previous", undefined, "api", options);
  }

  setItems(items: FluidboxItems<TItem>) {
    this.#assertAlive();
    // The same items in a new array, as a binding re-rendering
    // `items={products.map(toItem)}` passes, change nothing: they neither
    // interrupt a move nor rebuild a slide. A lazy list always applies.
    const array = Array.isArray(items) ? [...(items as readonly TItem[])] : undefined;
    if (array && this.#array && sameItems(array, this.#array)) return Promise.resolve(false);
    this.#list = toList(items);
    this.#array = array;
    // A close this update causes is reported with the reason "items".
    this.#reason = "items";
    const result = this.#setSource(toSource(this.#list));
    // The new ids are known now, so bindings can register them.
    for (const refresh of this.#refreshers) refresh();
    return result.then(happened);
  }

  preload(target: FluidboxTarget<TItem>) {
    this.#assertAlive();
    const index = this.#resolve(this.#target(target));
    if (index instanceof RangeError) throw index;
    if (this.#state.status !== "closed") return () => {};
    const item = this.#source.getItem(index);
    const context = { item, index, origin: this.#origins.get(idOf(item)) };
    if (this.#viewer) return this.#viewer.prepare(context);
    // Code that arrives during the press only loads: the page changing as a tap
    // ends can cost the tap its click. The open that follows does the rest.
    void this.load();
    return () => {};
  }

  load() {
    if (this.#lifetime.signal.aborted) return Promise.resolve(false);
    return this.#loadViewer().then(
      (viewer) => !!viewer,
      () => false,
    );
  }

  /**
   * Origins for items without a bound trigger, from the options' `findTrigger`
   * and `revealTrigger`, read on each use.
   */
  #triggerAdapter(options: FluidboxOptions<TItem>): FluidboxOriginAdapter {
    const item = (id: string) => {
      const index = this.#source.getIndex(id);
      return index === null ? null : { item: this.#source.getItem(index), index };
    };
    return {
      getOrigin: (id) => {
        const find = options.findTrigger;
        const found = find && item(id);
        const trigger = found ? find(found.item, found.index) : null;
        return trigger ? resolveOrigin(trigger) : null;
      },
      get revealOrigin(): FluidboxOriginAdapter["revealOrigin"] {
        const reveal = options.revealTrigger;
        if (!reveal) return undefined;
        return (id, index, context) => {
          const found = item(id);
          return found ? reveal(found.item, index, context) : undefined;
        };
      },
    };
  }

  bind(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options: FluidboxBindOptions<TItem> = {},
  ) {
    // Before anything is attached, so a destroyed fluidbox holds no listeners.
    this.#assertAlive();
    const trigger = bindTrigger(this, element, {
      value,
      onPreviewChange: options.onPreviewChange,
    });
    const refresh = () => trigger.refresh();
    this.#refreshers.add(refresh);
    return this.#keep(() => {
      this.#refreshers.delete(refresh);
      trigger.destroy();
    }, options.signal);
  }

  bindControl(
    element: HTMLElement,
    name: FluidboxControlName,
    options: { readonly signal?: AbortSignal } = {},
  ) {
    this.#assertAlive();
    // The control code loads on first use, so a page that binds none skips it.
    let release: (() => void) | undefined;
    let released = false;
    void import("./control-wiring").then(({ bindControl }) => {
      if (!released) release = bindControl(this, element, name);
    });
    return this.#keep(() => {
      released = true;
      release?.();
    }, options.signal);
  }

  bindOverlay(
    element: HTMLElement,
    value: FluidboxTriggerValue<TItem>,
    options: FluidboxOverlayOptions<TItem> = {},
  ) {
    this.#assertAlive();
    const { flight = "none" } = options;
    const registration: FluidboxThumbnailOverlayRegistration<TItem> =
      flight === "frame"
        ? { behavior: "frame", element }
        : flight === "none"
          ? { behavior: "host", element }
          : {
              behavior: "travel",
              element,
              renderer:
                flight === "copy"
                  ? ({ target: frame }) => {
                      frame.append(...[...element.childNodes].map((node) => node.cloneNode(true)));
                      return () => frame.replaceChildren();
                    }
                  : flight.live,
            };
    const targets = targetKeys(value);
    for (const each of targets) {
      if (typeof each === "string" ? !each : !Number.isInteger(each) || each < 0) {
        throw new RangeError(`Not a fluidbox item target: ${String(each)}`);
      }
    }
    // Ids may arrive with later items.
    const registered = new Map<string, () => void>();
    const rebind = () => {
      const wanted = new Set(idsIn(this.#list, targets));
      for (const [id, dispose] of registered) {
        if (wanted.has(id)) continue;
        dispose();
        registered.delete(id);
      }
      for (const id of wanted) {
        if (!registered.has(id)) registered.set(id, this.#registerOverlay(id, registration));
      }
    };
    rebind();
    this.#refreshers.add(rebind);
    return this.#keep(() => {
      this.#refreshers.delete(rebind);
      for (const dispose of registered.values()) dispose();
      registered.clear();
    }, options.signal);
  }

  subscribe(listener: (state: FluidboxState<TItem>) => void) {
    this.#assertAlive();
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  destroy() {
    if (this.#lifetime.signal.aborted) return;
    // Closed at once, so the state, the toggle and every subscriber end closed.
    this.#reset();
    this.#lifetime.abort();
    for (const release of this.#bindings) release();
    this.#origins.clear();
    for (const overlay of this.#overlays.values()) overlay.dispose?.();
    this.#viewer?.destroy();
    this.#viewer = undefined;
    for (const overlay of this.#overlays.values()) resetOverlayPhase(overlay.registration.element);
    this.#overlays.clear();
    this.#listeners.clear();
  }

  /** What a destroyed fluidbox throws for anything that would hold on to it. */
  #assertAlive() {
    if (this.#lifetime.signal.aborted) {
      throw new DOMException("The fluidbox was destroyed.", "InvalidStateError");
    }
  }

  /** Track a binding, so destroy releases it, and release it when its signal aborts. */
  #keep(dispose: () => void, signal: AbortSignal | undefined) {
    if (signal?.aborted) {
      dispose();
      return () => {};
    }
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      this.#bindings.delete(release);
      signal?.removeEventListener("abort", release);
      dispose();
    };
    signal?.addEventListener("abort", release, { once: true });
    this.#bindings.add(release);
    return release;
  }

  #target(target: FluidboxTarget): SessionTarget {
    const key = targetKey(target);
    return typeof key === "number" ? { index: key } : { id: key };
  }

  #command(
    name: "open" | "close" | "next" | "previous",
    target: FluidboxTarget | undefined,
    reason: SessionReason,
    options: FluidboxCommandOptions & { readonly instant?: boolean } = {},
  ): Promise<boolean> {
    // A part still holding a destroyed fluidbox, as after a rebuild, does nothing.
    if (this.#lifetime.signal.aborted) return Promise.resolve(false);
    const settings = {
      reason,
      signal: options.signal,
      scrub: options.scrub,
      instant: options.instant,
    };
    if (name === "close") return this.#close(settings).then(happened);
    if (name !== "open") return this.#step(name, settings).then(happened);
    // A viewer opens with the add-ons it was given.
    const loading = this.#addonsLoading;
    if (loading) {
      return loading.then(
        () => this.#command(name, target, reason, options),
        () => this.#command(name, target, reason, options),
      );
    }
    const goal = this.#target(target ?? this.#state.index ?? 0);
    const index = this.#resolve(goal);
    if (index instanceof RangeError) return Promise.reject(index);
    const status = this.#state.status;
    // While open, open moves to the item.
    const command = status === "open" || status === "opening" ? "goTo" : "open";
    return this.#select(command, index, goal, settings).then(happened);
  }

  #host(): FluidboxHost {
    return {
      registerOrigin: (ids, origin) => this.#registerOrigin(ids, origin),
      intend: () => {
        if (this.#preload === "intent") void this.load();
      },
      command: (name, target, reason) =>
        this.#command(name, target, reason === "items" ? "api" : reason),
      takeOver: (value) => this.#command("open", value, "api", { instant: true }),
      shareLink: (item) => this.#shareLink(item as TItem),
      retry: () => Promise.resolve(this.#state.status === "open" && !!this.#viewer?.retry()),
      labels: this.#labels,
      zoom: (name, reason) =>
        this.#zoomCommand(
          (from) =>
            name === "zoomReset" ? 1 : from * (name === "zoomIn" ? ZOOM_FACTOR : 1 / ZOOM_FACTOR),
          reason,
        ),
      // Drop the viewer, keeping what it needs, so the next press or open makes a new one.
      unload: () => {
        this.#reset();
        this.#generation += 1;
        this.#viewerLoad = undefined;
        const viewer = this.#viewer;
        this.#viewer = undefined;
        if (!viewer) return;
        for (const overlay of this.#overlays.values()) overlay.dispose = undefined;
        viewer.destroy();
        for (const overlay of this.#overlays.values()) {
          publishOverlayPhase(overlay.registration.element, "idle", 1);
        }
      },
    };
  }

  #registerOrigin(ids: readonly FluidboxItemId[], origin: FluidboxOrigin): FluidboxDispose {
    if (this.#lifetime.signal.aborted) return () => {};
    const unique = [...new Set(ids)];
    for (const id of unique) this.#assertKnownId(id);
    const disposers = unique.map((id) => this.#origins.register(id, origin, unique.length > 1));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }

  #registerOverlay(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): FluidboxDispose {
    if (this.#lifetime.signal.aborted) return () => {};
    this.#assertKnownId(id);
    const overlay: OverlayRegistration<TItem> = { id, registration };
    this.#overlays.add(overlay);
    if (this.#viewer) overlay.dispose = this.#viewer.registerThumbnailOverlay(id, registration);
    // The overlay's resting state is public styling, so it shows before the viewer loads.
    else publishOverlayPhase(registration.element, "idle", 1);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (!this.#overlays.delete(overlay)) return;
      if (overlay.dispose) overlay.dispose();
      else resetOverlayPhase(registration.element);
    };
  }

  /** Drop to closed at once, as when a binding's viewer unmounts. The fluidbox stays usable. */
  #reset() {
    this.#abortReveal();
    if (this.#pending) {
      this.#pending.controller.abort();
      this.#finish(this.#pending, aborted());
    }
    if (this.#state.status === "closed") return;
    const from = this.#announced;
    this.#before(null, null, this.#reason, false);
    this.#origins.restoreThumbnail();
    this.#publish("closed", null);
    this.#announce(null, this.#reason);
    if (from !== null) this.#complete("close", null, from, this.#reason);
  }

  #close(options: SessionCommandOptions): Promise<SessionCommandResult> {
    if (this.#lifetime.signal.aborted) return Promise.resolve(aborted());
    const reason = options.reason ?? "api";
    const pending = this.#samePending("close", options.signal);
    if (pending) return pending;
    if (!this.#allowed("close", undefined, reason)) return Promise.resolve(prevented());
    this.#reason = reasonOf(reason);

    if (this.#state.status === "closed") return Promise.resolve(completed(false));
    if (options.signal?.aborted) return Promise.resolve(aborted());

    const previousState = this.#state;
    const operation = this.#begin("close", options.signal, () =>
      this.#restoreState(previousState, reason),
    );
    this.#abortReveal();
    const index = this.#state.index;
    const from = this.#announced;
    this.#publish("closing", index);
    this.#announce(null, reason);
    const active = index === null ? null : this.#source.getItem(index);
    // A swipe reveals its slide's origin only once the strip settles. A close
    // that starts sooner still has to land on that origin, not the last one.
    if (active && this.#revealedId !== idOf(active)) {
      this.#requestReveal(idOf(active), index!, "selection");
    }
    const origin = active ? this.#origins.get(idOf(active)) : null;
    if (active && origin?.onPreviewChange) {
      try {
        origin.onPreviewChange(active, index!);
      } catch {
        // A host preview update must not prevent the viewer from closing.
      }
    }
    if (active) this.#origins.hideThumbnail(idOf(active));
    return this.#closeMotion(
      operation,
      active ? this.#origins.get(idOf(active)) : null,
      reason,
      from,
    );
  }

  #goTo(target: SessionTarget, options: SessionCommandOptions) {
    const index = this.#resolve(target);
    if (index instanceof RangeError) return Promise.reject(index);
    return this.#select("goTo", index, target, options);
  }

  #step(command: "next" | "previous", options: SessionCommandOptions) {
    const count = this.#source.count;
    if (count === 0) return Promise.resolve(completed(false));
    const index = this.#state.index;
    const step = command === "next" ? 1 : -1;
    const target =
      index === null
        ? 0
        : this.#loop
          ? (index + step + count) % count
          : Math.max(0, Math.min(count - 1, index + step));
    return this.#select(command, target, { index: target }, { ...options, step });
  }

  #setSource(source: FluidboxSource<TItem>): Promise<SessionCommandResult> {
    // A thumbnail can change its media while the close flight targets it.
    // Keep that flight running when the selected item still exists. Reopening
    // here would turn a normal preview update into an interrupted close.
    if (this.#state.status === "closing" && this.#state.value !== null) {
      const index = source.getIndex(this.#state.value);
      if (index !== null) {
        const changed = index !== this.#state.index;
        this.#source = source;
        this.#sourceRefreshPending = true;
        this.#publish("closing", index);
        return Promise.resolve(completed(changed));
      }
    }
    this.#supersede();
    this.#abortReveal();

    const { value: previousId, index: previousIndex, status } = this.#state;
    this.#source = source;
    this.#viewer?.setSource(source);
    this.#sourceRefreshPending = false;

    if (source.count === 0) {
      if (status === "closed") {
        this.#publish("closed", null);
        return Promise.resolve(completed(previousIndex !== null));
      }
      return this.#reconcileClose("source-empty");
    }

    if (previousIndex === null) {
      this.#publish(status, null);
      return Promise.resolve(completed(false));
    }

    const matchingIndex = previousId === null ? null : source.getIndex(previousId);
    const index = matchingIndex ?? Math.min(previousIndex, source.count - 1);
    const changed = idOf(source.getItem(index)) !== previousId || index !== previousIndex;
    const value = idOf(source.getItem(index));
    // The items force it: announced, but not cancelable.
    if (value !== this.#announced && status !== "closed") {
      this.#before(value, index, "source-update", false);
    }
    this.#publish(status, index);
    if (status !== "closed") this.#announce(value, "source-update");

    if (status === "closed") return Promise.resolve(completed(changed));
    return this.#reconcileSelection(index, changed, previousId);
  }

  #select(
    command: "open" | "goTo" | "next" | "previous",
    index: number,
    target: SessionTarget,
    options: SessionCommandOptions,
  ): Promise<SessionCommandResult> {
    if (this.#lifetime.signal.aborted) return Promise.resolve(aborted());
    this.#flushSourceRefresh();
    const id = idOf(this.#source.getItem(index));
    const reason = options.reason ?? "api";
    const key = `${this.#state.status === "open" ? "select" : "open"}:${id}`;
    const repeated = this.#samePending(key, options.signal);
    if (repeated) {
      // A plain move that repeats a pending scrub ends it, so it brings the trigger into view.
      if (!options.scrub && this.#pending?.scrub) {
        return repeated.then((result) => {
          if (result.status === "completed" && this.#state.value === id) {
            this.#requestReveal(id, index, "selection");
          }
          return result;
        });
      }
      return repeated;
    }
    if (!options.approved && !this.#allowed(command, target, reason)) {
      return Promise.resolve(prevented());
    }
    this.#reason = reasonOf(reason);

    if (options.signal?.aborted) return Promise.resolve(aborted());
    const status = this.#state.status;
    if (command !== "open" && status === "closed") return Promise.resolve(completed(false));
    const opening = status !== "open";
    const changed = this.#state.index !== index || opening;
    if (!changed && status === "open") {
      if (!options.scrub) this.#requestReveal(id, index, "selection");
      return Promise.resolve(completed(false));
    }

    const previousState = this.#state;
    const operation = this.#begin(key, options.signal, () =>
      this.#restoreState(previousState, reason),
    );
    operation.scrub = options.scrub;
    this.#abortReveal();
    const from = this.#announced;
    this.#publish(opening ? "opening" : status, index);
    this.#announce(id, reason);
    if (opening) this.#revealedId = id;
    return this.#move(operation, index, opening, reason, {
      scrub: options.scrub,
      step: options.step,
      instant: opening && options.instant,
      phase: opening ? "open" : "selection",
      from,
    });
  }

  #flushSourceRefresh() {
    if (!this.#sourceRefreshPending) return;
    this.#sourceRefreshPending = false;
    this.#viewer?.setSource(this.#source);
  }

  #reconcileSelection(index: number, changed: boolean, from: FluidboxValue) {
    const operation = this.#begin(`source:${idOf(this.#source.getItem(index))}`);
    const opening = this.#state.status !== "open";
    if (opening && this.#state.status !== "opening") this.#publish("opening", index);
    return this.#move(operation, index, opening, "source-update", { changed, from });
  }

  /** Run the open or select motion to an item, then settle on it. */
  #move(
    operation: PendingCommand,
    index: number,
    opening: boolean,
    reason: SessionChangeReason,
    {
      scrub,
      step,
      instant,
      phase = "selection",
      changed = true,
      from,
    }: {
      scrub?: boolean;
      step?: 1 | -1;
      instant?: boolean;
      phase?: "open" | "selection";
      changed?: boolean;
      /** The value the motion leaves. */
      from: FluidboxValue;
    },
  ) {
    const item = this.#source.getItem(index);
    const context: ViewerSessionMotionContext<TItem> = {
      item,
      index,
      origin: this.#origins.get(idOf(item)),
      signal: operation.controller.signal,
      reason,
      scrub,
      step,
      instant,
    };
    this.#origins.hideThumbnail(idOf(item));
    void this.#run(operation, () =>
      opening
        ? this.#openViewer(context)
        : (this.#viewer?.select(context) ??
          this.#loadViewer().then((viewer) => {
            if (viewer && !context.signal.aborted) return viewer.select(context);
          })),
    ).then((settled) => {
      if (!settled || !this.#owns(operation)) return;
      if (opening) this.#publish("open", index);
      if (!scrub) this.#requestReveal(idOf(item), index, phase);
      if (changed) {
        this.#complete(opening ? "open" : "move", idOf(item), opening ? null : from, reason);
      }
      this.#finish(operation, completed(changed));
    });
    return operation.promise;
  }

  #reconcileClose(reason: "source-empty") {
    const from = this.#announced;
    this.#before(null, null, reason, false);
    const operation = this.#begin(reason);
    this.#publish("closing", null);
    this.#announce(null, reason);
    return this.#closeMotion(operation, null, reason, from);
  }

  /** Run the close motion, then settle closed. */
  #closeMotion(
    operation: PendingCommand,
    origin: FluidboxOrigin | null,
    reason: SessionChangeReason,
    from: FluidboxValue,
  ) {
    void this.#run(operation, () =>
      // A viewer that never loaded has painted nothing to close.
      this.#viewer?.close({ origin, signal: operation.controller.signal, reason }),
    ).then((settled) => {
      if (!settled || !this.#owns(operation)) return;
      this.#origins.restoreThumbnail();
      // A close that the items emptied has nothing left to refresh.
      this.#flushSourceRefresh();
      this.#publish("closed", null);
      if (from !== null) this.#complete("close", null, from, reason);
      this.#finish(operation, completed(true));
    });
    return operation.promise;
  }

  #begin(key: string, signal?: AbortSignal, restore?: () => void): PendingCommand {
    this.#supersede();
    const controller = new AbortController();
    let resolve!: (result: SessionCommandResult) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<SessionCommandResult>((accept, fail) => {
      resolve = accept;
      reject = fail;
    });
    const operation: PendingCommand = {
      key,
      controller,
      promise,
      resolve,
      reject,
      settled: false,
      restore,
    };
    if (signal) {
      const abort = () => {
        controller.abort();
        operation.restore?.();
        this.#finish(operation, aborted());
      };
      signal.addEventListener("abort", abort, { once: true });
      operation.removeExternalAbort = () => signal.removeEventListener("abort", abort);
    }
    this.#pending = operation;
    return operation;
  }

  async #run(
    operation: PendingCommand,
    run: () => void | boolean | Promise<void | boolean>,
  ): Promise<boolean> {
    try {
      const accepted = await run();
      if (accepted === false) {
        operation.restore?.();
        this.#origins.restoreThumbnail();
        this.#finish(operation, prevented());
        return false;
      }
    } catch (error) {
      if (operation.controller.signal.aborted) return false;
      operation.restore?.();
      this.#finish(operation, null, error);
      return false;
    }
    return this.#owns(operation);
  }

  /**
   * Whether a command still owns the fluidbox. Asked again where it settles: a
   * command issued in the microtasks between can have taken over.
   */
  #owns(operation: PendingCommand) {
    return (
      this.#pending === operation && !operation.settled && !operation.controller.signal.aborted
    );
  }

  /** Settle a command once: resolve it with its result, or reject it with the error. */
  #finish(operation: PendingCommand, result: SessionCommandResult | null, error?: unknown) {
    if (operation.settled) return;
    operation.settled = true;
    operation.removeExternalAbort?.();
    if (this.#pending === operation) this.#pending = undefined;
    if (result) operation.resolve(result);
    else operation.reject(error);
  }

  #supersede() {
    if (!this.#pending) return;
    const pending = this.#pending;
    pending.controller.abort();
    this.#finish(pending, { status: "superseded" });
  }

  #samePending(key: string, signal?: AbortSignal) {
    if (!signal && this.#pending?.key === key) return this.#pending.promise;
    return null;
  }

  /** Fire the before-event a command announces. False when a listener prevented it. */
  #allowed(
    command: "open" | "close" | "goTo" | "next" | "previous",
    target: SessionTarget | undefined,
    reason: SessionReason,
  ) {
    const { status, index } = this.#state;
    const shown = status === "open" || status === "opening";
    // A command that would do nothing announces nothing.
    if (command === "close") return !shown || this.#before(null, null, reason);
    if (command !== "open" && !shown) return true;
    const goal = target ? this.#resolve(target) : null;
    if (typeof goal !== "number" || (shown && goal === index)) return true;
    return this.#before(idOf(this.#source.getItem(goal)), goal, reason);
  }

  /** Fire `beforevaluechange` for a change to `value`. False when a listener prevented it. */
  #before(
    value: FluidboxValue,
    index: number | null,
    reason: SessionChangeReason | FluidboxReason,
    cancelable = true,
  ) {
    const previousValue = this.#announced;
    return this.dispatchEvent(
      this.#valueEvent("beforevaluechange", value, previousValue, index, reason, cancelable),
    );
  }

  #valueEvent(
    type: "beforevaluechange" | "valuechange" | "valuechangecomplete",
    value: FluidboxValue,
    previousValue: FluidboxValue,
    index: number | null,
    reason: SessionChangeReason | FluidboxReason,
    cancelable = false,
    action: FluidboxValueChangeAction = previousValue === null
      ? "open"
      : value === null
        ? "close"
        : "move",
  ) {
    const item = index === null || index >= this.#list.count ? null : this.#list.get(index);
    return new FluidboxValueChangeEvent<TItem>(type, {
      cancelable,
      value,
      previousValue,
      index: item ? index : null,
      item,
      action,
      reason: reasonOf(reason),
    });
  }

  /** Fire `valuechange` as the viewer heads for `value`, unless it already announced it. */
  #announce(value: FluidboxValue, reason: SessionChangeReason | FluidboxReason) {
    const previousValue = this.#announced;
    if (value === previousValue) return;
    this.#announced = value;
    const index = value === null ? null : this.#state.index;
    this.dispatchEvent(this.#valueEvent("valuechange", value, previousValue, index, reason));
  }

  /** Fire `valuechangecomplete` once the motion to `value` settled. */
  #complete(
    action: FluidboxValueChangeAction,
    value: FluidboxValue,
    previousValue: FluidboxValue,
    reason: SessionChangeReason | FluidboxReason,
  ) {
    const index = value === null ? null : this.#state.index;
    this.dispatchEvent(
      this.#valueEvent("valuechangecomplete", value, previousValue, index, reason, false, action),
    );
  }

  #requestReveal(id: string, index: number, reason: "open" | "selection") {
    this.#abortReveal();
    const adapter = this.#origins.adapter;
    this.#revealedId = id;
    const controller = new AbortController();
    this.#revealController = controller;
    try {
      // Without a revealOrigin, scroll the registered or adapted trigger into view.
      const reveal = adapter?.revealOrigin
        ? adapter.revealOrigin(id, index, { signal: controller.signal, phase: reason })
        : this.#origins.get(id)?.trigger.scrollIntoView({
            behavior: "instant",
            block: "nearest",
            inline: "nearest",
          });
      // A page scroll event comes a frame late in iOS Safari, so a viewer that
      // follows the page from it would ride the reveal for a frame.
      this.#viewer?.revealed();
      void Promise.resolve(reveal)
        .then(() => {
          this.#viewer?.revealed();
          if (!controller.signal.aborted && this.#state.value === id) {
            this.#origins.hideThumbnail(id);
          }
        })
        .catch(() => {});
    } catch {
      // Host scrolling never owns viewer motion or command completion.
    }
  }

  #abortReveal() {
    this.#revealController?.abort();
    this.#revealController = undefined;
  }

  #restoreState(state: FluidboxState<TItem>, reason: SessionChangeReason) {
    this.#publish(state.status, state.index);
    this.#announce(state.status === "closed" ? null : state.value, reason);
  }

  /** The index of a target, or the error for an unknown one, which commands reject with. */
  #resolve(target: SessionTarget): number | RangeError {
    if (target.id !== undefined) {
      const index = this.#source.getIndex(target.id);
      return index ?? new RangeError(`Unknown fluidbox item id: ${target.id}`);
    }
    const index = target.index;
    if (!Number.isInteger(index) || index < 0 || index >= this.#source.count) {
      return new RangeError(`Fluidbox item index is out of range: ${index}`);
    }
    return index;
  }

  #assertKnownId(id: string) {
    if (this.#source.getIndex(id) === null) throw new RangeError(`Unknown fluidbox item id: ${id}`);
  }

  #stateFor(status: FluidboxStatus, index: number | null): FluidboxState<TItem> {
    const item = index === null ? null : this.#source.getItem(index);
    return Object.freeze({
      status,
      value: item ? idOf(item) : null,
      index,
      item,
      count: this.#source.count,
      hasPrevious: index !== null && (index > 0 || this.#loops),
      hasNext: index !== null && (index < this.#source.count - 1 || this.#loops),
      zoom: this.#zoomFor(status, index, item),
      fullscreen: this.#fullscreen,
    });
  }

  /** Whether the gallery goes round: a single item has nowhere to go. */
  get #loops() {
    return this.#loop && this.#source.count > 1;
  }

  #publish(status: FluidboxStatus, index: number | null) {
    this.#origins.keepThumbnail(status === "open" && !!this.#viewer?.keepsThumbnail());
    this.#state = this.#stateFor(status, index);
    // Every binding is a subscriber: one that throws must not stop the others,
    // or the command, which then never settles.
    for (const listener of this.#listeners) {
      try {
        listener(this.#state);
      } catch (error) {
        report(error);
      }
    }
  }
}
