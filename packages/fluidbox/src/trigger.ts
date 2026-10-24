import { hostOf } from "./host";
import { idOf, idsIn, indexIn, targetKeys } from "./items";
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
 * `data-fluidbox-origin`, else its image or video, else the trigger itself.
 */
export function resolveOrigin(trigger: HTMLElement): FluidboxOrigin {
  const visual =
    (trigger.matches("[data-fluidbox-origin]")
      ? trigger
      : trigger.querySelector<HTMLElement>("[data-fluidbox-origin]")) ??
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
  /** The item the trigger opens. */
  readonly target: FluidboxTarget<TItem>;
  /** More items that close back onto the trigger. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
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

/** Click details a trigger reads. DOM and framework events both fit. */
export interface FluidboxTriggerClick {
  readonly defaultPrevented: boolean;
  readonly button?: number;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  preventDefault?(): void;
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
  /**
   * Open the viewer on a plain primary click that nothing prevented, and
   * prevent the click so a link trigger stays on the page. A click with a
   * modifier key is left to the link. When the viewer fails to open, a link
   * trigger is followed after all.
   */
  click(event: FluidboxTriggerClick): void;
  destroy(): void;
}

/** Elements a keyboard and a screen reader can use as a trigger. */
const INTERACTIVE = "a[href],button,input,select,textarea,summary,[role],[tabindex]";

/** Whether a bundler built for development. Without one, it says no. */
const development = () => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

/** How long a preload waits for a click after the pointer lifts. */
const PRELOAD_GRACE = 250;
/** How long a mouse rests on a trigger before the viewer's code loads. */
const HOVER_INTENT = 100;

/** Make a trigger for a fluidbox. Call setElement once the element exists. */
export function createTrigger<TItem extends FluidboxItem = FluidboxItem>(
  fluidbox: Fluidbox<TItem>,
  options: FluidboxTriggerOptions<TItem>,
): FluidboxTrigger<TItem> {
  const host = hostOf(fluidbox);
  let targets = targetKeys(options.target, options.returns);
  let onPreviewChange = options.onPreviewChange;
  let element: HTMLElement | null = null;
  let registered = "";
  let dispose: (() => void) | undefined;
  let preload: (() => void) | undefined;
  let preloadTimer: ReturnType<typeof setTimeout> | undefined;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let intents: AbortController | undefined;
  let lastPreviewId: string | null = null;
  let following = false;

  const ids = () => idsIn(fluidbox.items, targets);
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
      onPreviewChange: (item, index) => {
        lastPreviewId = idOf(item);
        onPreviewChange?.(item as TItem, index);
      },
    };
    dispose = host.registerOrigin(known, origin);
  };
  // Signs of a coming press load the viewer's code, if the fluidbox loads it on hover.
  const listenForIntent = (target: HTMLElement) => {
    intents = new AbortController();
    const { signal } = intents;
    const options = { signal, passive: true };
    const leave = () => clearTimeout(hoverTimer);
    target.addEventListener(
      "pointerenter",
      (event) => {
        leave();
        if (event.pointerType !== "mouse") host.intend();
        else hoverTimer = setTimeout(() => host.intend(), HOVER_INTENT);
      },
      options,
    );
    target.addEventListener("pointerleave", leave, options);
    target.addEventListener("focusin", () => host.intend(), options);
    signal.addEventListener("abort", leave);
  };
  const discardPreload = () => {
    clearTimeout(preloadTimer);
    preloadTimer = undefined;
    preload?.();
    preload = undefined;
  };
  const preview = (state: FluidboxState<TItem>): FluidboxTriggerPreview<TItem> => {
    const known = ids();
    const activeId = state.value && known.includes(state.value) ? state.value : null;
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
      intents?.abort();
      if (next) {
        listenForIntent(next);
        next.dataset.fluidboxTrigger = "";
        if (!next.hasAttribute("aria-haspopup")) next.setAttribute("aria-haspopup", "dialog");
        if (development() && !next.matches(INTERACTIVE)) {
          console.warn(
            "A fluidbox trigger needs to be a <button> or <a href>, or to have a role and tabindex:",
            next,
          );
        }
      }
      register();
    },
    update(next) {
      onPreviewChange = next.onPreviewChange;
      const nextTargets = targetKeys(next.target, next.returns);
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
      if (target === undefined) return;
      // A trigger can outlive its fluidbox; a press on it then prepares nothing.
      try {
        preload = fluidbox.preload(target as FluidboxTarget<TItem>);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
      }
    },
    pointerUp() {
      clearTimeout(preloadTimer);
      preloadTimer = setTimeout(discardPreload, PRELOAD_GRACE);
    },
    pointerCancel: discardPreload,
    click(event) {
      const target = openTarget();
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (following || event.defaultPrevented || modified || (event.button ?? 0) !== 0) return;
      if (target === undefined) return;
      event.preventDefault?.();
      const link = element?.closest<HTMLAnchorElement>("a[href]");
      void host.command("open", target, "trigger").catch((error: unknown) => {
        if (!link?.isConnected) throw error;
        // The link's own click, which this one gave up; this trigger lets it through.
        following = true;
        try {
          link.click();
        } finally {
          following = false;
        }
      });
    },
    destroy() {
      discardPreload();
      intents?.abort();
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

/**
 * The element of a thumbnail overlay marked `data-fluidbox-frame-layer`, the
 * overlay itself or one inside it: it moves into the flying frame for the
 * flight and scales with it, as a scrim does.
 */
export function frameLayerOf(overlay: HTMLElement): HTMLElement | undefined {
  return overlay.matches("[data-fluidbox-frame-layer]")
    ? overlay
    : // The still copy a flight leaves on the card is never the layer itself.
      (overlay.querySelector<HTMLElement>(
        "[data-fluidbox-frame-layer]:not([data-fluidbox-ghost])",
      ) ?? undefined);
}
