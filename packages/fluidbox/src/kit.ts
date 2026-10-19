/**
 * The binding kit: what the framework bindings build their parts from. Each
 * binding uses only this and the plain API, never the custom elements.
 */
import { CONTROL_ICON_ATTRIBUTES, CONTROL_ICON_PATHS } from "./control-icons";
import { hostKey, hostOf, type FluidboxHost } from "./host";
import { idOf, indexIn, toList } from "./items";
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
  type FluidboxState,
  type FluidboxTarget,
} from "./public-api";
import { bindTrigger } from "./trigger";

export { controlButton, controlNames, fluidboxControls, type FluidboxControl } from "./controls";
export { defaultLabels, resolveLabels };
export {
  bindTrigger,
  createTrigger,
  resolveOrigin,
  type FluidboxTrigger,
  type FluidboxTriggerOptions,
  type FluidboxTriggerPointer,
  type FluidboxTriggerPreview,
} from "./trigger";
export { idOf };

/** The default control icons, as attributes and a path, for frameworks that build their own SVG. */
export const fluidboxControlIcon = {
  attributes: CONTROL_ICON_ATTRIBUTES,
  paths: CONTROL_ICON_PATHS,
} as const;

/** The text a part gives an item: its alt text or title. */
export function itemLabel(item: FluidboxItem): string {
  return item.type === "img" ? item.alt : item.title;
}

/** The fluidbox events, for bindings that forward them as props, emits or outputs. */
export { fluidboxEventTypes };

export { latestOrigins } from "./origins";

/**
 * A fluidbox that exists before the viewer does. Parts bind triggers and
 * overlays to it during render; they reach the viewer once one is attached.
 */
export interface DeferredFluidbox<TItem extends FluidboxItem = FluidboxItem> {
  /** Stands in for the attached fluidbox. Commands before attach resolve false. */
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
      attached ? hostOf(attached).command(name, target, reason) : Promise.resolve(false),
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
    get filmstrip() {
      return attached?.filmstrip ?? null;
    }
    open(target?: FluidboxTarget, options?: FluidboxCommandOptions) {
      return attached ? attached.open(target, options) : Promise.resolve(false);
    }
    close(options?: FluidboxCommandOptions) {
      return attached ? attached.close(options) : Promise.resolve(false);
    }
    next(options?: FluidboxCommandOptions) {
      return attached ? attached.next(options) : Promise.resolve(false);
    }
    previous(options?: FluidboxCommandOptions) {
      return attached ? attached.previous(options) : Promise.resolve(false);
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
    preload(target: FluidboxTarget) {
      return host.preload(target);
    }
    bind(
      element: HTMLElement,
      target: FluidboxTarget | readonly FluidboxTarget[],
      options: FluidboxBindOptions<TItem> = {},
    ) {
      const trigger = bindTrigger(fluidbox, element, {
        targets: typeof target === "object" ? target : [target],
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
      target: FluidboxTarget | readonly FluidboxTarget[],
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

export { loadAddons, type FluidboxAddonName } from "./addons";
