import { chromeReach } from "./chrome-reach";
interface Pose {
  scale: number;
  x: number;
  y: number;
}
interface Point {
  x: number;
  y: number;
}
interface View {
  image: HTMLElement;
  frame: HTMLElement;
}
/** What zoomed the image: a public reason, as the zoomchange event reports it. */
export type ZoomReason = "api" | "keyboard" | "pointer" | "wheel";
interface Options {
  prepare: () => View | null;
  config: () => { step: number; max: number };
  /** The zoomed image scroller's name. */
  label: string;
  state: (locked: boolean) => void;
  /** The zoom came to rest at another scale. Never called per frame. */
  settled: (scale: number, reason: ZoomReason | undefined) => void;
  reducedMotion: () => boolean;
  /** A duration in milliseconds, as the viewer's motion plays it. */
  duration: (ms: number) => number;
  /** Whether anything follows the pose, so an animation reports every frame of it. */
  watched: () => boolean;
  /** Where the zoomed element is: each frame it moves, then once at rest. */
  pose: (image: HTMLElement, pose: ZoomPose) => void;
  /** A person zoomed or panned, rather than code. */
  interact: () => void;
  /** True when a plain vertical wheel zooms, as Ctrl + wheel does. */
  wheelZooms: () => boolean;
}
/** A zoom pose, with the zoomed element's layout rectangle at fit, in client pixels. */
export interface ZoomPose extends Pose {
  readonly moving: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** The zoom viewport, the stage: the window less the stage insets, in client pixels. */
  readonly viewport: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
}
type SafariGesture = Event & { scale: number; clientX?: number; clientY?: number };
const fit = (): Pose => ({ scale: 1, x: 0, y: 0 });
/** The longest gap between the taps of a double-tap, in milliseconds. */
const DOUBLE_TAP = 350;
const point = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * What moves into the zoom viewport and back: an image's <picture>, if it has
 * one. Taking an <img> out of its <picture>, or back in, makes the browser pick
 * its source again and reload it, and Safari paints nothing until it has.
 */
const carrier = (image: HTMLElement) =>
  image.parentElement instanceof HTMLPictureElement ? image.parentElement : image;
const transform = (pose: Pose) => `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})`;
const resist = (value: number, min: number, max: number, range: number) =>
  value < min
    ? min - range * (1 - Math.exp((value - min) / range))
    : value > max
      ? max + range * (1 - Math.exp((max - value) / range))
      : value;

const sides = ["top", "right", "bottom", "left"] as const;
/** Whether a gesture starts on content that keeps its own, as a 3D model does its pinch. */
const ownsInput = (event: Event) => (event.target as Element).closest("[data-fluidbox-owns-input]");

/** Maps a scale's log-space distance beyond [1, max] through `curve`. */
function beyondBounds(
  scale: number,
  max: number,
  curve: (offset: number, range: number) => number,
): number {
  if (scale >= 1 && scale <= max) return scale;
  const boundary = scale < 1 ? 0 : Math.log(max);
  const offset = Math.log(Math.max(Number.MIN_VALUE, scale)) - boundary;
  return Math.exp(boundary + Math.sign(offset) * curve(Math.abs(offset), Math.log(max)));
}

// Same log-space resistance as voidmesh/lib/canvas-math.ts. Equal zoom
// ratios beyond either boundary receive equal resistance (coefficient 0.55).
const rubberZoom = (scale: number, max: number) =>
  beyondBounds(scale, max, (offset, range) => range * (1 - 1 / ((offset * 0.55) / range + 1)));

// Recover gesture coordinates when grabbing an unfinished rubber-band return,
// so its already-damped visible scale isn't damped a second time.
const rawZoom = (scale: number, max: number) =>
  beyondBounds(
    scale,
    max,
    (offset, range) => offset / (0.55 * (1 - Math.min(offset / range, 0.999))),
  );

/** Owns image zoom/pan while active; gallery navigation and dismissal stay outside. */
export class FluidboxZoom {
  #options: Options;
  #root: HTMLElement;
  #viewport: HTMLDivElement | null = null;
  #placeholder: HTMLDivElement | null = null;
  #nativeOrigin = { x: 0, y: 0 };
  #nativeTouch: Point | null = null;
  #nativeTouchPrevious: Point | null = null;
  #panPadding = 40;
  #mousePan: {
    id: number;
    target: HTMLElement;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null = null;
  #controller = new AbortController();
  #image: HTMLElement | null = null;
  /** An image a suspend left in its zoomed pose, for a closing flight or a move to start from. */
  #left: HTMLElement | null = null;
  #pose = fit();
  #geometry = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    stage: { top: 0, right: 0, bottom: 0, left: 0 },
    clip: { top: false, right: false, bottom: false, left: false },
    viewportWidth: 0,
    viewportHeight: 0,
  };
  #animation: Animation | null = null;
  #frame = 0;
  #idle: ReturnType<typeof setTimeout> | undefined;
  #clickTimer: ReturnType<typeof setTimeout> | undefined;
  #tap: { x: number; y: number; time: number } | undefined;
  #source: "touch" | "wheel" | "safari" | null = null;
  #touch: { start: Pose; center: Point; span: number } | null = null;
  #rawScale = 1;
  #touchTap: Point | null = null;
  #touchMoved = false;
  #cursor: Point = { x: innerWidth / 2, y: innerHeight / 2 };
  #suppressClick = false;
  /** The pointer that pressed last: a mouse zooms with one click, a finger with two taps. */
  #pointerType = "";
  /** What started the zoom on its way, reported when it comes to rest. */
  #reason: ZoomReason | undefined;
  /** The scale last reported as settled. */
  #settledScale = 1;
  #refocus = false;
  /** Resolves the command whose motion is running: true once it rests, false if interrupted. */
  #command: ((rested: boolean) => void) | undefined;
  /** The pose last published, so a pose is reported once. */
  #published: { scale: number; x: number; y: number; moving: boolean } | undefined;
  /** The frame loop that reports an animation's poses while something follows them. */
  #watch = 0;
  #scrollIdle: ReturnType<typeof setTimeout> | undefined;

  constructor(root: HTMLElement, options: Options) {
    this.#options = options;
    this.#root = root;
    const { signal } = this.#controller;
    const capture = { capture: true, passive: false, signal };
    for (const [type, listener] of [
      ["touchstart", this.#touchStart],
      ["touchmove", this.#touchMove],
      ["touchend", this.#touchEnd],
      ["touchcancel", this.#touchEnd],
      ["wheel", this.#wheel],
      ["gesturestart", this.#gestureStart],
      ["gesturechange", this.#gestureChange],
      ["gestureend", this.#gestureEnd],
    ] as const) {
      root.addEventListener(type, listener as EventListener, capture);
    }
    root.addEventListener(
      "pointermove",
      (event) => {
        this.#cursor = { x: event.clientX, y: event.clientY };
      },
      { signal },
    );
    root.addEventListener("pointerdown", (event) => (this.#pointerType = event.pointerType), {
      capture: true,
      signal,
    });
    root.addEventListener("dblclick", (event) => event.preventDefault(), { signal });
  }

  get zoomed() {
    return this.#pose.scale > 1.001 || this.#source !== null || this.#animation !== null;
  }

  // Transfer between native scroll coordinates and the shared-element transform
  // only at gesture boundaries. Native scrolling needs no animation-frame work.
  #leaveNative() {
    this.#endMousePan();
    clearTimeout(this.#scrollIdle);
    const viewport = this.#viewport;
    const image = this.#image;
    if (!viewport || !image || !this.#placeholder) return;
    const g = this.#geometry;
    this.#pose.x = this.#nativeOrigin.x - viewport.scrollLeft - (g.left - g.stage.left);
    this.#pose.y = this.#nativeOrigin.y - viewport.scrollTop - (g.top - g.stage.top);
    this.#placeholder.replaceWith(carrier(image));
    // Focus on the scroller goes back to the dialog rather than the page, and
    // returns to the scroller if the image comes to rest zoomed.
    this.#refocus = viewport.contains(viewport.ownerDocument.activeElement);
    viewport.remove();
    if (this.#refocus) {
      this.#root
        .querySelector<HTMLElement>("[data-fluidbox-dialog]")
        ?.focus({ preventScroll: true });
    }
    this.#viewport = null;
    this.#placeholder = null;
    this.#paint();
  }

  #enterNative() {
    const image = this.#image;
    if (!image || this.#pose.scale <= 1.001 || this.#viewport) return;
    const g = this.#geometry;
    const width = g.width * this.#pose.scale;
    const height = g.height * this.#pose.scale;
    const canvasWidth = Math.max(g.viewportWidth, width + this.#panPadding * 2);
    const canvasHeight = Math.max(g.viewportHeight, height + this.#panPadding * 2);
    const x = (canvasWidth - width) / 2;
    const y = (canvasHeight - height) / 2;
    const viewport = document.createElement("div");
    viewport.dataset.fluidboxZoomViewport = "";
    viewport.addEventListener("pointerdown", this.#startMousePan);
    viewport.addEventListener("pointermove", this.#moveMousePan);
    viewport.addEventListener("pointerup", this.#finishMousePan);
    viewport.addEventListener("pointercancel", this.#finishMousePan);
    viewport.addEventListener("lostpointercapture", this.#finishMousePan);
    viewport.addEventListener("scroll", this.#nativeScroll, { passive: true });
    viewport.addEventListener("scrollend", this.#nativeRest);
    // A named, focusable scroller, so it reads as part of the dialog and the
    // keys can reach it.
    viewport.setAttribute("role", "group");
    viewport.setAttribute("aria-label", this.#options.label);
    viewport.tabIndex = 0;
    const canvas = document.createElement("div");
    canvas.dataset.fluidboxZoomCanvas = "";
    viewport.style.setProperty("--fluidbox-zoom-chrome", `${chromeReach(window)}px`);
    // The zoomed image pans under the stage insets, and on past them under the
    // browser's bars, unless --fluidbox-zoom-clip keeps it inside that side.
    for (const side of sides) {
      viewport.style.setProperty(`--fluidbox-zoom-stage-${side}`, `${g.stage[side]}px`);
      if (!g.stage[side]) continue;
      const bleed = side === "top" || side === "bottom" ? " + var(--fluidbox-zoom-reach)" : "";
      viewport.style.setProperty(
        `--fluidbox-zoom-reach-${side}`,
        g.clip[side] ? "0px" : `calc(${g.stage[side]}px${bleed})`,
      );
    }
    canvas.style.setProperty("--fluidbox-zoom-canvas-width", `${canvasWidth}px`);
    canvas.style.setProperty("--fluidbox-zoom-canvas-height", `${canvasHeight}px`);
    const anchor = document.createElement("div");
    anchor.dataset.fluidboxZoomAnchor = "";
    anchor.style.setProperty("--fluidbox-zoom-anchor-left", `${x}px`);
    anchor.style.setProperty("--fluidbox-zoom-anchor-top", `${y}px`);
    anchor.style.setProperty("--fluidbox-zoom-item-width", `${g.width}px`);
    anchor.style.setProperty("--fluidbox-zoom-item-height", `${g.height}px`);
    const placeholder = document.createElement("div");
    placeholder.dataset.fluidboxZoomPlaceholder = "";
    placeholder.style.setProperty("--fluidbox-zoom-placeholder-width", `${g.width}px`);
    placeholder.style.setProperty("--fluidbox-zoom-placeholder-height", `${g.height}px`);
    const moved = carrier(image);
    moved.replaceWith(placeholder);
    anchor.append(moved);
    canvas.append(anchor);
    viewport.append(canvas);
    // Inside the dialog, so focus stays in it and aria-modal keeps it in the
    // accessibility tree. After the slides, so it paints over them as the image
    // did, and before the viewer's layer and the add-ons, so your controls and
    // captions, the thumbnails and the sheet stay over it.
    const dialog = this.#root.querySelector("[data-fluidbox-dialog]")!;
    dialog.insertBefore(viewport, dialog.querySelector(":scope > [data-fluidbox-portal]"));
    image.style.setProperty("--fluidbox-media-transform", `scale(${this.#pose.scale})`);
    this.#nativeOrigin = { x, y };
    this.#viewport = viewport;
    this.#placeholder = placeholder;
    viewport.scrollTo({
      left: x - (g.left - g.stage.left) - this.#pose.x,
      top: y - (g.top - g.stage.top) - this.#pose.y,
      behavior: "instant",
    });
  }

  #startMousePan = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary || !this.#viewport)
      return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    this.#suppressClick = false;
    this.#mousePan = {
      id: event.pointerId,
      target,
      x: event.clientX,
      y: event.clientY,
      left: this.#viewport.scrollLeft,
      top: this.#viewport.scrollTop,
      moved: false,
    };
    // Capture on the original target so a stationary click still targets the image.
    target.setPointerCapture(event.pointerId);
    this.#viewport.dataset.grabbing = "";
  };

  #moveMousePan = (event: PointerEvent) => {
    const pan = this.#mousePan;
    if (!pan || pan.id !== event.pointerId || !this.#viewport) return;
    const x = event.clientX - pan.x;
    const y = event.clientY - pan.y;
    if (!pan.moved && Math.hypot(x, y) < 4) return;
    pan.moved = true;
    this.#suppressClick = true;
    this.#tap = undefined;
    clearTimeout(this.#clickTimer);
    this.#viewport.scrollTo({ left: pan.left - x, top: pan.top - y, behavior: "instant" });
  };

  #finishMousePan = (event: PointerEvent) => {
    if (this.#mousePan?.id === event.pointerId) this.#endMousePan();
  };

  #endMousePan() {
    const pan = this.#mousePan;
    this.#mousePan = null;
    if (this.#viewport) delete this.#viewport.dataset.grabbing;
    if (pan?.target.hasPointerCapture(pan.id)) pan.target.releasePointerCapture(pan.id);
  }

  #freeze() {
    this.#leaveNative();
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#watch);
    this.#frame = 0;
    if (this.#animation && this.#image) {
      const matrix = new DOMMatrix(getComputedStyle(this.#image).transform);
      this.#pose = { scale: matrix.a, x: matrix.e, y: matrix.f };
      this.#animation.cancel();
      this.#animation = null;
    }
    this.#answer(false);
    if (this.#image) this.#paint();
  }

  /** Settle the running command, if there is one. */
  #answer(rested: boolean) {
    const command = this.#command;
    this.#command = undefined;
    command?.(rested);
  }

  #acquire() {
    this.#freeze();
    clearTimeout(this.#idle);
    clearTimeout(this.#clickTimer);
    const view = this.#options.prepare();
    if (!view) return false;
    this.#image = view.image;
    const matrix = new DOMMatrix(getComputedStyle(view.image).transform);
    const rect = view.frame.getBoundingClientRect();
    this.#pose = { scale: matrix.a, x: matrix.e, y: matrix.f };
    const { stage, clip } = this.#stageInsets();
    this.#geometry = {
      left: rect.left,
      top: rect.top,
      width: view.image.offsetWidth,
      height: view.image.offsetHeight,
      stage,
      clip,
      viewportWidth: innerWidth - stage.left - stage.right,
      viewportHeight: innerHeight - stage.top - stage.bottom,
    };
    this.#panPadding = matchMedia("(hover: hover) and (pointer: fine)").matches ? 96 : 40;
    this.#rawScale = rawZoom(this.#pose.scale, this.#options.config().max);
    return true;
  }

  // Zoom pans and centres inside the stage, the window less the dialog's
  // registered --fluidbox-stage-* insets.
  #stageInsets() {
    const dialog = this.#root.querySelector("[data-fluidbox-dialog]");
    const style = dialog ? getComputedStyle(dialog) : null;
    const inset = (side: string) =>
      Math.max(0, parseFloat(style?.getPropertyValue(`--fluidbox-stage-${side}`) ?? "") || 0);
    // "stage" clips every side; otherwise a list of sides, such as "right bottom".
    const words = (style?.getPropertyValue("--fluidbox-zoom-clip") ?? "").trim().split(/\s+/);
    const clipped = (side: string) => words.includes("stage") || words.includes(side);
    const stage = { top: 0, right: 0, bottom: 0, left: 0 };
    const clip = { top: false, right: false, bottom: false, left: false };
    for (const side of sides) {
      stage[side] = inset(side);
      clip[side] = clipped(side);
    }
    return { stage, clip };
  }

  #stageCenter(): Point {
    const g = this.#geometry;
    return { x: g.stage.left + g.viewportWidth / 2, y: g.stage.top + g.viewportHeight / 2 };
  }

  #paint() {
    this.#frame = 0;
    if (!this.#image) return;
    this.#image.style.setProperty("--fluidbox-media-transform", transform(this.#pose));
    this.#publish(this.#pose, this.#source !== null);
  }

  /** The zoomed element is the image, or the box the zoom moves: the pose goes to it. */
  get target() {
    return this.#image;
  }

  /**
   * Tell the box and whoever follows it where the zoom is: the scale as
   * `--fluidbox-zoom-scale`, and the whole pose to the listeners.
   */
  #publish(pose: Pose, moving: boolean) {
    const image = this.#image;
    if (!image) return;
    const last = this.#published;
    if (
      last &&
      last.moving === moving &&
      last.scale === pose.scale &&
      last.x === pose.x &&
      last.y === pose.y
    )
      return;
    this.#published = { ...pose, moving };
    image.style.setProperty("--fluidbox-zoom-scale", String(pose.scale));
    const g = this.#geometry;
    this.#options.pose(image, {
      ...pose,
      moving,
      left: g.left,
      top: g.top,
      width: g.width,
      height: g.height,
      viewport: {
        left: g.stage.left,
        top: g.stage.top,
        width: g.viewportWidth,
        height: g.viewportHeight,
      },
    });
  }

  /** The pose the native scroller shows: its scroll offsets, as a translation. */
  #nativePose(): Pose {
    const viewport = this.#viewport;
    const g = this.#geometry;
    if (!viewport) return this.#pose;
    return {
      scale: this.#pose.scale,
      x: this.#nativeOrigin.x - viewport.scrollLeft - (g.left - g.stage.left),
      y: this.#nativeOrigin.y - viewport.scrollTop - (g.top - g.stage.top),
    };
  }

  #nativeScroll = () => {
    this.#publish(this.#nativePose(), true);
    clearTimeout(this.#scrollIdle);
    this.#scrollIdle = setTimeout(() => this.#nativeRest(), 150);
  };

  #nativeRest = () => {
    clearTimeout(this.#scrollIdle);
    if (this.#viewport) this.#publish(this.#nativePose(), false);
  };

  /** Report an animation's poses, frame by frame, while something follows them. */
  #follow(animation: Animation) {
    cancelAnimationFrame(this.#watch);
    if (!this.#options.watched()) return;
    const frame = () => {
      if (this.#animation !== animation || !this.#image) return;
      const matrix = new DOMMatrix(getComputedStyle(this.#image).transform);
      this.#publish({ scale: matrix.a, x: matrix.e, y: matrix.f }, true);
      this.#watch = requestAnimationFrame(frame);
    };
    this.#watch = requestAnimationFrame(frame);
  }

  #queue() {
    if (!this.#frame) this.#frame = requestAnimationFrame(() => this.#paint());
    this.#options.state(true);
  }

  #bounded(pose: Pose, rubber: boolean): Pose {
    const g = this.#geometry;
    const constrain = (
      value: number,
      frame: number,
      size: number,
      viewport: number,
      stage: number,
    ) => {
      const base = frame - stage;
      const scaled = size * pose.scale;
      const extent = Math.max(viewport, scaled + (pose.scale > 1 ? this.#panPadding * 2 : 0));
      const origin = (extent - scaled) / 2;
      const min = origin - (extent - viewport) - base;
      const max = origin - base;
      return rubber ? resist(value, min, max, 70) : Math.max(min, Math.min(max, value));
    };
    return {
      ...pose,
      x: constrain(pose.x, g.left, g.width, g.viewportWidth, g.stage.left),
      y: constrain(pose.y, g.top, g.height, g.viewportHeight, g.stage.top),
    };
  }

  #around(scale: number, anchor: Point, origin = this.#pose, oldAnchor = anchor): Pose {
    const g = this.#geometry;
    return {
      scale,
      x: anchor.x - g.left - ((oldAnchor.x - g.left - origin.x) * scale) / origin.scale,
      y: anchor.y - g.top - ((oldAnchor.y - g.top - origin.y) * scale) / origin.scale,
    };
  }

  #rest(target: Pose) {
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#watch);
    this.#paint();
    this.#publish(target, false);
    this.#options.state(target.scale > 1.001);
    this.#enterNative();
    if (this.#refocus) this.#viewport?.focus({ preventScroll: true });
    this.#refocus = false;
    this.#report(target.scale, this.#reason);
    this.#answer(true);
  }

  #report(scale: number, reason: ZoomReason | undefined) {
    const rounded = Math.round(scale * 1000) / 1000;
    if (rounded === this.#settledScale) return;
    this.#settledScale = rounded;
    this.#options.settled(rounded, reason);
  }

  #target(scale: number, anchor: Point): Pose {
    return scale === 1 ? fit() : this.#bounded(this.#around(scale, anchor), false);
  }

  #animate(target: Pose, springBack = false) {
    this.#freeze();
    const image = this.#image;
    if (!image) return;
    const from = this.#pose;
    this.#pose = target;
    if (this.#options.reducedMotion()) {
      this.#rest(target);
      return;
    }
    let ease: (offset: number) => number;
    if (springBack) {
      // Critically damped return with the reference's 0.25s response. Sample
      // once into compositor keyframes; no layout reads or JS animation loop.
      const omega = (2 * Math.PI) / 0.25;
      const remaining = (time: number) => (1 + omega * time) * Math.exp(-omega * time);
      const end = remaining(0.4);
      ease = (offset) => (1 - remaining(offset * 0.4)) / (1 - end);
    } else {
      ease = (offset) => 1 - (1 - offset) ** 3;
    }
    // Keep logarithmic zoom easing, but translate by the same normalized
    // scale change so every image point follows a straight screen-space path.
    const frames = Array.from({ length: 49 }, (_, i): Keyframe => {
      const offset = i / 48;
      const zoomProgress = ease(offset);
      const scale = from.scale * (target.scale / from.scale) ** zoomProgress;
      const progress =
        Math.abs(target.scale - from.scale) > 0.000001
          ? (scale - from.scale) / (target.scale - from.scale)
          : zoomProgress;
      return {
        offset,
        transform: transform({
          scale,
          x: from.x + (target.x - from.x) * progress,
          y: from.y + (target.y - from.y) * progress,
        }),
      };
    });
    const animation = image.animate(frames, {
      duration: this.#options.duration(springBack ? 400 : 320),
      easing: "linear",
      fill: "both",
    });
    this.#animation = animation;
    this.#options.state(true);
    this.#follow(animation);
    void animation.ready.then(
      () => {
        if (this.#animation !== animation || animation.playState !== "running") return;
        // As with opening, Safari's rendering-update timestamp can predate the
        // setup work. Start from a fresh clock once the zoom is ready to render.
        animation.startTime = performance.now();
      },
      () => {
        // A new gesture or dismissal can cancel zoom before it becomes ready.
      },
    );
    void animation.finished.then(
      () => {
        if (this.#animation !== animation) return;
        this.#animation = null;
        animation.cancel();
        this.#rest(target);
      },
      () => {},
    );
  }

  #settle() {
    clearTimeout(this.#idle);
    this.#source = null;
    this.#touch = null;
    const scale = Math.max(1, Math.min(this.#options.config().max, this.#pose.scale));
    const target = this.#target(scale, this.#stageCenter());
    if (
      Math.abs(target.scale - this.#pose.scale) > 0.0001 ||
      Math.abs(target.x - this.#pose.x) > 0.1 ||
      Math.abs(target.y - this.#pose.y) > 0.1
    )
      this.#animate(target, true);
    else this.#rest(target);
  }

  #consume(event: Event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  #touchStart = (event: TouchEvent) => {
    this.#suppressClick = false;
    if ((event.target as Element).closest("button")) return;
    if (!this.zoomed && ownsInput(event)) return;
    if (event.touches.length === 1 && this.#viewport) {
      this.#nativeTouch = this.#nativeTouchPrevious = point(event.touches[0]!);
      // Leave the default action intact: the browser owns pan and momentum.
      event.stopImmediatePropagation();
      return;
    }
    this.#nativeTouch = null;
    this.#nativeTouchPrevious = null;
    if (event.touches.length < 2 && !this.zoomed) return;
    if (!this.#acquire()) return;
    this.#consume(event);
    this.#options.interact();
    this.#source = "touch";
    this.#reason = "pointer";
    this.#touchTap = event.touches.length === 1 ? point(event.touches[0]!) : null;
    this.#touchMoved = event.touches.length > 1;
    this.#suppressClick = true;
    this.#rebaseTouches(event.touches);
    this.#options.state(true);
  };

  #rebaseTouches(touches: TouchList) {
    if (!touches.length) return;
    const a = point(touches[0]!);
    const b = touches.length > 1 ? point(touches[1]!) : a;
    this.#touch = {
      start: { ...this.#pose },
      center: midpoint(a, b),
      span: touches.length > 1 ? distance(a, b) : 0,
    };
    this.#rawScale = rawZoom(this.#pose.scale, this.#options.config().max);
  }

  #touchMove = (event: TouchEvent) => {
    if (this.#viewport && this.#source !== "touch") {
      if (event.touches.length === 1) {
        const current = point(event.touches[0]!);
        if (this.#nativeTouch && distance(this.#nativeTouch, current) > 8)
          this.#suppressClick = true;
        if (this.#nativeTouchPrevious) {
          const dx = current.x - this.#nativeTouchPrevious.x;
          const dy = current.y - this.#nativeTouchPrevious.y;
          const viewport = this.#viewport;
          const maxY = viewport.scrollHeight - viewport.clientHeight;
          if (
            Math.abs(dy) > Math.abs(dx) &&
            ((dy > 0 && viewport.scrollTop <= 1) || (dy < 0 && viewport.scrollTop >= maxY - 1)) &&
            event.cancelable
          )
            event.preventDefault();
        }
        this.#nativeTouchPrevious = current;
      }
      event.stopImmediatePropagation();
      return;
    }
    if (this.#source !== "touch" || !this.#touch || !event.touches.length) return;
    this.#consume(event);
    const a = point(event.touches[0]!);
    const b = event.touches.length > 1 ? point(event.touches[1]!) : a;
    const center = midpoint(a, b);
    if (this.#touchTap && distance(this.#touchTap, center) > 8) this.#touchMoved = true;
    const start = this.#touch;
    if (start.span && event.touches.length > 1) {
      const scale = rubberZoom(
        (this.#rawScale * distance(a, b)) / start.span,
        this.#options.config().max,
      );
      this.#pose = this.#bounded(this.#around(scale, center, start.start, start.center), true);
    } else {
      this.#pose = this.#bounded(
        {
          ...start.start,
          x: start.start.x + center.x - start.center.x,
          y: start.start.y + center.y - start.center.y,
        },
        true,
      );
    }
    this.#queue();
  };

  #touchEnd = (event: TouchEvent) => {
    if (this.#viewport && this.#source !== "touch") {
      this.#nativeTouch = null;
      this.#nativeTouchPrevious = null;
      event.stopImmediatePropagation();
      return;
    }
    if (this.#source !== "touch") return;
    this.#consume(event);
    if (event.touches.length && event.type !== "touchcancel") this.#rebaseTouches(event.touches);
    else {
      const tap = !this.#touchMoved && event.type !== "touchcancel" ? this.#touchTap : null;
      this.#touchTap = null;
      this.#settle();
      if (tap) this.#tapAt(tap);
    }
  };

  #wheel = (event: WheelEvent) => {
    if (this.#source === "safari") {
      this.#consume(event);
      return;
    }
    const pinch =
      event.ctrlKey ||
      (this.#options.wheelZooms() && Math.abs(event.deltaY) > Math.abs(event.deltaX) * 1.3);
    if (!pinch && this.#viewport) {
      event.stopImmediatePropagation();
      return;
    }
    if (!pinch && !this.zoomed) return;
    // A pinch on content that owns its input is the content's; the page still doesn't zoom.
    if (!this.zoomed && ownsInput(event)) {
      event.preventDefault();
      return;
    }
    if (!pinch) {
      this.#freeze();
      this.#settle();
      event.stopImmediatePropagation();
      return;
    }
    this.#consume(event);
    const source = this.#source;
    if (source !== "wheel") {
      if (!this.#acquire()) return;
      this.#options.interact();
      this.#source = "wheel";
      this.#reason = "wheel";
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    this.#rawScale *= Math.exp(Math.max(-0.5, Math.min(0.5, -event.deltaY * unit * 0.008)));
    const scale = rubberZoom(this.#rawScale, this.#options.config().max);
    this.#pose = this.#bounded(this.#around(scale, { x: event.clientX, y: event.clientY }), true);
    this.#queue();
    clearTimeout(this.#idle);
    this.#idle = setTimeout(() => this.#settle(), 80);
  };

  #gestureStart = (event: Event) => {
    if (!this.#source && !this.zoomed && ownsInput(event)) {
      event.preventDefault();
      return;
    }
    if (this.#source === "touch") {
      this.#consume(event);
      return;
    }
    if (!this.#acquire()) return;
    this.#consume(event);
    this.#options.interact();
    this.#source = "safari";
    this.#reason = "pointer";
    this.#options.state(true);
  };
  #gestureChange = (event: Event) => {
    if (this.#source !== "safari") return;
    this.#consume(event);
    const gesture = event as SafariGesture;
    const anchor = { x: gesture.clientX ?? this.#cursor.x, y: gesture.clientY ?? this.#cursor.y };
    const scale = rubberZoom(this.#rawScale * gesture.scale, this.#options.config().max);
    this.#pose = this.#bounded(this.#around(scale, anchor), true);
    this.#queue();
  };
  #gestureEnd = (event: Event) => {
    if (this.#source !== "safari") return;
    this.#consume(event);
    this.#settle();
  };

  handleClick(event: MouseEvent) {
    const target = event.target as Element;
    const onMedia = !!target.closest(
      "[data-fluidbox-media], [data-fluidbox-content], [data-fluidbox-item-content]",
    );
    if (this.#suppressClick && (onMedia || target.closest("[data-fluidbox-zoom-viewport]"))) {
      this.#suppressClick = false;
      return true;
    }
    // Controls inside custom content keep their clicks.
    if (target.closest("button, a[href], input, select, textarea, label, [contenteditable]")) {
      return false;
    }
    // A click beside the zoomed image zooms out, rather than closing the viewer
    // on someone who only meant to let go of the picture.
    if (target.matches("[data-fluidbox-zoom-canvas], [data-fluidbox-zoom-viewport]")) {
      if (this.#acquire()) {
        this.#reason = "pointer";
        this.#animate(fit());
      }
      return true;
    }
    if (!onMedia) return false;
    if (event.detail === 0) return false;
    this.#options.interact();
    const anchor = { x: event.clientX, y: event.clientY };
    // A mouse zooms with one click, as on a product page: the cursor says so.
    // The second click of a double-click is the same intent, not a toggle back.
    if (this.#pointerType === "mouse") {
      if (event.detail === 1) this.#toggleAt(anchor);
    } else this.#tapAt(anchor);
    return true;
  }

  #tapAt(anchor: Point) {
    const now = performance.now();
    const previous = this.#tap;
    clearTimeout(this.#clickTimer);
    // A generous window, near the platforms' own double-tap timing, for hands
    // slower than the default 250 ms.
    if (previous && now - previous.time < DOUBLE_TAP && distance(previous, anchor) < 40) {
      this.#tap = undefined;
      this.#toggleAt(anchor);
    } else {
      this.#tap = { ...anchor, time: now };
      this.#clickTimer = setTimeout(() => {
        this.#tap = undefined;
      }, DOUBLE_TAP);
    }
  }

  #toggleAt(anchor: Point) {
    if (!this.#acquire()) return;
    this.#reason = "pointer";
    const scale = this.#pose.scale > 1.01 ? 1 : this.#options.config().step;
    this.#animate(this.#target(scale, anchor));
  }

  /**
   * The scale a zoom under way is heading to, so a step taken before it rests
   * adds to it rather than to where it was. Undefined while nothing animates.
   */
  get goal(): number | undefined {
    // While an animation runs, the pose is already its target.
    return this.#animation ? this.#pose.scale : undefined;
  }

  /** Zoom by a factor about the stage's centre, as the + and - keys do. */
  zoomBy(factor: number, reason: ZoomReason = "keyboard") {
    const goal = this.goal;
    if (!this.#acquire()) return;
    this.#reason = reason;
    const from = goal ?? this.#pose.scale;
    const scale = Math.max(1, Math.min(this.#options.config().max, from * factor));
    this.#animate(this.#target(scale, this.#stageCenter()));
  }
  /** Zoom back out to fit, as the 0 key does. */
  reset(reason: ZoomReason = "keyboard") {
    if (!this.#acquire()) return;
    this.#reason = reason;
    this.#animate(fit());
  }

  /**
   * Zoom to `scale`, clamped to [1, max], keeping `origin` (client pixels, the
   * stage's centre by default) where it is. Resolves true once the image rests
   * there, false when there is no image to zoom or the motion was interrupted.
   */
  zoomTo(
    scale: number,
    {
      origin,
      reason = "api",
      signal,
    }: { origin?: Point; reason?: ZoomReason; signal?: AbortSignal },
  ): Promise<boolean> {
    // Acquiring freezes any motion under way, which answers its command false.
    if (signal?.aborted || !this.#acquire()) return Promise.resolve(false);
    this.#reason = reason;
    const bounded = Math.max(1, Math.min(this.#options.config().max, scale));
    const target = this.#target(bounded, origin ?? this.#stageCenter());
    const pose = this.#pose;
    let answer!: (rested: boolean) => void;
    const done = new Promise<boolean>((resolve) => (answer = resolve));
    if (
      Math.abs(target.scale - pose.scale) < 0.0001 &&
      Math.abs(target.x - pose.x) < 0.1 &&
      Math.abs(target.y - pose.y) < 0.1
    ) {
      this.#command = answer;
      this.#rest(target);
      return done;
    }
    this.#animate(target);
    // Without motion to wait for, as with reduced motion, it has already rested.
    if (!this.#animation) answer(true);
    else this.#command = answer;
    signal?.addEventListener(
      "abort",
      () => {
        if (this.#command !== answer) return;
        this.#freeze();
        this.#settle();
      },
      { once: true },
    );
    return done;
  }

  /**
   * Pan the zoomed image with the arrow keys, a step of a fifth of the view,
   * or a half with Shift. True when it took the key.
   */
  keydown(event: KeyboardEvent): boolean {
    const x = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const y = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if ((!x && !y) || event.altKey || event.ctrlKey || event.metaKey || !this.zoomed) return false;
    const g = this.#geometry;
    const share = event.shiftKey ? 0.5 : 0.2;
    const dx = x * g.viewportWidth * share;
    const dy = y * g.viewportHeight * share;
    // A pinch or a wheel under way owns the image until it ends.
    if (this.#source !== null) return true;
    const viewport = this.#viewport;
    if (viewport && !this.#animation) {
      viewport.scrollBy({
        left: dx,
        top: dy,
        behavior: this.#options.reducedMotion() ? "instant" : "smooth",
      });
      return true;
    }
    // Mid-motion, pan from wherever the image is now.
    if (!this.#acquire()) return false;
    this.#reason = "keyboard";
    this.#animate(
      this.#bounded({ ...this.#pose, x: this.#pose.x - dx, y: this.#pose.y - dy }, false),
    );
    return true;
  }

  /**
   * Leave the visible transform intact for the dismissal animation, until
   * `release` puts the image back at fit.
   */
  suspend() {
    this.#freeze();
    this.#publish(fit(), false);
    this.#published = undefined;
    if (this.#image) this.#left = this.#image;
    clearTimeout(this.#idle);
    clearTimeout(this.#clickTimer);
    this.#source = null;
    this.#touch = null;
    this.#tap = undefined;
    this.#pose = fit();
    this.#image = null;
    this.#refocus = false;
    this.#options.state(false);
    this.#report(1, undefined);
  }
  /**
   * Fit the image a suspend left zoomed, once nothing shows it: the viewer has
   * closed, or moved to another item. Otherwise it would open, or come back
   * into view, still zoomed while the zoom reads as fitted.
   */
  release() {
    const image = this.#left;
    this.#left = null;
    if (image && image !== this.#image) {
      image.style.removeProperty("--fluidbox-media-transform");
      image.style.removeProperty("--fluidbox-zoom-scale");
    }
  }
  destroy() {
    this.suspend();
    this.release();
    this.#controller.abort();
  }
}
