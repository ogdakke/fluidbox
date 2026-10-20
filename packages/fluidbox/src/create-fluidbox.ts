import { addon, loadAddons, type Addon } from "./addons";
import { hostKey, type FluidboxHost } from "./host";
import { idOf, idsIn, targetKey, targetKeys, toList, toSource } from "./items";
import { resolveLabels, type FluidboxLabels } from "./labels";
import type { DomViewerDriver } from "./dom-viewer-driver";
import { publishOverlayPhase, resetOverlayPhase } from "./overlay-phase";
import { OriginRegistry } from "./origin-registry";
import {
  FluidboxItemChangeEvent,
  FluidboxToggleEvent,
  type Fluidbox,
  type FluidboxBindOptions,
  type FluidboxCommandOptions,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLoading,
  type FluidboxOptions,
  type FluidboxOrigin,
  type FluidboxOriginAdapter,
  type FluidboxOverlayOptions,
  type FluidboxReason,
  type FluidboxSheet,
  type FluidboxState,
  type FluidboxStatus,
  type FluidboxTarget,
  type FluidboxUpdateOptions,
  FluidboxSheetEvent,
} from "./public-api";
import type {
  FluidboxDispose,
  FluidboxExtension,
  FluidboxItemId,
  FluidboxViewerLayer,
  FluidboxSource,
  FluidboxThumbnailOverlayRegistration,
  SessionChangeReason,
  SessionCommandOptions,
  SessionCommandResult,
  SessionController,
  SessionReason,
  SessionTarget,
  ViewerSessionMotionContext,
} from "./runtime-types";
import { bindTrigger } from "./trigger";

const defaultControls = ["previous", "next", "close"] as const;

const reasonOf = (reason: SessionChangeReason): FluidboxReason =>
  reason === "source-update" || reason === "source-empty" ? "items" : reason;

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

interface OverlayRegistration<TItem extends FluidboxItem> {
  readonly token: object;
  readonly registration: FluidboxThumbnailOverlayRegistration<TItem>;
  /** Its registration with the viewer, once there is one. */
  dispose?: FluidboxDispose | void;
}

/** The viewer the fluidbox drives: the DOM viewer, or a stand-in in tests. */
export type FluidboxRuntimeDriver<TItem extends FluidboxItem> = Pick<
  DomViewerDriver<TItem>,
  keyof DomViewerDriver<TItem>
>;

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
  "controls" | "viewer" | "filmstrip" | "sheet"
>;

/**
 * Create a fluidbox: a viewer at the end of `<body>`, and the commands, state and
 * events that drive it. Browser only. Throws a TypeError for an array of items
 * with an empty or duplicate id.
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
  readonly #renderers: FluidboxOptions<TItem>["renderers"];
  readonly #controls: SessionController<TItem> = this.#controller();
  /** Changed in place by update, so every part of the viewer reads the new strings. */
  readonly #labels: FluidboxLabels;
  #settings: Settings<TItem>;
  #loading: FluidboxLoading = "hover";
  readonly #lifetime = new AbortController();
  readonly #bindings = new Set<() => void>();
  /** Re-resolve each binding's targets after the items change. */
  readonly #refreshers = new Set<() => void>();
  #sheet: Addon<FluidboxSheet> | undefined;
  #filmstrip: Addon<null> | undefined;
  /** The add-on entries the settings need, while they load. Opening waits for them. */
  #addonsLoading: Promise<void> | undefined;
  #list: FluidboxItemList<TItem>;
  #source: FluidboxSource<TItem>;
  #state: FluidboxState<TItem>;
  readonly #origins: OriginRegistry;
  readonly #listeners = new Set<(state: FluidboxState<TItem>) => void>();
  readonly #overlays = new Map<FluidboxItemId, OverlayRegistration<TItem>>();
  #pending: PendingCommand | undefined;
  #revealController: AbortController | undefined;
  /** The item whose origin the user last saw: the one opened or last revealed. */
  #revealedId: string | undefined;
  #sourceRefreshPending = false;
  /** The side of the last toggle event, so a rolled-back command toggles back. */
  #announced: "open" | "closed" = "closed";
  /** The reason of the request whose status change comes next. */
  #reason: FluidboxReason = "api";
  readonly [hostKey]: FluidboxHost;

  constructor(options: FluidboxOptions<TItem>, driver?: FluidboxRuntimeDriver<TItem>) {
    super();
    this.#list = toList(options.items);
    this.#source = toSource(this.#list);
    this.#labels = { ...resolveLabels(options.labels) };
    const { sheet, filmstrip, controls, viewer } = options;
    this.#settings = { sheet, filmstrip, controls, viewer };
    // The adapter only ever sees this fluidbox's items.
    this.#origins = new OriginRegistry(options.origins as FluidboxOriginAdapter | undefined);
    this.#zoom = options.zoom;
    this.#renderers = options.renderers;
    this.#state = this.#stateFor("closed", null);
    this[hostKey] = this.#host();
    this.#makeAddons();
    if (driver) this.#attach(driver);
    this.#setLoading(options.loading);
  }

  #setLoading(loading: FluidboxLoading | undefined) {
    this.#loading = loading ?? "hover";
    // Browsers without idle callbacks load on the next task.
    if (this.#loading !== "eager" || this.#viewer || typeof window === "undefined") return;
    const idle = window.requestIdleCallback ?? setTimeout;
    idle(() => void this.load());
  }

  /** Give a new viewer what it would have seen, had it been there from the start. */
  #attach(viewer: FluidboxRuntimeDriver<TItem>) {
    viewer.setSource(this.#source);
    viewer.connect(this.#controls, this.#portal(), this.#extensions());
    for (const [id, overlay] of this.#overlays) {
      overlay.dispose = viewer.registerThumbnailOverlay(id, overlay.registration);
    }
    this.#viewer = viewer;
  }

  #loadViewer() {
    if (this.#viewer) return Promise.resolve(this.#viewer);
    const generation = this.#generation;
    this.#viewerLoad ??= import("./dom-viewer-driver").then(
      ({ DomViewerDriver }) => {
        if (this.#lifetime.signal.aborted || generation !== this.#generation) return undefined;
        this.#attach(
          new DomViewerDriver<TItem>(document, this.#zoom, this.#renderers, this.#labels),
        );
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
    const { controls, viewer } = this.#settings;
    // Like the elements and the bindings: the defaults until you draw your own viewer.
    const shown = controls ?? !viewer;
    const names = shown === true ? defaultControls : shown || [];
    return { fluidbox: this, controls: names, viewer, labels: this.#labels };
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
    };
  }

  /** Make the add-ons the settings turn on. Their entries load on first use. */
  #makeAddons() {
    const { sheet, filmstrip } = this.#settings;
    const loading = loadAddons([
      ...(sheet ? (["sheet"] as const) : []),
      ...(filmstrip ? (["filmstrip"] as const) : []),
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
          this.dispatchEvent(new FluidboxSheetEvent("sheetchange", { stop, reason }));
        })
      : undefined;
    this.#filmstrip = filmstrip
      ? addon("filmstrip")(filmstrip === true ? {} : filmstrip)
      : undefined;
  }

  #extensions() {
    return [
      this.#filmstrip?.extension as FluidboxExtension<TItem> | undefined,
      this.#sheet?.extension as FluidboxExtension<TItem> | undefined,
    ];
  }

  update(options: FluidboxUpdateOptions<TItem>) {
    if (this.#lifetime.signal.aborted) return;
    const has = (key: keyof FluidboxUpdateOptions<TItem>) => Object.hasOwn(options, key);
    const previous = this.#settings;
    const next: Settings<TItem> = {
      controls: has("controls") ? options.controls : previous.controls,
      viewer: has("viewer") ? options.viewer : previous.viewer,
      filmstrip: has("filmstrip") ? options.filmstrip : previous.filmstrip,
      sheet: has("sheet") ? options.sheet : previous.sheet,
    };
    this.#settings = next;
    if (has("loading")) this.#setLoading(options.loading);
    if (has("zoom")) {
      this.#zoom = options.zoom;
      this.#viewer?.setZoom(options.zoom);
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
      next.viewer !== previous.viewer
    ) {
      this.#viewer?.setPortal(this.#portal());
    }
    if (
      !sameOptions(next.filmstrip, previous.filmstrip) ||
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

  next(options?: FluidboxCommandOptions) {
    return this.#command("next", undefined, "api", options);
  }

  previous(options?: FluidboxCommandOptions) {
    return this.#command("previous", undefined, "api", options);
  }

  setItems(items: FluidboxItems<TItem>) {
    if (this.#lifetime.signal.aborted) return Promise.resolve(false);
    this.#list = toList(items);
    // A close this update causes is reported with the reason "items".
    this.#reason = "items";
    const result = this.#setSource(toSource(this.#list));
    // The new ids are known now, so bindings can register them.
    for (const refresh of this.#refreshers) refresh();
    return result.then(happened);
  }

  preload(target: FluidboxTarget<TItem>) {
    const index = this.#resolve(this.#target(target));
    if (index instanceof RangeError) throw index;
    if (this.#lifetime.signal.aborted || this.#state.status !== "closed") return () => {};
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

  bind(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options: FluidboxBindOptions<TItem> = {},
  ) {
    const trigger = bindTrigger(this, element, {
      target,
      returns: options.returns,
      onPreviewChange: options.onPreviewChange,
    });
    const refresh = () => trigger.refresh();
    this.#refreshers.add(refresh);
    return this.#keep(() => {
      this.#refreshers.delete(refresh);
      trigger.destroy();
    }, options.signal);
  }

  bindOverlay(
    element: HTMLElement,
    target: FluidboxTarget<TItem>,
    options: FluidboxOverlayOptions<TItem> = {},
  ) {
    const { travel, frameLayer } = options;
    const registration: FluidboxThumbnailOverlayRegistration<TItem> = travel
      ? {
          behavior: "travel",
          element,
          frameLayer,
          renderer:
            travel === true
              ? ({ target: frame }) => {
                  frame.append(...[...element.childNodes].map((node) => node.cloneNode(true)));
                  return () => frame.replaceChildren();
                }
              : travel,
        }
      : { behavior: "host", element };
    const targets = targetKeys(target, options.returns);
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
    if (this.#lifetime.signal.aborted) return () => {};
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  destroy() {
    if (this.#lifetime.signal.aborted) return;
    this.#lifetime.abort();
    for (const release of this.#bindings) release();
    this.#abortReveal();
    if (this.#pending) {
      this.#pending.controller.abort();
      this.#finish(this.#pending, aborted());
    }
    this.#origins.clear();
    for (const overlay of this.#overlays.values()) overlay.dispose?.();
    this.#viewer?.destroy();
    this.#viewer = undefined;
    for (const overlay of this.#overlays.values()) resetOverlayPhase(overlay.registration.element);
    this.#overlays.clear();
    this.#listeners.clear();
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
    options: FluidboxCommandOptions = {},
  ): Promise<boolean> {
    // A part still holding a destroyed fluidbox, as after a rebuild, does nothing.
    if (this.#lifetime.signal.aborted) return Promise.resolve(false);
    const settings = { reason, signal: options.signal, scrub: options.scrub };
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
        if (this.#loading === "hover") void this.load();
      },
      command: (name, target, reason) =>
        this.#command(name, target, reason === "items" ? "api" : reason),
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
    this.#overlays.get(id)?.dispose?.();
    const overlay: OverlayRegistration<TItem> = { token: {}, registration };
    this.#overlays.set(id, overlay);
    if (this.#viewer) overlay.dispose = this.#viewer.registerThumbnailOverlay(id, registration);
    // The overlay's resting state is public styling, so it shows before the viewer loads.
    else publishOverlayPhase(registration.element, "idle", 1);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (this.#overlays.get(id) !== overlay) return;
      this.#overlays.delete(id);
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
    this.#origins.restoreThumbnail();
    this.#publish("closed", null);
    this.#toggle("closed");
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
    this.#publish("closing", index);
    this.#toggle("closing");
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
    return this.#closeMotion(operation, active ? this.#origins.get(idOf(active)) : null, reason);
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
    const target =
      index === null
        ? 0
        : command === "next"
          ? Math.min(count - 1, index + 1)
          : Math.max(0, index - 1);
    return this.#select(command, target, { index: target }, options);
  }

  #setSource(source: FluidboxSource<TItem>): Promise<SessionCommandResult> {
    // A thumbnail can change its media while the close flight targets it.
    // Keep that flight running when the selected item still exists. Reopening
    // here would turn a normal preview update into an interrupted close.
    if (this.#state.status === "closing" && this.#state.id !== null) {
      const index = source.getIndex(this.#state.id);
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

    const { id: previousId, index: previousIndex, status } = this.#state;
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
    this.#publish(status, index);
    if (changed) this.#itemEvent("itemchange", index, "source-update");

    if (status === "closed") return Promise.resolve(completed(changed));
    return this.#reconcileSelection(index, changed);
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
          if (result.status === "completed" && this.#state.id === id) {
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
    this.#publish(opening ? "opening" : status, index);
    if (opening) this.#toggle("opening");
    this.#itemEvent("itemchange", index, reason);
    if (opening) this.#revealedId = id;
    return this.#move(operation, index, opening, reason, {
      scrub: options.scrub,
      phase: opening ? "open" : "selection",
    });
  }

  #flushSourceRefresh() {
    if (!this.#sourceRefreshPending) return;
    this.#sourceRefreshPending = false;
    this.#viewer?.setSource(this.#source);
  }

  #reconcileSelection(index: number, changed: boolean) {
    const operation = this.#begin(`source:${idOf(this.#source.getItem(index))}`);
    const opening = this.#state.status !== "open";
    if (opening && this.#state.status !== "opening") {
      this.#publish("opening", index);
      this.#toggle("opening");
    }
    return this.#move(operation, index, opening, "source-update", { changed });
  }

  /** Run the open or select motion to an item, then settle on it. */
  #move(
    operation: PendingCommand,
    index: number,
    opening: boolean,
    reason: SessionChangeReason,
    {
      scrub,
      phase = "selection",
      changed = true,
    }: { scrub?: boolean; phase?: "open" | "selection"; changed?: boolean },
  ) {
    const item = this.#source.getItem(index);
    const context: ViewerSessionMotionContext<TItem> = {
      item,
      index,
      origin: this.#origins.get(idOf(item)),
      signal: operation.controller.signal,
      reason,
      scrub,
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
      if (!settled) return;
      if (opening) {
        this.#publish("open", index);
        this.#toggle("open");
      }
      if (!scrub) this.#requestReveal(idOf(item), index, phase);
      if (changed) this.#itemEvent("settle", index, reason);
      this.#finish(operation, completed(changed));
    });
    return operation.promise;
  }

  #reconcileClose(reason: "source-empty") {
    const operation = this.#begin(reason);
    this.#publish("closing", null);
    this.#toggle("closing");
    return this.#closeMotion(operation, null, reason);
  }

  /** Run the close motion, then settle closed. */
  #closeMotion(
    operation: PendingCommand,
    origin: FluidboxOrigin | null,
    reason: SessionChangeReason,
  ) {
    void this.#run(operation, () =>
      // A viewer that never loaded has painted nothing to close.
      this.#viewer?.close({ origin, signal: operation.controller.signal, reason }),
    ).then((settled) => {
      if (!settled) return;
      this.#origins.restoreThumbnail();
      // A close that the items emptied has nothing left to refresh.
      this.#flushSourceRefresh();
      this.#publish("closed", null);
      this.#toggle("closed");
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
    sessionReason: SessionReason,
  ) {
    const reason = reasonOf(sessionReason);
    const { status, index } = this.#state;
    const shown = status === "open" || status === "opening";
    const opening = command === "open" && !shown;
    // A command that would do nothing announces nothing.
    if (command === "close" && !shown) return true;
    if (opening || command === "close") {
      return this.dispatchEvent(
        new FluidboxToggleEvent("beforetoggle", {
          cancelable: true,
          oldState: opening ? "closed" : "open",
          newState: opening ? "open" : "closed",
          reason,
        }),
      );
    }
    if (!shown) return true;
    const goal = target ? this.#resolve(target) : null;
    if (typeof goal !== "number" || goal === index) return true;
    const item = this.#source.getItem(goal);
    return this.dispatchEvent(
      new FluidboxItemChangeEvent<TItem>("beforeitemchange", {
        cancelable: true,
        id: idOf(item),
        index: goal,
        item,
        reason,
      }),
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
          if (!controller.signal.aborted && this.#state.id === id) {
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
    const current = this.#state;
    this.#publish(state.status, state.index);
    if (current.status !== state.status) this.#toggle(state.status);
    if (state.index !== null && current.id !== state.id) {
      this.#itemEvent("itemchange", state.index, reason);
    }
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
      id: item ? idOf(item) : null,
      index,
      item,
      count: this.#source.count,
      hasPrevious: index !== null && index > 0,
      hasNext: index !== null && index < this.#source.count - 1,
    });
  }

  #publish(status: FluidboxStatus, index: number | null) {
    this.#state = this.#stateFor(status, index);
    for (const listener of this.#listeners) listener(this.#state);
  }

  /** Opening and closing toggle; an aborted command lands back where it was. */
  #toggle(status: FluidboxStatus) {
    const side = status === "opening" || status === "open" ? "open" : "closed";
    if (side === this.#announced) return;
    const oldState = this.#announced;
    this.#announced = side;
    this.dispatchEvent(
      new FluidboxToggleEvent("toggle", { oldState, newState: side, reason: this.#reason }),
    );
  }

  #itemEvent(type: "itemchange" | "settle", index: number, reason: SessionChangeReason) {
    if (index < 0 || index >= this.#list.count) return;
    const item = this.#list.get(index);
    this.dispatchEvent(
      new FluidboxItemChangeEvent<TItem>(type, {
        id: idOf(item),
        index,
        item,
        reason: reasonOf(reason),
      }),
    );
  }
}
