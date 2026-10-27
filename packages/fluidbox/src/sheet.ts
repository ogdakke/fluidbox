import type {
  FluidboxDispose,
  FluidboxExtensionContext,
  FluidboxExtensionInstance,
  FluidboxItem,
  FluidboxSource,
} from "./runtime-types";
import type { Addon } from "./addons";
import { chromeReach } from "./chrome-reach";
import type {
  FluidboxItem as PublicItem,
  FluidboxReason,
  FluidboxSheet,
  FluidboxSheetOptions,
} from "./public-api";
import { PhotoRoom } from "./photo-room";
import { FluidboxSheetEvent } from "./sheet-event";

export type { FluidboxSheet, FluidboxSheetOptions, FluidboxSheetSnapPoint } from "./public-api";
import type { FluidboxSheetSnapPoint } from "./public-api";

/** How a swipe down closes the viewer, or "none" while the Root's `dismiss.drag` is off. */
type FluidboxSheetDismiss = NonNullable<FluidboxSheetOptions["dismissMotion"]> | "none";

const DEFAULT_SNAP_POINTS: readonly FluidboxSheetSnapPoint[] = ["60%", "content"];
/** Stops closer than this are one stop. */
const MIN_STOP_GAP = 24;
/** Finger travel before a touch on the photo counts as a direction. */
const AXIS_THRESHOLD = 4;
/** How long the rest of a committed scroll dismiss fades, in milliseconds. */
const DISMISS_FADE = 180;
/** A trackpad's momentum has ended once no scroll or wheel comes for this long. */
const MOMENTUM_QUIET = 100;
/** The longest a close waits for that momentum to end. */
const MOMENTUM_LIMIT = 1500;
/** A wheel this much stronger than the last is a new swipe, not the momentum running down. */
const WHEEL_GROWTH = 1.25;
/** Since the last touch, a scroll dismiss counts as the wheel's. */
const TOUCH_MEMORY = 1000;
/** Below this share of the first stop, a lowering sheet takes a pull down as the flight. */
const LANDING = 0.6;
/** Pixels a sheet must come down, while a field has focus, before the keyboard goes. */
const LOWERING = 8;
/** How long the keyboard is followed after a field gains or loses focus, as it slides. */
const KEYBOARD_TRANSITION = 700;

const NO_KEYBOARD_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** A field the software keyboard opens for, as React Aria's willOpenKeyboard decides. */
function opensKeyboard(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement) return !NO_KEYBOARD_INPUTS.has(element.type);
  return element instanceof HTMLTextAreaElement || element.isContentEditable;
}

type ScrollTimelineConstructor = new (options: {
  source: Element;
  axis?: "block" | "inline" | "x" | "y";
}) => AnimationTimeline;

/** A property that follows the scroll: `from` until `start` pixels, `to` from `end` on. */
type Track = [
  element: HTMLElement,
  name: string,
  from: number,
  to: number,
  start: number,
  end: number,
  write?: (value: number) => string,
];

const px = (value: number) => `${value}px`;

/**
 * A sheet that rises over the photo, moved by the browser's own scrolling: the
 * photo and the sheet share one scroller with a snap point per stop, so swipes,
 * momentum and rubber-banding are native, and scroll-driven animations fit the
 * photo into the room above it.
 */
export function createSheet(
  options: FluidboxSheetOptions<PublicItem>,
  onChange: (event: FluidboxSheetEvent) => void,
): Addon<FluidboxSheet> {
  let stop = 0;
  let instance: SheetRuntime | undefined;
  const announce = (next: number, reason: FluidboxReason) => {
    if (next === stop) return;
    stop = next;
    onChange(new FluidboxSheetEvent("sheetchange", { snap: stop, reason }));
  };
  return {
    handle: {
      get snap() {
        return stop;
      },
      setSnap(next, setOptions) {
        instance?.set(next, setOptions?.animate ?? true, "api");
      },
    },
    extension: {
      mount(context) {
        instance = new SheetRuntime(context, options, announce, () => {
          instance = undefined;
          announce(0, "api");
        });
        return instance;
      },
    },
  };
}

class SheetRuntime implements FluidboxExtensionInstance<FluidboxItem> {
  readonly slot: HTMLDivElement;
  readonly #dialog: HTMLElement;
  readonly #overlay: HTMLElement;
  readonly #scroller: HTMLDivElement;
  readonly #stage: HTMLDivElement;
  readonly #context: FluidboxExtensionContext<FluidboxItem>;
  readonly #options: FluidboxSheetOptions<PublicItem>;
  readonly #dismiss: FluidboxSheetDismiss;
  readonly #announce: (stop: number, reason: FluidboxReason) => void;
  /** What moved the sheet last: a native scroll is the pointer's unless a command said otherwise. */
  #reason: FluidboxReason = "pointer";
  readonly #onDestroy: () => void;
  /** The name the runtime last gave the section. */
  #label: string;
  readonly #lifetime = new AbortController();
  readonly #room: PhotoRoom;
  readonly #timeline: AnimationTimeline | undefined;
  #stateAnimations: Animation[] = [];
  #tracks: Track[] = [];
  #stateFrame = 0;
  #lastTouch = -Infinity;
  #wheelDismiss = false;
  /** The last wheel: when, how strong, and whether the sheet was raised. */
  #wheel = { at: -Infinity, size: 0, raised: false };
  #holding = false;
  #holdTimer: ReturnType<typeof setTimeout> | undefined;
  readonly #resize: ResizeObserver;
  readonly #unsubscribe: FluidboxDispose;
  #strip: HTMLElement | null = null;
  #source: FluidboxSource<FluidboxItem>;
  readonly #owned: HTMLElement;
  #rendered: { index: number; controller: AbortController; dispose?: FluidboxDispose } | undefined;
  #stop = 0;
  /** Scroll offsets of the stops, rest first. */
  #offsets: number[] = [0];
  #rest = 0;
  #range = 0;
  #layout = "";
  #touch:
    | { x: number; y: number; flight: boolean | undefined; landing: boolean; landed?: boolean }
    | undefined;
  #returnFocus: HTMLElement | null = null;
  #focusOnSettle = false;
  #dismissed = false;
  #entered = false;
  #dismissObserver: IntersectionObserver | undefined;
  #touching = false;
  #heading = false;
  #fade: Animation | undefined;
  #keyboard = 0;
  #stripMoving = false;
  #measurePending = false;
  #stripTimer: ReturnType<typeof setTimeout> | undefined;
  #keyboardUntil = 0;
  #keyboardFrame = 0;
  #unlockPage: (() => void) | undefined;
  #fieldTap: { field: HTMLElement; x: number; y: number } | undefined;
  /** While a field has focus: the highest the sheet has been, to tell a lowering. */
  #typingTop: number | undefined;

  constructor(
    context: FluidboxExtensionContext<FluidboxItem>,
    options: FluidboxSheetOptions<PublicItem>,
    announce: (stop: number, reason: FluidboxReason) => void,
    onDestroy: () => void,
  ) {
    this.#context = context;
    this.#dialog = context.dialog;
    this.#overlay = this.#dialog.closest<HTMLElement>("[data-fluidbox-viewer]") ?? this.#dialog;
    this.#source = context.source;
    this.#options = options;
    this.#dismiss = context.gestures.dismiss.drag ? (options.dismissMotion ?? "flight") : "none";
    this.#announce = announce;
    this.#onDestroy = onDestroy;
    const document = this.#dialog.ownerDocument;
    const signal = AbortSignal.any([this.#lifetime.signal, context.signal]);

    // One scroller holds the photos and the sheet: space to scroll the photo
    // away into, the stage the photos rest in, and the sheet's slot below it.
    // The stage is sticky in a box that ends where the sheet meets the photo,
    // so from there the sheet pushes it up in the same frame as the scroll.
    this.#scroller = document.createElement("div");
    this.#scroller.dataset.fluidboxSheetScroller = "";
    const hold = document.createElement("div");
    hold.dataset.fluidboxSheetHold = "";
    const space = document.createElement("div");
    space.dataset.fluidboxSheetSpace = "";
    this.#stage = document.createElement("div");
    this.#stage.dataset.fluidboxSheetStage = "";
    const push = document.createElement("div");
    push.dataset.fluidboxSheetPush = "";
    hold.append(space, this.#stage, push);
    this.slot = document.createElement("div");
    this.slot.dataset.fluidboxSheetSlot = "";
    this.#scroller.append(hold, this.slot);
    this.#strip = this.#dialog.querySelector<HTMLElement>("[data-fluidbox-slides]");
    (this.#strip ?? this.#dialog.firstElementChild)?.before(this.#scroller);
    if (this.#strip) this.#stage.append(this.#strip);

    this.#dialog.dataset.fluidboxSheetHost = "";
    this.#overlay.dataset.fluidboxSheetOverlay = "";
    this.#overlay.dataset.sheetDismiss = this.#dismiss;
    this.#dialog.dataset.sheet = "0";
    this.#owned = document.createElement("section");
    this.#owned.dataset.fluidboxSheet = "";
    this.#owned.dataset.fluidboxChrome = "";
    // Its text scrolls and selects natively, and its keys are its own.
    this.#owned.dataset.fluidboxOwnsInput = "";
    this.#label = context.labels.sheet;
    this.#owned.setAttribute("aria-label", this.#label);
    this.slot.append(this.#owned);

    const view = document.defaultView!;
    const Timeline = (view as unknown as { ScrollTimeline?: ScrollTimelineConstructor })
      .ScrollTimeline;
    this.#timeline = Timeline ? new Timeline({ source: this.#scroller, axis: "block" }) : undefined;
    this.#room = new PhotoRoom(
      this.#dialog,
      {
        photo: "--fluidbox-sheet-photo",
        gap: "--fluidbox-sheet-gap",
        inset: "--fluidbox-sheet-fit-inset",
        limit: "--fluidbox-sheet-fit-limit",
      },
      this.#stage,
    );

    // Nothing here runs while the sheet moves: the browser scrolls it, and
    // scroll-driven animations move the photo. Only the end of a scroll is read,
    // and the wheel, to stop a trackpad's momentum at rest.
    this.#scroller.addEventListener("wheel", this.#onWheel, { passive: false, signal });
    this.#scroller.addEventListener("scrollend", this.#onScrollEnd, { signal });
    if (!("onscrollend" in view)) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      this.#scroller.addEventListener(
        "scroll",
        () => {
          clearTimeout(timer);
          timer = setTimeout(this.#onScrollEnd, 120);
        },
        { passive: true, signal },
      );
    }
    if (!this.#timeline) {
      this.#scroller.addEventListener("scroll", this.#onScriptedScroll, { passive: true, signal });
    }
    view.addEventListener("resize", () => this.#remeasure(true), { signal });
    view.visualViewport?.addEventListener("resize", this.#onViewport, { signal });
    view.visualViewport?.addEventListener("scroll", this.#onViewport, { signal });
    // A field in the sheet: the page must not scroll to reveal it, and the
    // sheet makes room above the keyboard itself, as React Aria's sheet does.
    this.slot.addEventListener("touchstart", this.#onFieldTouch, { passive: true, signal });
    this.slot.addEventListener("touchmove", this.#onFieldMove, { passive: true, signal });
    this.slot.addEventListener("touchend", this.#onFieldTap, { passive: false, signal });
    this.slot.addEventListener("focusin", this.#onFieldFocus, { signal });
    this.slot.addEventListener("focusout", this.#onFieldFocus, { signal });
    this.#resize = new ResizeObserver(this.#onContentResize);
    this.#resize.observe(this.slot);
    // The sheet's content changes with the item as the strip swipes. Measuring
    // then would rebuild the photos' animations and move the snap points under
    // a strip still snapping, which WebKit leaves stuck between slides; so the
    // measure waits for the strip to come to rest.
    if (this.#strip) {
      const strip = this.#strip;
      strip.addEventListener("scroll", this.#onStripScroll, { passive: true, signal });
      strip.addEventListener("scrollend", this.#onStripRest, { signal });
    }
    // Triggers anywhere in the viewer, and taps above a raised sheet, before the
    // viewer reads them as a close.
    (this.#dialog.parentElement ?? this.#dialog).addEventListener("click", this.#onClick, {
      capture: true,
      signal,
    });
    // The one decision made in script: a pull down on the resting photo is the
    // viewer's flight, so the browser must not scroll it.
    if (this.#dismiss === "flight") {
      this.#stage.addEventListener("touchstart", this.#onTouchStart, { passive: true, signal });
      this.#stage.addEventListener("touchmove", this.#onTouchMove, { passive: false, signal });
      this.#stage.addEventListener("touchend", this.#onTouchEnd, { passive: true, signal });
      this.#stage.addEventListener("touchcancel", this.#onTouchEnd, { passive: true, signal });
    }
    if (this.#dismiss === "scroll") {
      this.#dismissObserver = new IntersectionObserver(this.#onStageVisibility, {
        root: this.#scroller,
        threshold: [0],
      });
      this.#dismissObserver.observe(this.#stage);
      this.#scroller.addEventListener("touchstart", this.#onDismissTouch, {
        passive: true,
        signal,
      });
      this.#scroller.addEventListener("touchend", this.#onDismissRelease, {
        passive: true,
        signal,
      });
      this.#scroller.addEventListener("touchcancel", this.#onDismissRelease, {
        passive: true,
        signal,
      });
    }
    this.#unsubscribe = context.controller.subscribe((state) => {
      if (state.status === "closed") {
        this.#reset();
        return;
      }
      const index = state.index;
      if (index !== null) this.#renderItem(index);
      // Triggers rendered with the viewer's content arrive after the sheet attached.
      if (state.status === "open") this.#syncTriggers();
    });
    // A sheet added by update() on an open viewer has no state change to wait for.
    const index = context.controller.state.index;
    if (index !== null) this.#renderItem(index);
  }

  get #element() {
    return this.#owned;
  }

  get #enabled() {
    return (
      !!this.#element &&
      getComputedStyle(this.#dialog).getPropertyValue("--fluidbox-sheet-enabled").trim() !== "0"
    );
  }

  get #open() {
    return this.#context.controller.state.status === "open";
  }

  get #raised() {
    return this.#scroller.scrollTop > this.#rest + 1;
  }

  #length(name: string) {
    return Number.parseFloat(getComputedStyle(this.#dialog).getPropertyValue(name)) || 0;
  }

  // Extension hooks.

  relabel() {
    // A name the page gave the section itself stays.
    const label = this.#context.labels.sheet;
    if (this.#owned.getAttribute("aria-label") === this.#label) {
      this.#owned.setAttribute("aria-label", label);
    }
    this.#label = label;
  }

  setSource(source: FluidboxSource<FluidboxItem>) {
    if (source === this.#source) return;
    this.#source = source;
    this.#clearRender();
  }

  attach() {
    // A detached scroller forgets where it was; every opening starts at rest.
    this.#layout = "";
    this.#measure();
    this.#scroller.scrollTop = this.#rest;
    this.#reason = "api";
    this.#setStop(0);
  }

  claimDrag(deltaY: number) {
    if (!this.#enabled) return false;
    // A pull down on the resting photo is the viewer's dismiss; the browser
    // scrolls everything else, so there is nothing for the viewer to do.
    if (this.#dismiss !== "flight" || deltaY <= 0) return true;
    if (!this.#raised) return false;
    if (!this.#touch?.landing) return true;
    this.#land();
    return false;
  }

  wheel(deltaY: number) {
    if (!this.#open || !this.#enabled) return false;
    if (this.#holding) return true;
    if (this.#dismiss === "flight" && deltaY < 0 && !this.#raised) return false;
    this.#reason = "wheel";
    return "native" as const;
  }

  keydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !this.#raised || !this.#open) return false;
    this.set(0, true, "keyboard");
    return true;
  }

  allowsZoom() {
    return !this.#enabled || Math.abs(this.#scroller.scrollTop - this.#rest) <= 1;
  }

  beforeClose() {
    this.#dropKeyboard();
    if (this.#dismissed) {
      // The photo is mostly gone already; the rest fades as the scroll goes on.
      const fade = this.#overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : DISMISS_FADE,
        easing: "ease-out",
        fill: "forwards",
      });
      this.#fade = fade;
      return Promise.all([
        fade.finished.catch(() => undefined),
        this.#wheelDismiss ? this.#momentumEnd() : undefined,
      ]).then(() => undefined);
    }
    if (!this.#raised) return;
    // The flight doesn't wait for the sheet: the photo holds the pose it has,
    // the flight takes it from there, and the sheet goes down as it flies.
    this.#room.freeze();
    this.#scrollTo(0, true);
  }

  /** Resolves once no scroll or wheel has come for a moment, or after a limit. */
  #momentumEnd() {
    return new Promise<void>((resolve) => {
      const view = this.#dialog.ownerDocument.defaultView!;
      const events = new AbortController();
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        clearTimeout(quiet);
        clearTimeout(limit);
        events.abort();
        resolve();
      };
      const wait = () => {
        clearTimeout(quiet);
        quiet = setTimeout(done, MOMENTUM_QUIET);
      };
      const limit = setTimeout(done, MOMENTUM_LIMIT);
      const options = { passive: true, signal: events.signal };
      this.#scroller.addEventListener("scroll", wait, options);
      view.addEventListener("wheel", wait, options);
      this.#lifetime.signal.addEventListener("abort", done, { once: true });
      wait();
    });
  }

  closesInPlace() {
    return this.#dismissed;
  }

  // The photo leaves by scrolling, not by flying home, so its thumbnail stays in view.
  keepsThumbnail() {
    return this.#dismiss === "scroll";
  }

  destroy() {
    this.#lifetime.abort();
    clearTimeout(this.#stripTimer);
    clearTimeout(this.#holdTimer);
    cancelAnimationFrame(this.#keyboardFrame);
    cancelAnimationFrame(this.#stateFrame);
    this.#unlockPage?.();
    this.#resize.disconnect();
    this.#dismissObserver?.disconnect();
    this.#room.destroy();
    this.#trackState(false, 0, 0, 0);
    this.#unsubscribe();
    this.#clearRender();
    if (this.#strip) this.#scroller.replaceWith(this.#strip);
    else this.#scroller.remove();
    delete this.#dialog.dataset.fluidboxSheetHost;
    delete this.#dialog.dataset.sheet;
    delete this.#overlay.dataset.fluidboxSheetOverlay;
    delete this.#overlay.dataset.sheetDismiss;
    this.#overlay.removeAttribute("data-sheet-dismissed");
    for (const name of Array.from(this.#overlay.style)) {
      if (name.startsWith("--fluidbox-sheet-")) this.#overlay.style.removeProperty(name);
    }
    this.#onDestroy();
  }

  // Public control.

  set(stop: number, animate: boolean, reason: FluidboxReason) {
    if (!this.#open || !this.#enabled) return;
    this.#reason = reason;
    if (stop < this.#stop) this.#dropKeyboard();
    this.#measure();
    this.#scrollTo(stop, animate);
  }

  // Content.

  #renderItem(index: number) {
    const render = this.#options.render;
    const target = this.#owned;
    if (!render || !target || this.#rendered?.index === index) return;
    this.#clearRender();
    const controller = new AbortController();
    const item = this.#source.getItem(index);
    const dispose = render({ item, index, target, signal: controller.signal }) ?? undefined;
    this.#rendered = { index, controller, dispose };
  }

  #clearRender() {
    if (!this.#rendered) return;
    this.#rendered.controller.abort();
    this.#rendered.dispose?.();
    this.#rendered = undefined;
    this.#owned?.replaceChildren();
  }

  // Geometry: lengths CSS lays the scroller out with, and a snap marker per stop.

  #measure() {
    const element = this.#element;
    const view = this.#dialog.ownerDocument.defaultView!;
    const enabled = this.#enabled;
    const height = this.#dialog.clientHeight;
    const reach = enabled ? chromeReach(view) : 0;
    const peek = enabled ? this.#length("--fluidbox-sheet-peek") : 0;
    // Far enough that the stage has left the scroller, bars and all, at scroll 0.
    const dismiss = enabled && this.#dismiss === "scroll" ? height + reach + 1 : 0;
    // A sheet that doesn't peek rests below the bars, not under them.
    const lead = enabled && peek <= 0 ? reach : 0;
    // The sheet pads itself under the toolbar by the reach; that part never shows.
    const tallest = element
      ? (Number.parseFloat(getComputedStyle(element).maxHeight) || height + reach) - reach
      : 0;
    // The keyboard's padding is not the sheet's own height.
    const content =
      enabled && element ? Math.min(tallest, element.offsetHeight - reach - this.#keyboard) : 0;
    // Every stop is reachable: the sheet grows to the tallest, as other sheets do.
    const visible = [peek];
    let required = 0;
    for (const point of this.#options.snapPoints ?? DEFAULT_SNAP_POINTS) {
      const pixels =
        point === "content"
          ? content
          : typeof point === "number"
            ? point
            : (height * Number.parseFloat(point)) / 100;
      const next = Math.min(tallest, Math.max(peek, pixels));
      // "content" follows the sheet; only a set height may stretch it.
      if (point !== "content") required = Math.max(required, next);
      if (next - visible.at(-1)! >= MIN_STOP_GAP) visible.push(next);
    }
    const offsets = visible.map((shown, index) =>
      index ? Math.round(dismiss + lead + shown - peek) : dismiss,
    );
    const range = Math.max(offsets.at(-1)!, dismiss + lead + content - peek);
    // With push, the stage holds until the sheet meets the active photo; with
    // fit, through the sheet's whole rise, while the photo shrinks above it. A
    // longer hold would lengthen the scroller.
    const rise = range - dismiss;
    const push = !enabled
      ? 0
      : this.#room.pushes
        ? Math.min(this.#room.hold(lead, peek), rise)
        : rise;
    const layout = [enabled, height, reach, peek, dismiss, content, push, ...offsets].join();
    if (layout === this.#layout) return false;
    this.#layout = layout;
    this.#rest = dismiss;
    this.#offsets = offsets;
    this.#range = range;
    this.#dialog.toggleAttribute("data-sheet-off", !enabled);
    this.#dialog.toggleAttribute("data-sheet-peeking", peek > 0);
    const style = this.#overlay.style;
    const px = (value: number) => `${value}px`;
    style.setProperty("--fluidbox-sheet-reach", px(reach));
    style.setProperty("--fluidbox-sheet-lead", px(lead));
    style.setProperty("--fluidbox-sheet-dismiss-distance", px(dismiss));
    style.setProperty("--fluidbox-sheet-push", px(push));
    style.setProperty("--fluidbox-sheet-stage-height", px(height));
    style.setProperty("--fluidbox-sheet-range", px(this.#range));
    style.setProperty("--fluidbox-sheet-height", px(content));
    style.setProperty("--fluidbox-sheet-min-height", px(enabled ? required : 0));
    this.#placeMarkers(enabled ? [...(dismiss ? [0] : []), ...offsets] : []);
    this.#trackState(enabled, dismiss, offsets[1] ?? dismiss + 1, peek - dismiss - lead);
    this.#room.track(
      enabled && this.#timeline
        ? { timeline: this.#timeline, range: this.#range, from: dismiss, lead }
        : undefined,
      peek,
    );
    return true;
  }

  /**
   * The state variables on the overlay and the backdrop of a scroll dismiss
   * follow the scroll: animations on the scroller's timeline,
   * or, without ScrollTimeline, set in script as it scrolls. As CSS animations
   * the variables would need timeline-scope, and a minifier that expands the
   * shorthand with a 0s duration pins them all at their end.
   */
  #trackState(enabled: boolean, dismiss: number, first: number, visibleStart: number) {
    for (const animation of this.#stateAnimations) animation.cancel();
    for (const [element, name] of this.#tracks) element.style.removeProperty(name);
    this.#stateAnimations = [];
    const tracks: Track[] = (this.#tracks = []);
    const range = this.#range;
    if (!enabled || range <= 0) return;
    const overlay = this.#overlay;
    tracks.push(
      [overlay, "--fluidbox-sheet-visible", visibleStart, visibleStart + range, 0, range, px],
      [overlay, "--fluidbox-sheet-progress", 0, 1, dismiss, first],
      [overlay, "--fluidbox-sheet-expand", 0, 1, first, range],
      [overlay, "--fluidbox-sheet-dismiss", 1, 0, 0, dismiss],
    );
    const backdrop = overlay.querySelector<HTMLElement>(":scope > [data-fluidbox-backdrop]");
    if (this.#dismiss === "scroll" && backdrop)
      tracks.push([backdrop, "opacity", 0, 1, 0, dismiss]);
    const timeline = this.#timeline;
    if (!timeline) {
      this.#applyState();
      return;
    }
    const at = (pixels: number) => Math.min(1, Math.max(0, pixels / range));
    for (const [element, name, from, to, start, end, write = String] of tracks) {
      const frame = (offset: number, value: number) => ({ offset, [name]: write(value) });
      // A track with no length, such as the expand of a sheet whose only stop
      // is its top, steps from one value to the other at its start.
      const keyframes =
        end <= start
          ? [frame(0, from), frame(at(start), from), frame(at(start), to), frame(1, to)]
          : [frame(0, from), frame(at(start), from), frame(at(end), to), frame(1, to)];
      this.#stateAnimations.push(
        element.animate(keyframes, { timeline, fill: "both" } as KeyframeAnimationOptions),
      );
    }
  }

  #applyState() {
    const top = this.#scroller.scrollTop;
    for (const [element, name, from, to, start, end, write = String] of this.#tracks) {
      const share =
        end <= start
          ? Number(top >= start)
          : Math.min(1, Math.max(0, (top - start) / (end - start)));
      element.style.setProperty(name, write(from + (to - from) * share));
    }
  }

  #onScriptedScroll = () => {
    if (this.#stateFrame) return;
    this.#stateFrame = requestAnimationFrame(() => {
      this.#stateFrame = 0;
      this.#applyState();
    });
  };

  #placeMarkers(offsets: number[]) {
    const markers = [...this.#scroller.querySelectorAll<HTMLElement>("[data-fluidbox-sheet-mark]")];
    for (const [index, offset] of offsets.entries()) {
      let marker = markers[index];
      if (!marker) {
        marker = this.#dialog.ownerDocument.createElement("div");
        marker.dataset.fluidboxSheetMark = "";
        this.#scroller.append(marker);
      }
      marker.style.top = `${offset}px`;
      // A flick from the top can't fly past the resting photo into a dismiss.
      marker.toggleAttribute("data-rest", offset === this.#rest);
    }
    for (const marker of markers.slice(offsets.length)) marker.remove();
  }

  #onContentResize = () => {
    if (this.#stripMoving) this.#measurePending = true;
    else this.#remeasure(false);
  };

  #onStripScroll = () => {
    this.#stripMoving = true;
    // Without scrollend, a pause stands in for it.
    if ("onscrollend" in window) return;
    clearTimeout(this.#stripTimer);
    this.#stripTimer = setTimeout(this.#onStripRest, 150);
  };

  #onStripRest = () => {
    clearTimeout(this.#stripTimer);
    this.#stripMoving = false;
    // A pushed stage holds for the photo in view, so a new one remeasures.
    if (!this.#measurePending && !this.#room.pushes) return;
    this.#measurePending = false;
    this.#remeasure(false);
  };

  #remeasure(window: boolean) {
    if (this.#context.controller.state.status === "closed") return;
    if (window) this.#room.forget();
    if (!this.#measure() && !window) return;
    // The browser re-snaps to the same marker after a layout change; a window
    // resize moves every marker, so the sheet goes back to its stop itself.
    if (window) this.#scroller.scrollTop = this.#offsets[this.#stop] ?? this.#rest;
  }

  // The keyboard. Safari scrolls the page to show a focused field, but the
  // viewer is pinned to the page's scroll, so the field would move with it. So
  // while a field in the sheet is focused the page can't scroll, and the sheet
  // pads itself by the part the keyboard covers, as React Aria's sheet does.

  // Safari pans the screen to a field it focuses itself, and the viewer, pinned
  // to the page, can't follow. So a tap on a field focuses it from script with
  // preventScroll instead, as React Aria does, and nothing pans.
  #onFieldTouch = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const touch = event.touches[0];
    this.#fieldTap = undefined;
    if (!opensKeyboard(target) || !touch || event.touches.length !== 1) return;
    this.#lockPage();
    if (target !== this.#dialog.ownerDocument.activeElement) {
      this.#fieldTap = { field: target, x: touch.clientX, y: touch.clientY };
    }
  };

  #onFieldMove = (event: TouchEvent) => {
    const tap = this.#fieldTap;
    const touch = event.touches[0];
    if (tap && touch && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > 10) {
      this.#fieldTap = undefined;
    }
  };

  #onFieldTap = (event: TouchEvent) => {
    const tap = this.#fieldTap;
    this.#fieldTap = undefined;
    if (!tap || !event.cancelable || !tap.field.isConnected) return;
    event.preventDefault();
    tap.field.focus({ preventScroll: true });
  };

  #onFieldFocus = (event: FocusEvent) => {
    const field = event.type === "focusin" ? event.target : event.relatedTarget;
    if (
      opensKeyboard(field instanceof Element ? field : null) &&
      this.slot.contains(field as Node)
    ) {
      this.#lockPage();
      // Focus moving to a field by other means, as the keyboard's arrows do:
      // focus it again without the scroll, as React Aria's handleBlur does.
      if (event.type === "focusout") (field as HTMLElement).focus({ preventScroll: true });
      this.#startTyping();
    } else if (event.type === "focusout") {
      this.#unlockPage?.();
      this.#unlockPage = undefined;
      this.#typingTop = undefined;
      this.#scroller.removeEventListener("scroll", this.#onTypingScroll);
    }
    this.#followKeyboard();
  };

  #startTyping() {
    if (this.#typingTop !== undefined) return;
    this.#typingTop = this.#scroller.scrollTop;
    // Only while a field has focus does script watch the scroll, for the one
    // thing CSS can't do: put the keyboard away as soon as the sheet goes down.
    this.#scroller.addEventListener("scroll", this.#onTypingScroll, { passive: true });
  }

  #onTypingScroll = () => {
    const top = this.#scroller.scrollTop;
    if (this.#typingTop === undefined) return;
    if (top > this.#typingTop) {
      this.#typingTop = top;
      return;
    }
    if (this.#typingTop - top > LOWERING) this.#dropKeyboard();
  };

  /** Move focus from a field to the sheet, which puts the keyboard away. */
  #dropKeyboard() {
    const document = this.#dialog.ownerDocument;
    const element = this.#element;
    if (!opensKeyboard(document.activeElement) || !this.slot.contains(document.activeElement)) {
      return;
    }
    if (element && !element.hasAttribute("tabindex")) element.tabIndex = -1;
    if (element) element.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement).blur();
  }

  #lockPage() {
    const view = this.#dialog.ownerDocument.defaultView!;
    if (this.#unlockPage || !view.matchMedia("(pointer: coarse)").matches) return;
    const root = this.#dialog.ownerDocument.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    this.#unlockPage = () => (root.style.overflow = previous);
  }

  // WebKit reports the keyboard once as it starts to slide, so it is read each
  // frame until it has settled, as React Aria's runAfterKeyboard does.
  #followKeyboard() {
    this.#keyboardUntil = performance.now() + KEYBOARD_TRANSITION;
    if (this.#keyboardFrame) return;
    const frame = () => {
      this.#onViewport();
      this.#keyboardFrame =
        performance.now() < this.#keyboardUntil ? requestAnimationFrame(frame) : 0;
      if (!this.#keyboardFrame) this.#revealField();
    };
    this.#keyboardFrame = requestAnimationFrame(frame);
  }

  #onViewport = () => {
    const viewport = this.#dialog.ownerDocument.defaultView?.visualViewport;
    const focused = this.#dialog.ownerDocument.activeElement;
    let keyboard = 0;
    if (viewport && opensKeyboard(focused) && this.slot.contains(focused)) {
      // What the keyboard takes from the viewer, as React Aria reckons it:
      // its height less the visible height. Nothing pans, so that is the overlap.
      keyboard = Math.max(0, Math.round(this.#dialog.clientHeight - viewport.height));
    }
    if (keyboard === this.#keyboard) return;
    this.#keyboard = keyboard;
    this.#overlay.style.setProperty("--fluidbox-sheet-keyboard", `${keyboard}px`);
  };

  /**
   * Scroll a focused field to the middle of what the keyboard leaves, in each
   * scroller it is in up to the sheet's own, as React Aria's usePreventScroll does.
   */
  #revealField() {
    const document = this.#dialog.ownerDocument;
    const field = document.activeElement;
    const viewport = document.defaultView?.visualViewport;
    if (!opensKeyboard(field) || !this.slot.contains(field) || !viewport) return;
    let target: HTMLElement = field;
    for (
      let area = target.parentElement;
      area && this.#scroller.contains(area);
      area = area.parentElement
    ) {
      const overflow = getComputedStyle(area).overflowY;
      if (!/auto|scroll/.test(overflow) || area.scrollHeight <= area.clientHeight) continue;
      const box = area.getBoundingClientRect();
      const bottom = Math.min(box.bottom, viewport.offsetTop + viewport.height);
      const rect = target.getBoundingClientRect();
      if (rect.top < box.top || rect.bottom > bottom) {
        const adjustment = rect.top - box.top - ((bottom - box.top) / 2 - rect.height / 2);
        area.scrollTo({
          top: Math.max(
            0,
            Math.min(area.scrollHeight - area.clientHeight, area.scrollTop + adjustment),
          ),
          behavior: "smooth",
        });
      }
      target = area;
    }
  }

  // Stops.

  #nearestStop() {
    const top = this.#scroller.scrollTop;
    let best = 0;
    for (const [index, offset] of this.#offsets.entries()) {
      if (Math.abs(offset - top) < Math.abs(this.#offsets[best]! - top)) best = index;
    }
    return best;
  }

  #scrollTo(stop: number, animate: boolean) {
    const index = Math.max(0, Math.min(stop, this.#offsets.length - 1));
    const smooth = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = this.#offsets[index]!;
    if (Math.abs(this.#scroller.scrollTop - top) < 1) {
      this.#onScrollEnd();
      return;
    }
    this.#scroller.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
    if (!smooth) this.#onScrollEnd();
  }

  // A trackpad swipe that lowers the sheet goes on as momentum once the sheet
  // is down. Left alone, it would scroll on into the dismiss, or start the
  // viewer's wheel dismiss, only to spring back. So once a wheel lowers the
  // sheet to rest, the sheet holds there while that momentum runs down, the
  // way a wheel dismiss keeps the page from the momentum after it. A pause, a
  // wheel back up, or a wheel growing stronger again is a new swipe, and goes
  // through.

  #onWheel = (event: WheelEvent) => {
    const now = performance.now();
    const size = Math.abs(event.deltaY);
    const last = this.#wheel;
    const momentum = now - last.at < MOMENTUM_QUIET && size <= last.size * WHEEL_GROWTH + 2;
    const raised = this.#raised;
    this.#wheel = { at: now, size, raised };
    if (event.deltaY < 0 && momentum && (this.#holding || (last.raised && !raised))) {
      this.#hold();
      if (event.cancelable) event.preventDefault();
    } else if (this.#holding) {
      this.#release();
    }
  };

  #hold() {
    clearTimeout(this.#holdTimer);
    this.#holdTimer = setTimeout(() => this.#release(), MOMENTUM_QUIET);
    if (this.#holding) return;
    this.#holding = true;
    // Past rest already, into the dismiss space: back to rest.
    if (this.#scroller.scrollTop < this.#rest) this.#scrollTo(0, true);
  }

  #release() {
    clearTimeout(this.#holdTimer);
    if (!this.#holding) return;
    this.#holding = false;
  }

  #onScrollEnd = () => {
    if (this.#dismissed || this.#context.controller.state.status === "closed") return;
    const stop = this.#nearestStop();
    const resting = Math.abs(this.#scroller.scrollTop - this.#offsets[stop]!) <= 2;
    if (!resting) return;
    this.#setStop(stop);
    if (this.#focusOnSettle && stop > 0) {
      this.#focusOnSettle = false;
      const element = this.#element;
      if (element && !element.hasAttribute("tabindex")) element.tabIndex = -1;
      element?.focus({ preventScroll: true });
    }
  };

  #setStop(stop: number) {
    const last = this.#offsets.length - 1;
    const element = this.#element;
    this.#dialog.toggleAttribute("data-sheet-raised", stop > 0);
    // At the top stop the sheet's own content scrolls, and scrolls on into the
    // sheet from its top, as React Aria's sheet does; below it a swipe anywhere
    // on the sheet moves the sheet.
    this.#dialog.toggleAttribute("data-sheet-expanded", stop > 0 && stop === last);
    const away = stop === 0 && !this.#dialog.hasAttribute("data-sheet-peeking");
    element?.toggleAttribute("inert", away);
    if (away && element?.contains(this.#dialog.ownerDocument.activeElement)) {
      (this.#returnFocus?.isConnected ? this.#returnFocus : this.#dialog).focus({
        preventScroll: true,
      });
    }
    this.#syncTriggers(stop);
    if (stop === this.#stop && this.#dialog.dataset.sheet === String(stop)) return;
    this.#stop = stop;
    this.#dialog.dataset.sheet = String(stop);
    const reason = this.#reason;
    this.#reason = "pointer";
    this.#announce(stop, reason);
  }

  #syncTriggers(stop = this.#stop) {
    for (const trigger of this.#dialog.querySelectorAll("[data-fluidbox-sheet-snap]")) {
      trigger.setAttribute("aria-expanded", String(stop > 0));
    }
  }

  #reset() {
    this.#touch = undefined;
    this.#dismissed = false;
    this.#wheelDismiss = false;
    this.#wheel = { at: -Infinity, size: 0, raised: false };
    this.#release();
    this.#entered = false;
    this.#overlay.removeAttribute("data-sheet-dismissed");
    this.#touching = this.#heading = false;
    this.#fade?.cancel();
    this.#fade = undefined;
    this.#focusOnSettle = false;
    this.#returnFocus = null;
    this.#unlockPage?.();
    this.#unlockPage = undefined;
    this.#typingTop = undefined;
    this.#scroller.removeEventListener("scroll", this.#onTypingScroll);
    this.#keyboard = 0;
    this.#overlay.style.removeProperty("--fluidbox-sheet-keyboard");
    this.#room.forget();
    this.#reason = "api";
    if (this.#stop !== 0) this.#setStop(0);
  }

  // The scroll dismiss: the viewer closes once the stage has scrolled out of
  // the bottom of the scroller, as React Aria's sheet does.

  #onStageVisibility = (entries: IntersectionObserverEntry[]) => {
    const entry = entries.at(-1);
    if (!entry || !this.#enabled || this.#dismissed) return;
    if (entry.isIntersecting) this.#entered = true;
    if (!this.#entered || !this.#open || this.#scroller.scrollTop >= this.#rest) return;
    if (!entry.isIntersecting || this.#committed()) this.#dismissNow();
  };

  // Waiting for the photo to scroll all the way off, under the bars too, is a
  // screen's travel at the browser's snap speed, and until then the viewer
  // catches the next swipe meant for the page. React Aria's sheet only has its
  // own height to go. Snapping is mandatory, so a scroll still heading down
  // once the finger is up can only end in the dismiss: the viewer lets go of
  // touches there and then, and fades as the scroll goes on.

  #onDismissTouch = () => {
    this.#lastTouch = performance.now();
    this.#touching = true;
    this.#heading = false;
  };

  #onDismissRelease = () => {
    this.#touching = false;
    const from = this.#scroller.scrollTop;
    if (from >= this.#rest || this.#dismissed) return;
    // The first scroll after the finger lifts tells where the momentum goes.
    this.#scroller.addEventListener(
      "scroll",
      () => {
        this.#heading = this.#scroller.scrollTop < from;
        if (this.#committed()) this.#dismissNow();
      },
      { once: true, passive: true },
    );
  };

  #committed() {
    return !this.#touching && this.#heading;
  }

  #dismissNow() {
    if (this.#dismissed || !this.#open) return;
    this.#dismissed = true;
    // A trackpad's momentum goes on after the photo is gone. Handed to the page
    // at once, it would scroll the page, so a wheel dismiss keeps the scroll
    // until the momentum ends, as React Aria's sheet waits on macOS Safari. A
    // touch dismiss hands touches back to the page straight away.
    this.#wheelDismiss = !this.#touching && performance.now() - this.#lastTouch > TOUCH_MEMORY;
    if (!this.#wheelDismiss) this.#overlay.toggleAttribute("data-sheet-dismissed", true);
    void this.#context.controller.close({ reason: "pointer" });
  }

  // The flight's share of the photo: a pull down from rest.

  #onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    const landing = this.#landing();
    this.#touch =
      touch && event.touches.length === 1 && this.#enabled && (!this.#raised || landing)
        ? { x: touch.clientX, y: touch.clientY, flight: undefined, landing }
        : undefined;
  };

  // A second flick down needn't wait for the first to settle: with the sheet
  // most of the way down, and not resting at a stop, a pull down is the flight.
  #landing() {
    const top = this.#scroller.scrollTop;
    const first = this.#offsets[1];
    if (first === undefined || top <= this.#rest + 1) return false;
    const resting = this.#offsets.some((offset) => Math.abs(offset - top) <= 2);
    return !resting && top - this.#rest < (first - this.#rest) * LANDING;
  }

  /** The rest of the way down, under the flight's drag. */
  #land() {
    if (!this.#touch || this.#touch.landed) return;
    this.#touch.landed = true;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#scroller.scrollTo({ top: this.#rest, behavior: smooth ? "smooth" : "instant" });
  }

  #onTouchMove = (event: TouchEvent) => {
    const touch = this.#touch;
    const point = event.touches[0];
    if (!touch || !point || event.touches.length !== 1) return;
    if (touch.flight === undefined) {
      const dx = point.clientX - touch.x;
      const dy = point.clientY - touch.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_THRESHOLD) return;
      touch.flight = dy > 0 && dy > Math.abs(dx);
    }
    if (!touch.flight) return;
    if (event.cancelable) event.preventDefault();
    if (touch.landing) this.#land();
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (!event.touches.length) this.#touch = undefined;
  };

  #onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest<HTMLElement>("[data-fluidbox-sheet-snap]");
    if (trigger && this.#dialog.contains(trigger)) {
      const stop = Number(trigger.dataset.fluidboxSheetSnap);
      if (!Number.isInteger(stop)) return;
      event.preventDefault();
      event.stopPropagation();
      const next = stop === this.#stop && stop > 0 ? 0 : stop;
      if (next > 0) {
        this.#returnFocus = trigger;
        this.#focusOnSettle = true;
      }
      this.set(next, true, event.detail === 0 ? "keyboard" : "pointer");
      return;
    }
    // A tap above a raised sheet lowers it rather than closing the viewer.
    if (
      this.#raised &&
      !this.slot.contains(target) &&
      !target?.closest("button, a[href], input, select, textarea, [data-fluidbox-owns-input]")
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.set(0, true, "pointer");
    }
  };
}
