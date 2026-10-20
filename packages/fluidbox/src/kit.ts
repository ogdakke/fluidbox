/**
 * The binding kit: what the framework bindings build their parts from. Each
 * binding uses only this and the plain API, never the custom elements.
 */
import { CONTROL_ICON_ATTRIBUTES, CONTROL_ICON_PATHS } from "./control-icons";
import { hostOf } from "./host";
import { idOf, indexIn, itemLabel, targetKey, targetKeys } from "./items";
import { defaultLabels, resolveLabels } from "./labels";
import { fluidboxEventTypes } from "./events";
import type { Fluidbox, FluidboxItem, FluidboxRenderer } from "./public-api";

export { controlNames, fluidboxControls, type FluidboxControl } from "./controls";
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
 * Drop a fluidbox's viewer and close it at once, keeping its bindings, as a
 * binding's unmount does. The next press or open makes a new viewer, so a
 * StrictMode remount keeps working.
 */
export function unloadFluidbox(fluidbox: Fluidbox<any>) {
  hostOf(fluidbox).unload();
}

export { indexIn };

export { createFluidboxSync, watchFluidbox, type FluidboxChangeDetails } from "./controlled";

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

export type { FluidboxAddonName } from "./addons";
