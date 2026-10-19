import { hostOf } from "./host";
import { idOf, indexIn } from "./items";
import { markedVisualOrigin } from "./origin-geometry";
import type {
  Fluidbox,
  FluidboxItem,
  FluidboxOrigin,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
} from "./public-api";
import type { FluidboxOrigin as RuntimeOrigin } from "./runtime-types";

/**
 * Find the parts of a trigger the flight uses: the box marked with
 * `data-fluidbox-origin`, `data-fluidbox-target` or `data-fluidbox-preview`,
 * else its image or video, else the trigger itself.
 */
export function resolveOrigin(trigger: HTMLElement): FluidboxOrigin {
  const visual =
    (trigger.matches("[data-fluidbox-origin]")
      ? trigger
      : trigger.querySelector<HTMLElement>("[data-fluidbox-origin]")) ??
    markedVisualOrigin(trigger) ??
    (trigger.matches("img, video")
      ? trigger
      : (trigger.querySelector<HTMLElement>("img, video") ?? trigger));
  const thumbnail = visual.matches("img")
    ? (visual as HTMLImageElement)
    : (visual.querySelector("img") ?? undefined);
  return { trigger, visual, thumbnail };
}

/** What a trigger opens and returns to. */
export interface FluidboxTriggerOptions<TItem extends FluidboxItem = FluidboxItem> {
  /** Every item that may return to this trigger on close. The first is opened. */
  readonly targets: readonly FluidboxTarget[];
  /** Called before the closing flight measures the trigger, with the item it lands on. */
  readonly onPreviewChange?: (item: TItem, index: number) => void;
}

/** A trigger's preview: the item it shows, which follows the viewer while it is open. */
export interface FluidboxTriggerPreview<TItem extends FluidboxItem = FluidboxItem> {
  /** Null when the trigger's items have left the list. */
  readonly item: TItem | null;
  readonly index: number | null;
  readonly status: FluidboxStatus;
}

/** Pointer details a trigger reads. DOM and framework events both fit. */
export interface FluidboxTriggerPointer {
  readonly isPrimary: boolean;
  readonly button: number;
  readonly defaultPrevented: boolean;
}

/**
 * The behaviour of a trigger, apart from its element and events, so each
 * framework can wire it into its own event system.
 */
export interface FluidboxTrigger<TItem extends FluidboxItem = FluidboxItem> {
  /** Register the element as the origin of the trigger's items, or pass null to let go. */
  setElement(element: HTMLElement | null): void;
  /** Change the items. Re-registers the origin when they change. */
  update(options: FluidboxTriggerOptions<TItem>): void;
  /** Register again, as after the items changed and more of them are known. */
  refresh(): void;
  /** The item to show, for a trigger whose content follows the viewer. */
  preview(state: FluidboxState<TItem>): FluidboxTriggerPreview<TItem>;
  /** Start loading the item a press is likely to open. */
  pointerDown(event: FluidboxTriggerPointer): void;
  pointerUp(): void;
  pointerCancel(): void;
  /** Open the viewer, unless the event was prevented. */
  click(event: { readonly defaultPrevented: boolean }): void;
  destroy(): void;
}

/** How long a preload waits for a click after the pointer lifts. */
const PRELOAD_GRACE = 250;

/** Make a trigger for a fluidbox. Call setElement once the element exists. */
export function createTrigger<TItem extends FluidboxItem = FluidboxItem>(
  fluidbox: Fluidbox<TItem>,
  options: FluidboxTriggerOptions<TItem>,
): FluidboxTrigger<TItem> {
  const host = hostOf(fluidbox);
  let targets = [...new Set(options.targets)];
  let onPreviewChange = options.onPreviewChange;
  let element: HTMLElement | null = null;
  let registered = "";
  let dispose: (() => void) | undefined;
  let preload: (() => void) | undefined;
  let preloadTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPreviewId: string | null = null;

  // Indexes name whichever item is there now; ids are looked up as they are.
  const ids = () => {
    const list = fluidbox.items;
    const known: string[] = [];
    for (const target of targets) {
      if (typeof target === "string") {
        if (indexIn(list, target) !== null) known.push(target);
      } else if (Number.isInteger(target) && target >= 0 && target < list.count) {
        known.push(idOf(list.get(target)));
      }
    }
    return [...new Set(known)];
  };
  const register = () => {
    const known = element ? ids() : [];
    const key = element && known.length ? known.join("\u0000") : "";
    if (key === registered && (dispose || !key)) return;
    dispose?.();
    dispose = undefined;
    registered = key;
    if (!element || !key) return;
    const origin: RuntimeOrigin = {
      ...resolveOrigin(element),
      prepareClose: (item, index) => {
        lastPreviewId = idOf(item);
        onPreviewChange?.(item as TItem, index);
      },
    };
    dispose = host.registerOrigin(known, origin);
  };
  const discardPreload = () => {
    clearTimeout(preloadTimer);
    preloadTimer = undefined;
    preload?.();
    preload = undefined;
  };
  const preview = (state: FluidboxState<TItem>): FluidboxTriggerPreview<TItem> => {
    const known = ids();
    const activeId = state.id && known.includes(state.id) ? state.id : null;
    const list = fluidbox.items;
    const first = known[0];
    const shown = activeId ?? lastPreviewId ?? first;
    const index =
      (shown === undefined ? null : indexIn(list, shown)) ??
      (first === undefined ? null : indexIn(list, first));
    return {
      item: index === null ? null : (list.get(index) as TItem),
      index,
      status: activeId ? state.status : "closed",
    };
  };
  // A trigger that shows the last viewed item reopens on it, so the flight
  // starts from the picture the trigger is showing.
  const openTarget = (): FluidboxTarget | undefined => {
    const shown = preview(fluidbox.state);
    return shown.index ?? ids()[0];
  };

  return {
    setElement(next) {
      if (next === element) return;
      element = next;
      registered = "";
      if (next) {
        next.dataset.fluidboxTrigger = "";
        if (!next.hasAttribute("aria-haspopup")) next.setAttribute("aria-haspopup", "dialog");
        if (!next.hasAttribute("aria-expanded")) next.setAttribute("aria-expanded", "false");
      }
      register();
    },
    update(next) {
      onPreviewChange = next.onPreviewChange;
      const nextTargets = [...new Set(next.targets)];
      if (nextTargets.join("\u0000") === targets.join("\u0000")) return;
      targets = nextTargets;
      register();
    },
    refresh: register,
    preview,
    pointerDown(event) {
      if (event.defaultPrevented || !event.isPrimary || event.button !== 0) return;
      discardPreload();
      const target = openTarget();
      if (target !== undefined) preload = host.preload(target);
    },
    pointerUp() {
      clearTimeout(preloadTimer);
      preloadTimer = setTimeout(discardPreload, PRELOAD_GRACE);
    },
    pointerCancel: discardPreload,
    click(event) {
      const target = openTarget();
      if (!event.defaultPrevented && target !== undefined) {
        void host.command("open", target, "trigger");
      }
    },
    destroy() {
      discardPreload();
      dispose?.();
      dispose = undefined;
      element = null;
      registered = "";
    },
  };
}

/**
 * Make an element a trigger with DOM listeners, for plain JavaScript and the
 * custom elements. Framework bindings wire createTrigger into their own events.
 */
export function bindTrigger<TItem extends FluidboxItem = FluidboxItem>(
  fluidbox: Fluidbox<TItem>,
  element: HTMLElement,
  options: FluidboxTriggerOptions<TItem>,
): FluidboxTrigger<TItem> {
  const trigger = createTrigger(fluidbox, options);
  const events = new AbortController();
  const { signal } = events;
  element.addEventListener("pointerdown", (event) => trigger.pointerDown(event), {
    signal,
    passive: true,
  });
  element.addEventListener("pointerup", () => trigger.pointerUp(), { signal, passive: true });
  element.addEventListener("pointercancel", () => trigger.pointerCancel(), {
    signal,
    passive: true,
  });
  element.addEventListener("click", (event) => trigger.click(event), { signal });
  trigger.setElement(element);
  const destroy = trigger.destroy.bind(trigger);
  return Object.assign(trigger, {
    destroy() {
      events.abort();
      destroy();
    },
  });
}
