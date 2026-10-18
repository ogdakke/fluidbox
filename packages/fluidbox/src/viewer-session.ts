import { OriginRegistry } from "./origin-registry";
import type {
  FluidboxBeforeCommandEvent,
  FluidboxChangeReason,
  FluidboxCommandOptions,
  FluidboxCommandReason,
  FluidboxCommandResult,
  FluidboxController,
  FluidboxDispose,
  FluidboxEvent,
  FluidboxItem,
  FluidboxItemId,
  FluidboxOptions,
  FluidboxOrigin,
  FluidboxSource,
  FluidboxState,
  FluidboxTarget,
  FluidboxThumbnailOverlayRegistration,
} from "./public-api";

export interface ViewerSessionMotionContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly origin: FluidboxOrigin | null;
  readonly signal: AbortSignal;
  readonly reason: FluidboxChangeReason;
}

export interface ViewerSessionCloseContext {
  readonly origin: FluidboxOrigin | null;
  readonly signal: AbortSignal;
  readonly reason: FluidboxChangeReason;
}

/** DOM motion and portal ownership supplied by the runtime adapter. */
export interface ViewerSessionDriver<TItem extends FluidboxItem = FluidboxItem> {
  setSource?(source: FluidboxSource<TItem>): void;
  prepare?(context: Omit<ViewerSessionMotionContext<TItem>, "signal" | "reason">): FluidboxDispose;
  open(context: ViewerSessionMotionContext<TItem>): void | boolean | Promise<void | boolean>;
  select(context: ViewerSessionMotionContext<TItem>): void | Promise<void>;
  close(context: ViewerSessionCloseContext): void | Promise<void>;
  registerThumbnailOverlay?(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): void | FluidboxDispose;
  destroy(): void;
}

interface PendingCommand {
  readonly key: string;
  readonly controller: AbortController;
  readonly promise: Promise<FluidboxCommandResult>;
  resolve(result: FluidboxCommandResult): void;
  reject(error: unknown): void;
  settled: boolean;
  restore?: () => void;
  removeExternalAbort?: () => void;
}

interface OverlayRegistration<TItem extends FluidboxItem> {
  readonly registration: FluidboxThumbnailOverlayRegistration<TItem>;
  readonly token: object;
  readonly disposeDriver?: FluidboxDispose;
}

const completed = (changed: boolean): FluidboxCommandResult => ({ status: "completed", changed });
const prevented = (): FluidboxCommandResult => ({ status: "prevented" });
const aborted = (): FluidboxCommandResult => ({ status: "aborted" });

export function viewerSelectionCommandOptions(reason: FluidboxCommandReason, settled: boolean) {
  return { reason, __fluidboxSettled: settled };
}

function selectionCommandSettled(options: FluidboxCommandOptions) {
  return (options as FluidboxCommandOptions & { __fluidboxSettled?: boolean }).__fluidboxSettled;
}

function stateFor<TItem extends FluidboxItem>(
  source: FluidboxSource<TItem>,
  status: FluidboxState["status"],
  activeIndex: number | null,
  requestedIndex: number | null,
): FluidboxState {
  const active = activeIndex === null ? null : source.getItem(activeIndex);
  const requested = requestedIndex === null ? null : source.getItem(requestedIndex);
  return Object.freeze({
    status,
    count: source.count,
    activeId: active?.id ?? null,
    activeIndex,
    requestedId: requested?.id ?? null,
    requestedIndex,
    canPrevious: activeIndex !== null && activeIndex > 0,
    canNext: activeIndex !== null && activeIndex < source.count - 1,
  });
}

function invalidState(): DOMException {
  return new DOMException("The lightbox controller has been destroyed.", "InvalidStateError");
}

/**
 * State and command coordinator for the headless runtime. It deliberately has
 * no custom-element dependency; a driver owns portal DOM and painted motion.
 */
export class ViewerSession<
  TItem extends FluidboxItem = FluidboxItem,
> implements FluidboxController<TItem> {
  #source: FluidboxSource<TItem>;
  readonly #driver: ViewerSessionDriver<TItem>;
  readonly #origins: OriginRegistry;
  readonly #listeners = new Set<(state: FluidboxState) => void>();
  readonly #overlays = new Map<FluidboxItemId, OverlayRegistration<TItem>>();
  readonly #onBeforeCommand: FluidboxOptions<TItem>["onBeforeCommand"];
  readonly #onEvent: FluidboxOptions<TItem>["onEvent"];
  readonly #originAdapter: FluidboxOptions<TItem>["origins"];
  #state: FluidboxState;
  #pending: PendingCommand | undefined;
  #revealController: AbortController | undefined;
  /** The item whose origin the user last saw: the one opened or last revealed. */
  #revealedId: string | undefined;
  #sourceRefreshPending = false;
  #destroyed = false;

  constructor(options: FluidboxOptions<TItem>, driver: ViewerSessionDriver<TItem>) {
    this.#validateSource(options.source);
    this.#source = options.source;
    this.#driver = driver;
    this.#origins = new OriginRegistry(options.origins);
    this.#originAdapter = options.origins;
    this.#onBeforeCommand = options.onBeforeCommand;
    this.#onEvent = options.onEvent;
    this.#state = stateFor(this.#source, "closed", null, null);
    this.#driver.setSource?.(this.#source);
  }

  get state(): FluidboxState {
    return this.#state;
  }

  prepare(target: FluidboxTarget): FluidboxDispose {
    this.#assertAlive();
    const index = this.#resolveTarget(target);
    if (this.#state.status !== "closed") return () => {};
    const item = this.#source.getItem(index);
    return (
      this.#driver.prepare?.({ item, index, origin: this.#origins.get(item.id) }) ?? (() => {})
    );
  }

  open(target: FluidboxTarget, options: FluidboxCommandOptions = {}) {
    this.#assertAlive();
    const index = this.#resolveTarget(target);
    return this.#requestSelection("open", index, target, options);
  }

  close(options: FluidboxCommandOptions = {}) {
    this.#assertAlive();
    const reason = options.reason ?? "api";
    const pending = this.#samePending("close", options.signal);
    if (pending) return pending;
    if (this.#prevented("close", undefined, reason)) return Promise.resolve(prevented());
    this.#emit({ type: "close-request", reason });

    if (this.#state.status === "closed") return Promise.resolve(completed(false));
    if (options.signal?.aborted) return Promise.resolve(aborted());

    const previousState = this.#state;
    const operation = this.#begin("close", options.signal, () =>
      this.#restoreState(previousState, reason),
    );
    this.#abortReveal();
    this.#publish("closing", this.#state.activeIndex, this.#state.activeIndex);
    this.#emit({ type: "status-change", status: "closing" });
    const activeIndex = this.#state.activeIndex;
    const activeItem = activeIndex === null ? null : this.#source.getItem(activeIndex);
    // A swipe reveals its slide's origin only once the strip settles. A close
    // that starts sooner still has to land on that origin, not the last one.
    if (activeItem && this.#revealedId !== activeItem.id) {
      this.#requestReveal(activeItem.id, activeIndex!, "selection");
    }
    const origin = activeItem ? this.#origins.get(activeItem.id) : null;
    if (activeItem && origin?.prepareClose) {
      try {
        origin.prepareClose(activeItem, activeIndex!);
      } catch {
        // A host preview update must not prevent the viewer from closing.
      }
    }
    if (activeItem) this.#origins.hideThumbnail(activeItem.id);
    const closeOrigin = activeItem ? this.#origins.get(activeItem.id) : null;
    void this.#run(operation, () =>
      this.#driver.close({ origin: closeOrigin, signal: operation.controller.signal, reason }),
    ).then((settled) => {
      if (!settled) return;
      this.#origins.restoreThumbnail();
      this.#flushSourceRefresh();
      this.#publish("closed", null, null);
      this.#emit({ type: "status-change", status: "closed" });
      this.#finish(operation, completed(true));
    });
    return operation.promise;
  }

  goTo(target: FluidboxTarget, options: FluidboxCommandOptions = {}) {
    this.#assertAlive();
    const index = this.#resolveTarget(target);
    return this.#requestSelection("goTo", index, target, options);
  }

  next(options: FluidboxCommandOptions = {}) {
    this.#assertAlive();
    if (this.#source.count === 0) return Promise.resolve(completed(false));
    const index = this.#state.activeIndex;
    const target = index === null ? 0 : Math.min(this.#source.count - 1, index + 1);
    return this.#requestSelection("next", target, { index: target }, options);
  }

  previous(options: FluidboxCommandOptions = {}) {
    this.#assertAlive();
    if (this.#source.count === 0) return Promise.resolve(completed(false));
    const index = this.#state.activeIndex;
    const target = index === null ? 0 : Math.max(0, index - 1);
    return this.#requestSelection("previous", target, { index: target }, options);
  }

  setSource(source: FluidboxSource<TItem>) {
    this.#assertAlive();
    this.#validateSource(source);
    // A thumbnail can change its media while the close flight targets it.
    // Keep that flight running when the selected item still exists. Reopening
    // here would turn a normal preview update into an interrupted close.
    if (this.#state.status === "closing" && this.#state.activeId !== null) {
      const index = source.getIndex(this.#state.activeId);
      if (index !== null) {
        const changed = index !== this.#state.activeIndex;
        this.#source = source;
        this.#sourceRefreshPending = true;
        this.#publish("closing", index, index);
        return Promise.resolve(completed(changed));
      }
    }
    this.#supersede();
    this.#abortReveal();

    const previousId = this.#state.activeId;
    const previousIndex = this.#state.activeIndex;
    this.#source = source;
    this.#driver.setSource?.(source);
    this.#sourceRefreshPending = false;

    if (source.count === 0) {
      if (this.#state.status === "closed") {
        this.#publish("closed", null, null);
        return Promise.resolve(completed(previousIndex !== null));
      }
      return this.#reconcileClose("source-empty");
    }

    if (previousIndex === null) {
      this.#publish(this.#state.status, null, null);
      return Promise.resolve(completed(false));
    }

    const matchingIndex = previousId === null ? null : source.getIndex(previousId);
    const index = matchingIndex ?? Math.min(previousIndex, source.count - 1);
    const item = source.getItem(index);
    const changed = item.id !== previousId || index !== previousIndex;
    this.#publish(this.#state.status, index, index);
    if (changed) this.#emitSelection("selection-change", index, "source-update");

    if (this.#state.status === "closed") return Promise.resolve(completed(changed));
    return this.#reconcileSelection(index, changed);
  }

  registerOrigin(
    id: FluidboxItemId | readonly FluidboxItemId[],
    origin: FluidboxOrigin,
  ): FluidboxDispose {
    this.#assertAlive();
    const ids = typeof id === "string" ? [id] : [...new Set(id)];
    for (const itemId of ids) this.#assertKnownId(itemId);
    const disposers = ids.map((itemId) => this.#origins.register(itemId, origin, ids.length > 1));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }

  registerThumbnailOverlay(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): FluidboxDispose {
    this.#assertAlive();
    this.#assertKnownId(id);
    const token = {};
    this.#overlays.get(id)?.disposeDriver?.();
    const disposeDriver = this.#driver.registerThumbnailOverlay?.(id, registration) ?? undefined;
    this.#overlays.set(id, { registration, token, disposeDriver });
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (this.#overlays.get(id)?.token !== token) return;
      this.#overlays.delete(id);
      disposeDriver?.();
    };
  }

  subscribe(listener: (state: FluidboxState) => void): FluidboxDispose {
    this.#assertAlive();
    this.#listeners.add(listener);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      this.#listeners.delete(listener);
    };
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#abortReveal();
    if (this.#pending) {
      this.#pending.controller.abort();
      this.#finish(this.#pending, aborted());
    }
    this.#origins.clear();
    for (const overlay of this.#overlays.values()) overlay.disposeDriver?.();
    this.#overlays.clear();
    this.#listeners.clear();
    this.#driver.destroy();
  }

  #requestSelection(
    command: "open" | "goTo" | "next" | "previous",
    index: number,
    target: FluidboxTarget,
    options: FluidboxCommandOptions,
  ): Promise<FluidboxCommandResult> {
    this.#flushSourceRefresh();
    const item = this.#source.getItem(index);
    const reason = options.reason ?? "api";
    const key = `${this.#state.status === "open" ? "select" : "open"}:${item.id}`;
    const repeated = this.#samePending(key, options.signal);
    if (repeated) {
      if (selectionCommandSettled(options)) {
        return repeated.then((result) => {
          if (result.status === "completed" && this.#state.activeId === item.id) {
            this.#requestReveal(item.id, index, "selection");
          }
          return result;
        });
      }
      return repeated;
    }
    if (this.#prevented(command, target, reason)) return Promise.resolve(prevented());
    this.#emit({ type: command === "open" ? "open-request" : "change-request", target, reason });

    if (options.signal?.aborted) return Promise.resolve(aborted());
    if (command !== "open" && this.#state.status === "closed") {
      return Promise.resolve(completed(false));
    }
    const opening = this.#state.status !== "open";
    const enteringOpening = this.#state.status !== "opening";
    const changed = this.#state.activeIndex !== index || opening;
    if (!changed && this.#state.status === "open") {
      if (selectionCommandSettled(options)) {
        this.#requestReveal(item.id, index, "selection");
      }
      return Promise.resolve(completed(false));
    }

    const previousState = this.#state;
    const operation = this.#begin(key, options.signal, () =>
      this.#restoreState(previousState, reason),
    );
    this.#abortReveal();
    this.#publish(opening ? "opening" : this.#state.status, index, index);
    if (opening && enteringOpening) this.#emit({ type: "status-change", status: "opening" });
    this.#emitSelection("selection-change", index, reason);
    const context: ViewerSessionMotionContext<TItem> = {
      item,
      index,
      origin: this.#origins.get(item.id),
      signal: operation.controller.signal,
      reason,
    };
    this.#origins.hideThumbnail(item.id);
    if (opening) this.#revealedId = item.id;
    void this.#run(operation, () =>
      opening ? this.#driver.open(context) : this.#driver.select(context),
    ).then((settled) => {
      if (!settled) return;
      if (opening) {
        this.#publish("open", index, index);
        this.#emit({ type: "status-change", status: "open" });
      }
      if (selectionCommandSettled(options) !== false) {
        this.#requestReveal(item.id, index, opening ? "open" : "selection");
      }
      this.#emitSelection("selection-settle", index, reason);
      this.#finish(operation, completed(true));
    });
    return operation.promise;
  }

  #flushSourceRefresh() {
    if (!this.#sourceRefreshPending) return;
    this.#sourceRefreshPending = false;
    this.#driver.setSource?.(this.#source);
  }

  #reconcileSelection(index: number, changed: boolean) {
    const item = this.#source.getItem(index);
    const operation = this.#begin(`source:${item.id}`);
    const opening = this.#state.status !== "open";
    if (opening && this.#state.status !== "opening") {
      this.#publish("opening", index, index);
      this.#emit({ type: "status-change", status: "opening" });
    }
    const context: ViewerSessionMotionContext<TItem> = {
      item,
      index,
      origin: this.#origins.get(item.id),
      signal: operation.controller.signal,
      reason: "source-update",
    };
    this.#origins.hideThumbnail(item.id);
    void this.#run(operation, () =>
      opening ? this.#driver.open(context) : this.#driver.select(context),
    ).then((settled) => {
      if (!settled) return;
      if (opening) {
        this.#publish("open", index, index);
        this.#emit({ type: "status-change", status: "open" });
      }
      this.#requestReveal(item.id, index, "selection");
      if (changed) this.#emitSelection("selection-settle", index, "source-update");
      this.#finish(operation, completed(changed));
    });
    return operation.promise;
  }

  #reconcileClose(reason: "source-empty") {
    const operation = this.#begin(reason);
    this.#publish("closing", null, null);
    this.#emit({ type: "status-change", status: "closing" });
    void this.#run(operation, () =>
      this.#driver.close({ origin: null, signal: operation.controller.signal, reason }),
    ).then((settled) => {
      if (!settled) return;
      this.#origins.restoreThumbnail();
      this.#publish("closed", null, null);
      this.#emit({ type: "status-change", status: "closed" });
      this.#finish(operation, completed(true));
    });
    return operation.promise;
  }

  #begin(key: string, signal?: AbortSignal, restore?: () => void): PendingCommand {
    this.#supersede();
    const controller = new AbortController();
    let resolve!: (result: FluidboxCommandResult) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<FluidboxCommandResult>((accept, fail) => {
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
      this.#fail(operation, error);
      return false;
    }
    return (
      this.#pending === operation && !operation.settled && !operation.controller.signal.aborted
    );
  }

  #finish(operation: PendingCommand, result: FluidboxCommandResult) {
    if (operation.settled) return;
    operation.settled = true;
    operation.removeExternalAbort?.();
    if (this.#pending === operation) this.#pending = undefined;
    operation.resolve(result);
  }

  #fail(operation: PendingCommand, error: unknown) {
    if (operation.settled) return;
    operation.settled = true;
    operation.removeExternalAbort?.();
    if (this.#pending === operation) this.#pending = undefined;
    operation.reject(error);
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

  #prevented(
    command: FluidboxBeforeCommandEvent["command"],
    target: FluidboxTarget | undefined,
    reason: FluidboxCommandReason,
  ) {
    let defaultPrevented = false;
    const event: FluidboxBeforeCommandEvent = {
      command,
      target,
      reason,
      get defaultPrevented() {
        return defaultPrevented;
      },
      preventDefault() {
        defaultPrevented = true;
      },
    };
    this.#onBeforeCommand?.(event);
    return defaultPrevented;
  }

  #requestReveal(id: string, index: number, reason: "open" | "selection") {
    this.#abortReveal();
    const adapter = this.#originAdapter;
    if (!adapter) return;
    this.#revealedId = id;
    const controller = new AbortController();
    this.#revealController = controller;
    try {
      const reveal = adapter.revealOrigin
        ? adapter.revealOrigin(id, index, { signal: controller.signal, reason })
        : (() => {
            const origin = adapter.getOrigin(id);
            origin?.trigger.scrollIntoView({
              behavior: "instant",
              block: "nearest",
              inline: "nearest",
            });
          })();
      void Promise.resolve(reveal)
        .then(() => {
          if (!controller.signal.aborted && this.#state.activeId === id) {
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

  #restoreState(state: FluidboxState, reason: FluidboxChangeReason) {
    const current = this.#state;
    this.#publish(state.status, state.activeIndex, state.requestedIndex);
    if (current.status !== state.status) {
      this.#emit({ type: "status-change", status: state.status });
    }
    if (state.activeIndex !== null && current.activeId !== state.activeId) {
      this.#emitSelection("selection-change", state.activeIndex, reason);
    }
  }

  #resolveTarget(target: FluidboxTarget) {
    if ("id" in target && target.id !== undefined) {
      const index = this.#source.getIndex(target.id);
      if (index === null) throw new RangeError(`Unknown lightbox item id: ${target.id}`);
      return index;
    }
    const index = target.index;
    if (!Number.isInteger(index) || index < 0 || index >= this.#source.count) {
      throw new RangeError(`Fluidbox item index is out of range: ${index}`);
    }
    return index;
  }

  #assertKnownId(id: string) {
    if (this.#source.getIndex(id) === null) throw new RangeError(`Unknown lightbox item id: ${id}`);
  }

  #validateSource(source: FluidboxSource<TItem>) {
    if (!Number.isInteger(source.count) || source.count < 0) {
      throw new RangeError("Fluidbox source count must be a non-negative integer.");
    }
  }

  #assertAlive() {
    if (this.#destroyed) throw invalidState();
  }

  #publish(
    status: FluidboxState["status"],
    activeIndex: number | null,
    requestedIndex: number | null,
  ) {
    this.#state = stateFor(this.#source, status, activeIndex, requestedIndex);
    for (const listener of this.#listeners) listener(this.#state);
  }

  #emit(event: FluidboxEvent) {
    this.#onEvent?.(event);
  }

  #emitSelection(
    type: "selection-change" | "selection-settle",
    index: number,
    reason: FluidboxChangeReason,
  ) {
    const item = this.#source.getItem(index);
    this.#emit({ type, id: item.id, index, reason });
  }
}
