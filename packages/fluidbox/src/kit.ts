/**
 * The binding kit: what the framework bindings build their parts from. Each
 * binding uses only this and the plain API, never the custom elements.
 */
import { CONTROL_ICON_ATTRIBUTES, CONTROL_ICON_PATHS } from "./control-icons";
import { hostKey, hostOf, type FluidboxHost } from "./host";
import { idOf, indexIn, itemLabel, targetKey, targetKeys, toList } from "./items";
import { defaultLabels, resolveLabels } from "./labels";
import { fluidboxEventTypes, forwardEvents } from "./events";
import {
  type Fluidbox,
  type FluidboxBindOptions,
  type FluidboxCommandOptions,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxOverlayOptions,
  type FluidboxRenderer,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxUpdateOptions,
} from "./public-api";
import { bindTrigger } from "./trigger";

export { controlButton, controlNames, fluidboxControls, type FluidboxControl } from "./controls";
export { defaultLabels, resolveLabels };
export {
  bindTrigger,
  createTrigger,
  frameLayerOf,
  resolveOrigin,
  type FluidboxTrigger,
  type FluidboxTriggerOptions,
  type FluidboxTriggerPointer,
  type FluidboxTriggerPreview,
} from "./trigger";
export { idOf, itemLabel, targetKey, targetKeys };

/** The default control icons, as attributes and a path, for frameworks that build their own SVG. */
export const fluidboxControlIcon = {
  attributes: CONTROL_ICON_ATTRIBUTES,
  paths: CONTROL_ICON_PATHS,
} as const;

/** The fluidbox events, for bindings that forward them as props, emits or outputs. */
export { fluidboxEventTypes };

export { latestOrigins } from "./origins";

/**
 * A fluidbox that exists before the viewer does. Parts bind triggers and
 * overlays to it during render; they reach the viewer once one is attached.
 */
export interface DeferredFluidbox<TItem extends FluidboxItem = FluidboxItem> {
  /** Stands in for the attached fluidbox. Commands before attach wait for it. */
  readonly fluidbox: Fluidbox<TItem>;
  /** Hand over a fluidbox from createFluidbox. Bindings made so far move to it. */
  attach(fluidbox: Fluidbox<TItem>): void;
  /** Let go of the attached fluidbox. Bindings wait for the next one. */
  detach(): void;
  /** Called when the state or the items change, including items with the same count. */
  subscribe(listener: () => void): () => void;
}

const closedState = <TItem extends FluidboxItem>(count: number): FluidboxState<TItem> =>
  Object.freeze({
    status: "closed",
    id: null,
    index: null,
    item: null,
    count,
    hasPrevious: false,
    hasNext: false,
  });

/** Make a fluidbox that framework parts can use before the viewer is created. */
export function createDeferredFluidbox<TItem extends FluidboxItem = FluidboxItem>(
  initialItems: FluidboxItems<TItem>,
): DeferredFluidbox<TItem> {
  let attached: Fluidbox<TItem> | null = null;
  let list: FluidboxItemList<TItem> = toList(initialItems);
  let state = closedState<TItem>(list.count);
  let unsubscribe: (() => void) | undefined;
  let forwarding: AbortController | undefined;
  const listeners = new Set<() => void>();
  /** Re-resolve each trigger's targets after the items change. */
  const refreshers = new Set<() => void>();
  const refresh = () => {
    for (const each of refreshers) each();
  };
  const registrations = new Set<{ attach(host: FluidboxHost): void; detach(): void }>();
  /** Commands made before a viewer attaches, run in order once one does. */
  let queued: ((fluidbox: Fluidbox<TItem>) => void)[] = [];
  const whenAttached = (run: (fluidbox: Fluidbox<TItem>) => Promise<boolean>) =>
    attached
      ? run(attached)
      : new Promise<boolean>((resolve, reject) => {
          queued.push((fluidbox) => run(fluidbox).then(resolve, reject));
        });
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const register = (run: (host: FluidboxHost) => () => void) => {
    let dispose: (() => void) | undefined;
    const registration = {
      attach(host: FluidboxHost) {
        dispose?.();
        dispose = run(host);
      },
      detach() {
        dispose?.();
        dispose = undefined;
      },
    };
    registrations.add(registration);
    if (attached) registration.attach(hostOf(attached));
    return () => {
      registration.detach();
      registrations.delete(registration);
    };
  };

  const host: FluidboxHost = {
    get items() {
      return list;
    },
    registerOrigin: (ids, origin) => register((target) => target.registerOrigin(ids, origin)),
    registerOverlay: (id, registration) =>
      register((target) => target.registerOverlay(id, registration)),
    // A press before the viewer exists still prepares it once it attaches.
    preload: (target) => register((each) => each.preload(target)),
    command: (name, target, reason) =>
      whenAttached((each) => hostOf(each).command(name, target, reason)),
  };

  class StandIn extends EventTarget {
    readonly [hostKey] = host;
    get state() {
      return state;
    }
    get items() {
      return list;
    }
    get sheet() {
      return attached?.sheet ?? null;
    }
    update(options: FluidboxUpdateOptions<TItem>) {
      attached?.update(options);
    }
    open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions) {
      return whenAttached((each) => each.open(target, options));
    }
    close(options?: FluidboxCommandOptions) {
      return whenAttached((each) => each.close(options));
    }
    next(options?: FluidboxCommandOptions) {
      return whenAttached((each) => each.next(options));
    }
    previous(options?: FluidboxCommandOptions) {
      return whenAttached((each) => each.previous(options));
    }
    setItems(items: FluidboxItems<TItem>) {
      list = toList(items);
      if (attached) {
        const result = attached.setItems(items);
        // After the viewer knows the new ids.
        refresh();
        notify();
        return result;
      }
      refresh();
      state = closedState(list.count);
      notify();
      return Promise.resolve(false);
    }
    preload(target: FluidboxTarget<TItem>) {
      return host.preload(target);
    }
    bind(
      element: HTMLElement,
      target: FluidboxTarget<TItem>,
      options: FluidboxBindOptions<TItem> = {},
    ) {
      const trigger = bindTrigger(fluidbox, element, {
        target,
        returns: options.returns,
        onPreviewChange: options.onPreviewChange,
      });
      const update = () => trigger.refresh();
      refreshers.add(update);
      const release = () => {
        refreshers.delete(update);
        trigger.destroy();
      };
      options.signal?.addEventListener("abort", release, { once: true });
      return release;
    }
    bindOverlay(
      element: HTMLElement,
      target: FluidboxTarget<TItem>,
      options: FluidboxOverlayOptions<TItem> = {},
    ) {
      // Overlays need the real viewer's runtime; bind each time one attaches.
      let dispose: (() => void) | undefined;
      const registration = {
        attach() {
          dispose?.();
          dispose = attached?.bindOverlay(element, target, { ...options, signal: undefined });
        },
        detach() {
          dispose?.();
          dispose = undefined;
        },
      };
      registrations.add(registration);
      if (attached) registration.attach();
      const release = () => {
        registration.detach();
        registrations.delete(registration);
      };
      options.signal?.addEventListener("abort", release, { once: true });
      return release;
    }
    subscribe(listener: (state: FluidboxState<TItem>) => void) {
      const each = () => listener(state);
      listeners.add(each);
      return () => {
        listeners.delete(each);
      };
    }
    // The binding that made this handle owns the viewer's lifetime.
    destroy() {}
  }
  const fluidbox = new StandIn() as unknown as Fluidbox<TItem>;

  const detach = () => {
    unsubscribe?.();
    unsubscribe = undefined;
    forwarding?.abort();
    forwarding = undefined;
    for (const registration of registrations) registration.detach();
    attached = null;
    state = closedState(list.count);
    notify();
  };

  return {
    fluidbox,
    attach(next) {
      if (attached) detach();
      attached = next;
      list = next.items;
      refresh();
      forwarding = new AbortController();
      forwardEvents(next, fluidbox, forwarding.signal);
      const nextHost = hostOf(next);
      for (const registration of registrations) registration.attach(nextHost);
      state = next.state;
      unsubscribe = next.subscribe((current) => {
        state = current;
        notify();
      });
      notify();
      const pending = queued;
      queued = [];
      for (const run of pending) run(next);
    },
    detach,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { indexIn };

/** Where a framework draws one piece of rendered content, as a portal. */
export interface FluidboxSlot<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /**
   * A `display: contents` element of the framework's own inside `container`,
   * so the viewer emptying the container never pulls nodes from under it.
   */
  readonly target: HTMLElement;
  /** The element the viewer gave the renderer: a sheet's section, a filmstrip button. */
  readonly container: HTMLElement;
}

/** A renderer for the sheet or the filmstrip that lists its targets for a framework to fill. */
export interface FluidboxSlots<TItem extends FluidboxItem = FluidboxItem> {
  readonly render: FluidboxRenderer<TItem>;
  /** The targets on show, in index order. */
  readonly slots: readonly FluidboxSlot<TItem>[];
  /** Called when the slots change. */
  subscribe(this: void, listener: () => void): () => void;
}

/** Make a renderer whose targets a framework fills with its own components. */
export function createSlots<TItem extends FluidboxItem = FluidboxItem>(): FluidboxSlots<TItem> {
  let slots: readonly FluidboxSlot<TItem>[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly FluidboxSlot<TItem>[]) => {
    slots = next;
    for (const listener of listeners) listener();
  };
  return {
    render({ item, index, target: container }) {
      const target = container.ownerDocument.createElement("div");
      target.style.display = "contents";
      container.append(target);
      const slot: FluidboxSlot<TItem> = { item, index, target, container };
      set([...slots, slot].sort((a, b) => a.index - b.index));
      return () => set(slots.filter((each) => each !== slot));
    },
    get slots() {
      return slots;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { loadAddons, type FluidboxAddonName } from "./addons";
