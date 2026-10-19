import { addon, type Addon } from "./addons";
import { controlButton, controlNames, wireControls } from "./controls";
import { DomViewerDriver } from "./dom-viewer-driver";
import { hostKey, type FluidboxHost } from "./host";
import { idOf, indexIn, toList, toSource } from "./items";
import { resolveLabels, type FluidboxLabels } from "./labels";
import {
  FluidboxChangeEvent,
  FluidboxToggleEvent,
  type Fluidbox,
  type FluidboxBindOptions,
  type FluidboxCommandOptions,
  type FluidboxFilmstrip,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxOptions,
  type FluidboxOverlayOptions,
  type FluidboxReason,
  type FluidboxSheet,
  type FluidboxState,
  type FluidboxTarget,
} from "./public-api";
import type {
  FluidboxExtension,
  FluidboxPortalRenderer,
  FluidboxThumbnailOverlayRegistration,
  SessionBeforeCommandEvent,
  SessionChangeReason,
  SessionCommandResult,
  SessionEvent,
  SessionReason,
  SessionState,
  SessionTarget,
} from "./runtime-types";
import { bindTrigger } from "./trigger";
import { ViewerSession } from "./viewer-session";

const reasonOf = (reason: SessionChangeReason): FluidboxReason =>
  reason === "source-update" || reason === "source-empty" ? "items" : reason;

const happened = (result: SessionCommandResult) => result.status === "completed";

/** Create a fluidbox: a viewer at the end of `<body>`, and the commands, state and events that drive it. */
export function createFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxOptions<TItem>,
): Fluidbox<TItem> {
  return new FluidboxRuntime(options);
}

class FluidboxRuntime<TItem extends FluidboxItem> extends EventTarget implements Fluidbox<TItem> {
  readonly #session: ViewerSession<TItem>;
  readonly #labels: FluidboxLabels;
  readonly #lifetime = new AbortController();
  readonly #bindings = new Set<() => void>();
  /** Re-resolve each binding's targets after the items change. */
  readonly #refreshers = new Set<() => void>();
  readonly #sheet: Addon<FluidboxSheet> | undefined;
  readonly #filmstrip: Addon<FluidboxFilmstrip<TItem>> | undefined;
  #list: FluidboxItemList<TItem>;
  #state: FluidboxState<TItem>;
  #stateOf: SessionState | undefined;
  /** The side of the last toggle event, so a rolled-back command toggles back. */
  #announced: "open" | "closed" = "closed";
  /** The reason of the request whose status change comes next. */
  #reason: FluidboxReason = "api";
  readonly [hostKey]: FluidboxHost;

  constructor(options: FluidboxOptions<TItem>) {
    super();
    this.#list = toList(options.items);
    this.#labels = resolveLabels(options.labels);
    const { sheet, filmstrip, controls, viewer } = options;
    this.#sheet = sheet ? addon("sheet")(sheet === true ? {} : sheet) : undefined;
    this.#filmstrip = filmstrip
      ? addon("filmstrip")(filmstrip === true ? {} : filmstrip)
      : undefined;
    const driver = new DomViewerDriver<TItem>(
      document,
      options.zoom,
      options.renderers,
      this.#labels,
    );
    this.#session = new ViewerSession<TItem>(
      {
        source: toSource(this.#list),
        origins: options.origins,
        onBeforeCommand: (event) => this.#before(event),
        onEvent: (event) => this.#event(event),
      },
      driver,
    );
    this.#state = this.#publicState(this.#session.state);
    this[hostKey] = this.#host();
    // Like the elements and the bindings: the defaults until you draw your own viewer.
    const shown = controls ?? !viewer;
    const names = shown === true ? controlNames : shown || [];
    const portal: FluidboxPortalRenderer = ({ target, signal }) => {
      const buttons = names.map((name) => controlButton(document, name, this.#labels));
      target.append(...buttons);
      const disposeViewer = viewer?.({ target, fluidbox: this, signal }) ?? undefined;
      // Buttons marked as controls work wherever the viewer content puts them.
      wireControls(target, this, signal, (name, event) => {
        void this.#command(name, undefined, event.detail === 0 ? "keyboard" : "pointer");
      });
      return () => {
        disposeViewer?.();
        for (const button of buttons) button.remove();
      };
    };
    driver.connect(this.#session, portal, [
      this.#filmstrip?.extension as FluidboxExtension<TItem> | undefined,
      this.#sheet?.extension as FluidboxExtension<TItem> | undefined,
    ]);
  }

  get state() {
    const current = this.#session.state;
    if (current !== this.#stateOf) this.#state = this.#publicState(current);
    return this.#state;
  }

  get items() {
    return this.#list;
  }

  get sheet() {
    return this.#sheet?.handle ?? null;
  }

  get filmstrip() {
    return this.#filmstrip?.handle ?? null;
  }

  open(target?: FluidboxTarget, options?: FluidboxCommandOptions) {
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
    this.#list = toList(items);
    // A close this update causes is reported with the reason "items".
    this.#reason = "items";
    const result = this.#session.setSource(toSource(this.#list));
    // The session knows the new ids now, so bindings can register them.
    for (const refresh of this.#refreshers) refresh();
    return result.then(happened);
  }

  preload(target: FluidboxTarget) {
    return this.#session.prepare(this.#target(target));
  }

  bind(
    element: HTMLElement,
    target: FluidboxTarget | readonly FluidboxTarget[],
    options: FluidboxBindOptions<TItem> = {},
  ) {
    const trigger = bindTrigger(this, element, {
      targets: typeof target === "object" ? target : [target],
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
    target: FluidboxTarget | readonly FluidboxTarget[],
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
    const targets = typeof target === "object" ? target : [target];
    for (const each of targets) {
      if (typeof each === "string" ? !each : !Number.isInteger(each) || each < 0) {
        throw new RangeError(`Not a fluidbox item target: ${String(each)}`);
      }
    }
    // Indexes name whichever item is there now; ids may arrive with later items.
    const registered = new Map<string, () => void>();
    const rebind = () => {
      const wanted = new Set<string>();
      for (const each of targets) {
        const index = typeof each === "number" ? each : indexIn(this.#list, each);
        if (index !== null && index < this.#list.count) wanted.add(idOf(this.#list.get(index)));
      }
      for (const [id, dispose] of registered) {
        if (wanted.has(id)) continue;
        dispose();
        registered.delete(id);
      }
      for (const id of wanted) {
        if (!registered.has(id)) {
          registered.set(id, this.#session.registerThumbnailOverlay(id, registration));
        }
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
    return this.#session.subscribe(() => listener(this.state));
  }

  destroy() {
    if (this.#lifetime.signal.aborted) return;
    this.#lifetime.abort();
    for (const release of this.#bindings) release();
    this.#session.destroy();
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
    return typeof target === "number" ? { index: target } : { id: target };
  }

  #command(
    name: "open" | "close" | "next" | "previous",
    target: FluidboxTarget | undefined,
    reason: SessionReason,
    options: FluidboxCommandOptions = {},
  ): Promise<boolean> {
    // A part still holding a destroyed fluidbox, as after a rebuild, does nothing.
    if (this.#lifetime.signal.aborted) return Promise.resolve(false);
    const session = this.#session;
    const settings = { reason, signal: options.signal };
    if (name !== "open") return session[name](settings).then(happened);
    const goal = this.#target(target ?? this.state.index ?? 0);
    const status = session.state.status;
    // While open, open moves to the item.
    const result =
      status === "open" || status === "opening"
        ? session.goTo(goal, settings)
        : session.open(goal, settings);
    return result.then(happened);
  }

  #host(): FluidboxHost {
    const list = () => this.#list;
    return {
      get items() {
        return list();
      },
      registerOrigin: (ids, origin) => this.#session.registerOrigin(ids, origin),
      registerOverlay: (id, registration) =>
        this.#session.registerThumbnailOverlay(
          id,
          registration as FluidboxThumbnailOverlayRegistration<TItem>,
        ),
      preload: (target) => this.preload(target),
      command: (name, target, reason) =>
        this.#command(name, target, reason === "items" ? "api" : reason),
    };
  }

  #publicState(state: SessionState): FluidboxState<TItem> {
    this.#stateOf = state;
    const index = state.requestedIndex ?? state.activeIndex;
    const item = index === null ? null : this.#list.get(index);
    return Object.freeze({
      status: state.status,
      id: item ? idOf(item) : null,
      index,
      item,
      count: state.count,
      hasPrevious: state.canPrevious,
      hasNext: state.canNext,
    });
  }

  #item(target: SessionTarget | undefined) {
    if (!target) return null;
    const index = target.id === undefined ? target.index : indexIn(this.#list, target.id);
    if (index === null || index < 0 || index >= this.#list.count) return null;
    return { index, item: this.#list.get(index) };
  }

  #before(event: SessionBeforeCommandEvent) {
    const reason = reasonOf(event.reason);
    const state = this.#session.state;
    const status = state.status;
    const shown = status === "open" || status === "opening";
    const opening = event.command === "open" && !shown;
    // A command that would do nothing announces nothing.
    if (event.command === "close" && !shown) return;
    if (opening || event.command === "close") {
      const before = new FluidboxToggleEvent("beforetoggle", {
        cancelable: true,
        oldState: opening ? "closed" : "open",
        newState: opening ? "open" : "closed",
        reason,
      });
      if (!this.dispatchEvent(before)) event.preventDefault();
      return;
    }
    if (!shown) return;
    const goal = this.#item(event.target);
    if (!goal || goal.index === (state.requestedIndex ?? state.activeIndex)) return;
    const before = new FluidboxChangeEvent<TItem>("beforeitemchange", {
      cancelable: true,
      id: idOf(goal.item),
      index: goal.index,
      item: goal.item,
      reason,
    });
    if (!this.dispatchEvent(before)) event.preventDefault();
  }

  #event(event: SessionEvent) {
    if (
      event.type === "open-request" ||
      event.type === "change-request" ||
      event.type === "close-request"
    ) {
      this.#reason = reasonOf(event.reason);
    } else if (event.type === "status-change") {
      // Opening and closing toggle; an aborted command lands back where it was.
      const side = event.status === "opening" || event.status === "open" ? "open" : "closed";
      if (side === this.#announced) return;
      const oldState = this.#announced;
      this.#announced = side;
      this.dispatchEvent(
        new FluidboxToggleEvent("toggle", { oldState, newState: side, reason: this.#reason }),
      );
    } else if (event.type === "selection-change" || event.type === "selection-settle") {
      if (event.index < 0 || event.index >= this.#list.count) return;
      this.dispatchEvent(
        new FluidboxChangeEvent<TItem>(
          event.type === "selection-change" ? "itemchange" : "settle",
          {
            id: event.id,
            index: event.index,
            item: this.#list.get(event.index),
            reason: reasonOf(event.reason),
          },
        ),
      );
    }
  }
}
