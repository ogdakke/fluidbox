import type {
  LightboxDispose,
  LightboxExtension,
  LightboxExtensionContext,
  LightboxExtensionInstance,
  LightboxItem,
  LightboxSource,
} from "./public-api";

/** Where the sheet rests: tucked away (or peeking), at its content height, or near the top. */
export type LightboxSheetStop = "photo" | "info" | "full";

export interface LightboxSheetRenderContext<TItem extends LightboxItem = LightboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** The sheet element. Fill it with the item's details. */
  readonly target: HTMLElement;
  /** Aborted when the viewer moves to another item. */
  readonly signal: AbortSignal;
}

export interface LightboxSheetOptions<TItem extends LightboxItem = LightboxItem> {
  /**
   * Fills a runtime-made sheet for the active item. Leave it out and render your
   * own element with `data-lightbox-sheet` into the portal instead, as framework
   * components do.
   */
  readonly render?: (context: LightboxSheetRenderContext<TItem>) => void | LightboxDispose;
  readonly onChange?: (stop: LightboxSheetStop) => void;
}

export interface LightboxSheetSetOptions {
  /** @default true */
  readonly animate?: boolean;
}

/** The sheet extension. Pass it to createLightbox, then drive and read it from here. */
export interface LightboxSheet<
  TItem extends LightboxItem = LightboxItem,
> extends LightboxExtension<TItem> {
  /** The stop the sheet rests at, or is heading to. */
  readonly stop: LightboxSheetStop;
  /** Move the sheet. Ignored while the viewer is not open or the sheet is disabled. */
  set(stop: LightboxSheetStop, options?: LightboxSheetSetOptions): void;
  subscribe(listener: (stop: LightboxSheetStop) => void): LightboxDispose;
}

type Pose = { readonly ty: number; readonly scale: number };
type Rest = {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
};
type Stops = { readonly photo: number; readonly info: number; readonly full: number };

const STIFFNESS = 520;
const DAMPING = 44;
/** Upward speed, in px/ms, past which a release moves on to the next stop. */
const FLING = 0.35;
const AXIS_THRESHOLD = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * A panel that rises over the photo. Swipe or scroll up to raise it, down to lower
 * it, and the photo fits (or is pushed) into the room left above it.
 *
 * ```ts
 * import { sheet } from "@ogdakke/fluidbox/sheet";
 * import "@ogdakke/fluidbox/sheet.css";
 * const details = sheet({ render: ({ item, target }) => (target.textContent = item.id) });
 * createLightbox({ source, sheet: details });
 * details.set("info");
 * ```
 */
export function sheet<TItem extends LightboxItem = LightboxItem>(
  options: LightboxSheetOptions<TItem> = {},
): LightboxSheet<TItem> {
  const listeners = new Set<(stop: LightboxSheetStop) => void>();
  let stop: LightboxSheetStop = "photo";
  let instance: SheetRuntime<TItem> | undefined;
  const announce = (next: LightboxSheetStop) => {
    if (next === stop) return;
    stop = next;
    options.onChange?.(next);
    for (const listener of listeners) listener(next);
  };
  return {
    get stop() {
      return stop;
    },
    set(next, setOptions) {
      instance?.set(next, setOptions?.animate ?? true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mount(context) {
      instance = new SheetRuntime(context, options, announce);
      return instance;
    },
  };
}

class SheetRuntime<TItem extends LightboxItem> implements LightboxExtensionInstance<TItem> {
  readonly #dialog: HTMLElement;
  readonly #context: LightboxExtensionContext<TItem>;
  readonly #options: LightboxSheetOptions<TItem>;
  readonly #announce: (stop: LightboxSheetStop) => void;
  readonly #lifetime = new AbortController();
  readonly #rests = new WeakMap<HTMLElement, Rest>();
  readonly #slideObserver: MutationObserver;
  readonly #unsubscribe: LightboxDispose;
  #source: LightboxSource<TItem>;
  #owned: HTMLElement | undefined;
  #rendered: { index: number; controller: AbortController; dispose?: LightboxDispose } | undefined;
  #stop: LightboxSheetStop = "photo";
  #stops: Stops = { photo: 0, info: 0, full: 0 };
  #visible = 0;
  #velocity = 0;
  #target = 0;
  #frame = 0;
  #lastTime = 0;
  #settled: (() => void)[] = [];
  #drag: { startY: number; startVisible: number; samples: [number, number][] } | undefined;
  #touch:
    | { x: number; y: number; axis: "pending" | "vertical" | "horizontal" | "native" }
    | undefined;
  #wheelLock = 0;
  #suppressClick = false;

  constructor(
    context: LightboxExtensionContext<TItem>,
    options: LightboxSheetOptions<TItem>,
    announce: (stop: LightboxSheetStop) => void,
  ) {
    this.#context = context;
    this.#dialog = context.dialog;
    this.#source = context.source;
    this.#options = options;
    this.#announce = announce;
    this.#dialog.dataset.lightboxSheetHost = "";
    this.#dialog.dataset.sheet = "photo";
    const signal = AbortSignal.any([this.#lifetime.signal, context.signal]);
    if (options.render) {
      this.#owned = this.#dialog.ownerDocument.createElement("section");
      this.#owned.dataset.lightboxSheet = "";
      this.#owned.dataset.lightboxChrome = "";
      this.#owned.setAttribute("aria-label", "Details");
      this.#dialog.append(this.#owned);
    }
    const view = this.#dialog.ownerDocument.defaultView;
    view?.addEventListener("resize", () => this.#remeasure(), { signal });
    // Triggers anywhere in the viewer, and taps above a raised sheet, before the
    // viewer reads them as a close.
    (this.#dialog.parentElement ?? this.#dialog).addEventListener("click", this.#onClick, {
      capture: true,
      signal,
    });
    this.#dialog.addEventListener("touchstart", this.#onTouchStart, { passive: true, signal });
    this.#dialog.addEventListener("touchmove", this.#onTouchMove, { passive: false, signal });
    this.#dialog.addEventListener("touchend", this.#onTouchEnd, { signal });
    this.#dialog.addEventListener("touchcancel", this.#onTouchEnd, { signal });
    this.#dialog.addEventListener("wheel", this.#onSheetWheel, { passive: false, signal });
    // Slides come and go as the strip scrolls; new ones take the current pose.
    this.#slideObserver = new MutationObserver(() => this.#paintSlides());
    this.#slideObserver.observe(this.#dialog, { childList: true, subtree: true });
    let measured = false;
    this.#unsubscribe = context.controller.subscribe((state) => {
      if (state.status === "closed") {
        measured = false;
        this.#reset();
      } else if (!measured) {
        measured = true;
        this.#measure();
        this.#paint((this.#target = this.#stops.photo));
      }
      const index = state.requestedIndex ?? state.activeIndex;
      if (index !== null && state.status !== "closed") this.#renderItem(index);
    });
  }

  get #element() {
    return this.#dialog.querySelector<HTMLElement>("[data-lightbox-sheet]");
  }

  get #enabled() {
    return (
      !!this.#element &&
      getComputedStyle(this.#dialog).getPropertyValue("--lightbox-sheet-enabled").trim() !== "0"
    );
  }

  get #open() {
    return this.#context.controller.state.status === "open";
  }

  #length(name: string) {
    return Number.parseFloat(getComputedStyle(this.#dialog).getPropertyValue(name)) || 0;
  }

  // Extension hooks.

  setSource(source: LightboxSource<TItem>) {
    if (source === this.#source) return;
    this.#source = source;
    this.#clearRender();
  }

  claimDrag(deltaY: number) {
    if (!this.#open || !this.#enabled) return false;
    return deltaY < 0 || this.#stop !== "photo" || this.#visible > this.#stops.photo + 1;
  }

  drag(phase: "start" | "move" | "end" | "cancel", clientY: number) {
    if (phase === "start") this.#dragStart(clientY);
    else if (phase === "move") this.#dragMove(clientY);
    else this.#dragEnd(phase === "cancel");
  }

  wheel(deltaY: number) {
    if (!this.#open || !this.#enabled) return false;
    // Wheel up at the photo is the dismiss gesture; everything else steps the sheet.
    if (this.#stop === "photo" && deltaY < 0) return false;
    this.#wheelStep(deltaY);
    return true;
  }

  keydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || this.#stop === "photo" || !this.#open) return false;
    this.set("photo", true);
    return true;
  }

  allowsZoom() {
    return this.#stop === "photo" && this.#visible <= this.#stops.photo + 1;
  }

  beforeClose() {
    if (this.#visible <= this.#stops.photo + 0.5) return undefined;
    return new Promise<void>((resolve) => {
      this.#settled.push(resolve);
      this.#moveTo("photo", !this.#reducedMotion());
    });
  }

  destroy() {
    this.#lifetime.abort();
    this.#slideObserver.disconnect();
    this.#unsubscribe();
    cancelAnimationFrame(this.#frame);
    this.#clearRender();
    this.#owned?.remove();
    this.#reset();
    delete this.#dialog.dataset.lightboxSheetHost;
    delete this.#dialog.dataset.sheet;
  }

  // Public control.

  set(stop: LightboxSheetStop, animate: boolean) {
    if (!this.#open || !this.#enabled) return;
    this.#measure();
    this.#moveTo(stop, animate && !this.#reducedMotion());
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

  // Geometry.

  /** Resting heights of the visible part of the sheet, at each stop. */
  #measure() {
    const element = this.#element;
    if (!element) return;
    const height = this.#dialog.clientHeight;
    const peek = this.#length("--lightbox-sheet-peek");
    const max = this.#length("--lightbox-sheet-max-height") || height * 0.6;
    const natural = element.offsetHeight;
    const info = Math.max(peek, Math.min(natural, max));
    const full = Math.max(info, natural);
    this.#stops = { photo: peek, info, full: full - info < 24 ? info : full };
    this.#dialog.toggleAttribute("data-sheet-peeking", peek > 0);
  }

  #remeasure() {
    if (!this.#open) return;
    this.#forgetRests();
    this.#measure();
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#paint((this.#target = this.#stops[this.#stop]));
  }

  #forgetRests() {
    for (const slide of this.#slides()) this.#rests.delete(slide);
  }

  #slides() {
    return this.#dialog.querySelectorAll<HTMLElement>("[data-lightbox-slide]");
  }

  /** Where the photo in a slide sits with the sheet away, in viewport coordinates. */
  #rest(slide: HTMLElement): Rest | undefined {
    const cached = this.#rests.get(slide);
    if (cached) return cached;
    const media =
      slide.querySelector<HTMLElement>("[data-lightbox-media]") ??
      slide.querySelector<HTMLElement>("[data-lightbox-frame]");
    if (!media) return undefined;
    const { translate, scale } = slide.style;
    slide.style.translate = slide.style.scale = "";
    const box = slide.getBoundingClientRect();
    const rect = media.getBoundingClientRect();
    slide.style.translate = translate;
    slide.style.scale = scale;
    if (!rect.height) return undefined;
    const rest = {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      originX: rect.left - box.left + rect.width / 2,
      originY: rect.top - box.top,
    };
    this.#rests.set(slide, rest);
    return rest;
  }

  /** The photo shrinks (fit) or rises (push) into the room above the sheet. */
  #pose(rest: Rest, visible: number): Pose {
    const height = this.#dialog.clientHeight;
    const rising = Math.max(0, visible - this.#stops.photo);
    if (!rising) return { ty: 0, scale: 1 };
    const gap = this.#length("--lightbox-sheet-gap") * Math.min(1, rising / 48);
    const bottom = height - visible - gap;
    if (rest.bottom <= bottom) return { ty: 0, scale: 1 };
    const top = Math.min(rest.top, this.#length("--lightbox-stage-top"));
    const mode = getComputedStyle(this.#dialog).getPropertyValue("--lightbox-sheet-photo").trim();
    if (mode === "push") {
      // Rises with the sheet until its top meets the stage; then the sheet covers it.
      return { ty: clamp(bottom - rest.bottom, top - rest.top, 0), scale: 1 };
    }
    const scale = clamp((bottom - top) / rest.height, 0.25, 1);
    return { ty: bottom - scale * rest.height - rest.top, scale };
  }

  // Painting.

  #paint(visible: number) {
    this.#visible = visible;
    const { photo, info, full } = this.#stops;
    const style = this.#dialog.style;
    style.setProperty("--lightbox-sheet-visible", `${visible}px`);
    style.setProperty(
      "--lightbox-sheet-progress",
      String(info > photo ? clamp((visible - photo) / (info - photo), 0, 1) : 0),
    );
    style.setProperty(
      "--lightbox-sheet-expand",
      String(full > info ? clamp((visible - info) / (full - info), 0, 1) : 0),
    );
    this.#dialog.toggleAttribute("data-sheet-raised", visible > photo + 0.5);
    this.#paintSlides();
  }

  #paintSlides() {
    const raised = this.#visible > this.#stops.photo + 0.5;
    for (const slide of this.#slides()) {
      const rest = raised ? this.#rest(slide) : undefined;
      const pose = rest ? this.#pose(rest, this.#visible) : { ty: 0, scale: 1 };
      if (pose.ty === 0 && pose.scale === 1) {
        if (slide.style.translate) {
          slide.style.translate = slide.style.scale = slide.style.transformOrigin = "";
        }
        continue;
      }
      slide.style.transformOrigin = `${rest!.originX}px ${rest!.originY}px`;
      slide.style.translate = `0 ${pose.ty}px`;
      slide.style.scale = String(pose.scale);
    }
  }

  // Motion.

  #reducedMotion() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  #setStop(stop: LightboxSheetStop) {
    this.#stop = stop;
    this.#dialog.dataset.sheet = stop;
    this.#announce(stop);
    this.#dialog.dispatchEvent(new CustomEvent("lightbox-sheet-change", { detail: { stop } }));
  }

  #moveTo(stop: LightboxSheetStop, animate: boolean) {
    const target = this.#stops[stop];
    if (stop !== this.#stop) this.#setStop(stop);
    this.#target = target;
    if (!animate) {
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      this.#velocity = 0;
      this.#paint(target);
      this.#finishMotion();
      return;
    }
    this.#dialog.dataset.sheetMoving = target > this.#visible ? "up" : "down";
    if (!this.#frame) {
      this.#lastTime = performance.now();
      this.#frame = requestAnimationFrame(this.#step);
    }
  }

  #step = (time: number) => {
    const dt = Math.min(0.032, Math.max(0.001, (time - this.#lastTime) / 1000));
    this.#lastTime = time;
    const force = STIFFNESS * (this.#target - this.#visible) - DAMPING * this.#velocity;
    this.#velocity += force * dt;
    let next = this.#visible + this.#velocity * dt;
    const done = Math.abs(this.#target - next) < 0.5 && Math.abs(this.#velocity) < 12;
    if (done) next = this.#target;
    this.#paint(next);
    if (done) {
      this.#frame = 0;
      this.#velocity = 0;
      this.#finishMotion();
    } else {
      this.#frame = requestAnimationFrame(this.#step);
    }
  };

  #finishMotion() {
    delete this.#dialog.dataset.sheetMoving;
    const element = this.#element;
    if (element && this.#stop === "photo") element.scrollTop = 0;
    for (const resolve of this.#settled.splice(0)) resolve();
  }

  #reset() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#drag = undefined;
    this.#velocity = 0;
    if (this.#stop !== "photo") this.#setStop("photo");
    this.#paint((this.#target = this.#stops.photo));
    this.#forgetRests();
    delete this.#dialog.dataset.sheetMoving;
    for (const resolve of this.#settled.splice(0)) resolve();
  }

  // Dragging, from the photo (through the viewer) or from the sheet itself.

  #dragStart(clientY: number) {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#measure();
    this.#drag = {
      startY: clientY,
      startVisible: this.#visible,
      samples: [[performance.now(), clientY]],
    };
    this.#dialog.dataset.sheetDragging = "";
  }

  #dragMove(clientY: number) {
    const drag = this.#drag;
    if (!drag) return;
    drag.samples.push([performance.now(), clientY]);
    if (drag.samples.length > 6) drag.samples.shift();
    const raw = drag.startVisible + drag.startY - clientY;
    const { photo, full } = this.#stops;
    // Past either end the sheet follows at a third of the finger's pace.
    const visible =
      raw > full ? full + (raw - full) / 3 : raw < photo ? photo - (photo - raw) / 3 : raw;
    this.#dialog.dataset.sheetMoving = visible >= this.#visible ? "up" : "down";
    this.#paint(Math.max(0, visible));
  }

  #dragEnd(cancelled: boolean) {
    const drag = this.#drag;
    this.#drag = undefined;
    delete this.#dialog.dataset.sheetDragging;
    if (!drag) return;
    const [first, last] = [drag.samples[0]!, drag.samples.at(-1)!];
    const elapsed = last[0] - first[0];
    // Upward speed in px/ms.
    const speed = cancelled || elapsed < 1 ? 0 : (first[1] - last[1]) / elapsed;
    const order: LightboxSheetStop[] = ["photo", "info", "full"];
    const stops = order.filter(
      (stop, index) => index === 0 || this.#stops[stop] > this.#stops[order[index - 1]!] + 1,
    );
    let stop = stops.reduce((best, candidate) =>
      Math.abs(this.#stops[candidate] - this.#visible) < Math.abs(this.#stops[best] - this.#visible)
        ? candidate
        : best,
    );
    if (Math.abs(speed) > FLING) {
      const direction = Math.sign(speed);
      const ahead = stops.filter(
        (candidate) => (this.#stops[candidate] - this.#visible) * direction > 1,
      );
      stop = (direction > 0 ? ahead[0] : ahead.at(-1)) ?? stop;
    }
    this.#velocity = speed * 1000;
    this.#suppressClick = true;
    setTimeout(() => (this.#suppressClick = false), 0);
    this.#moveTo(stop, !this.#reducedMotion());
  }

  #wheelStep(deltaY: number) {
    // One trackpad swipe sends dozens of events; the first one decides.
    const now = performance.now();
    const locked = now - this.#wheelLock < 260;
    this.#wheelLock = now;
    if (locked || Math.abs(deltaY) < 4) return;
    this.#measure();
    const order: LightboxSheetStop[] = ["photo", "info", "full"];
    const stops = order.filter(
      (stop, index) => index === 0 || this.#stops[stop] > this.#stops[order[index - 1]!] + 1,
    );
    const index = stops.indexOf(this.#stop);
    const next = stops[clamp(index + Math.sign(deltaY), 0, stops.length - 1)]!;
    this.#moveTo(next, !this.#reducedMotion());
  }

  // Events on the sheet element.

  #inSheet(target: EventTarget | null) {
    const element = this.#element;
    return !!element && target instanceof Node && element.contains(target);
  }

  #onTouchStart = (event: TouchEvent) => {
    if (!this.#inSheet(event.target) || event.touches.length !== 1 || !this.#open) return;
    const touch = event.touches[0]!;
    this.#touch = { x: touch.clientX, y: touch.clientY, axis: "pending" };
  };

  #onTouchMove = (event: TouchEvent) => {
    const touch = this.#touch;
    const point = event.touches[0];
    if (!touch || !point || event.touches.length !== 1) return;
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    if (touch.axis === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        touch.axis = "horizontal";
        return;
      }
      const element = this.#element!;
      // At full the sheet scrolls its own content, and only a pull down from the
      // top of it moves the sheet.
      const scrolls = this.#stop === "full" && element.scrollHeight > element.clientHeight + 1;
      if (scrolls && (dy < 0 || element.scrollTop > 0)) {
        touch.axis = "native";
        return;
      }
      touch.axis = "vertical";
      this.#dragStart(touch.y);
    }
    if (touch.axis !== "vertical") return;
    if (event.cancelable) event.preventDefault();
    this.#dragMove(point.clientY);
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (!this.#touch || event.touches.length) return;
    const axis = this.#touch.axis;
    this.#touch = undefined;
    if (axis === "vertical") this.#dragEnd(event.type === "touchcancel");
  };

  #onSheetWheel = (event: WheelEvent) => {
    if (!this.#inSheet(event.target) || !this.#open || event.ctrlKey) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const element = this.#element!;
    const scrolls = this.#stop === "full" && element.scrollHeight > element.clientHeight + 1;
    if (scrolls && (event.deltaY > 0 || element.scrollTop > 0)) return;
    event.preventDefault();
    this.#wheelStep(event.deltaY);
  };

  #onClick = (event: MouseEvent) => {
    if (this.#suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest<HTMLElement>("[data-lightbox-sheet-stop]");
    if (trigger && this.#dialog.contains(trigger)) {
      const stop = trigger.dataset.lightboxSheetStop as LightboxSheetStop;
      if (!["photo", "info", "full"].includes(stop)) return;
      event.preventDefault();
      event.stopPropagation();
      this.set(stop === this.#stop && stop !== "photo" ? "photo" : stop, true);
      return;
    }
    // A tap above a raised sheet lowers it rather than closing the viewer.
    if (
      this.#stop !== "photo" &&
      !this.#inSheet(target) &&
      !target?.closest("button, a[href], input, select, textarea, [data-lightbox-filmstrip]")
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.set("photo", true);
    }
  };
}
