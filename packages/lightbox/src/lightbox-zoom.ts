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
interface Options {
  prepare: () => View | null;
  config: () => { step: number; max: number };
  state: (locked: boolean) => void;
  close: () => void;
  reducedMotion: () => boolean;
}
type SafariGesture = Event & { scale: number; clientX?: number; clientY?: number };
const fit = (): Pose => ({ scale: 1, x: 0, y: 0 });
const point = (touch: Touch): Point => ({ x: touch.clientX, y: touch.clientY });
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const transform = (pose: Pose) => `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})`;
const resist = (value: number, min: number, max: number, range: number) =>
  value < min
    ? min - range * (1 - Math.exp((value - min) / range))
    : value > max
      ? max + range * (1 - Math.exp((max - value) / range))
      : value;

// Same log-space resistance as voidmesh/lib/canvas-math.ts. Equal zoom
// ratios beyond either boundary receive equal resistance (coefficient 0.55).
function rubberZoom(scale: number, max: number): number {
  if (scale >= 1 && scale <= max) return scale;
  const boundary = scale < 1 ? 0 : Math.log(max);
  const offset = Math.log(Math.max(Number.MIN_VALUE, scale)) - boundary;
  const range = Math.log(max);
  const damped = range * (1 - 1 / ((Math.abs(offset) * 0.55) / range + 1));
  return Math.exp(boundary + Math.sign(offset) * damped);
}

// Recover gesture coordinates when grabbing an unfinished rubber-band return,
// so its already-damped visible scale isn't damped a second time.
function rawZoom(scale: number, max: number): number {
  if (scale >= 1 && scale <= max) return scale;
  const boundary = scale < 1 ? 0 : Math.log(max);
  const offset = Math.log(scale) - boundary;
  const range = Math.log(max);
  const raw = Math.abs(offset) / (0.55 * (1 - Math.min(Math.abs(offset) / range, 0.999)));
  return Math.exp(boundary + Math.sign(offset) * raw);
}

/** Owns image zoom/pan while active; gallery navigation and dismissal stay outside. */
export class LightboxZoom {
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
  #pose = fit();
  #geometry = { left: 0, top: 0, width: 0, height: 0, viewportWidth: 0, viewportHeight: 0 };
  #animation: Animation | null = null;
  #frame = 0;
  #idle: ReturnType<typeof setTimeout> | undefined;
  #clickTimer: ReturnType<typeof setTimeout> | undefined;
  #tap: { x: number; y: number; time: number } | undefined;
  #source: "touch" | "wheel" | "safari" | null = null;
  #touch: { start: Pose; center: Point; span: number; rawScale: number } | null = null;
  #rawScale = 1;
  #touchTap: Point | null = null;
  #touchMoved = false;
  #safariStart = fit();
  #cursor: Point = { x: 0, y: 0 };
  #suppressClick = false;

  constructor(root: HTMLElement, options: Options) {
    this.#options = options;
    this.#root = root;
    this.#cursor = { x: innerWidth / 2, y: innerHeight / 2 };
    const { signal } = this.#controller;
    root.addEventListener("touchstart", this.#touchStart, {
      capture: true,
      passive: false,
      signal,
    });
    root.addEventListener("touchmove", this.#touchMove, { capture: true, passive: false, signal });
    root.addEventListener("touchend", this.#touchEnd, { capture: true, passive: false, signal });
    root.addEventListener("touchcancel", this.#touchEnd, { capture: true, passive: false, signal });
    root.addEventListener("wheel", this.#wheel, { capture: true, passive: false, signal });
    root.addEventListener(
      "pointermove",
      (event) => {
        this.#cursor = { x: event.clientX, y: event.clientY };
      },
      { signal },
    );
    root.addEventListener("gesturestart", this.#gestureStart, {
      capture: true,
      passive: false,
      signal,
    });
    root.addEventListener("gesturechange", this.#gestureChange, {
      capture: true,
      passive: false,
      signal,
    });
    root.addEventListener("gestureend", this.#gestureEnd, {
      capture: true,
      passive: false,
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
    const viewport = this.#viewport;
    const image = this.#image;
    if (!viewport || !image || !this.#placeholder) return;
    this.#pose.x = this.#nativeOrigin.x - viewport.scrollLeft - this.#geometry.left;
    this.#pose.y = this.#nativeOrigin.y - viewport.scrollTop - this.#geometry.top;
    this.#placeholder.replaceWith(image);
    viewport.remove();
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
    viewport.dataset.lightboxZoomViewport = "";
    viewport.addEventListener("pointerdown", this.#startMousePan);
    viewport.addEventListener("pointermove", this.#moveMousePan);
    viewport.addEventListener("pointerup", this.#finishMousePan);
    viewport.addEventListener("pointercancel", this.#finishMousePan);
    viewport.addEventListener("lostpointercapture", this.#finishMousePan);
    viewport.setAttribute("aria-label", "Zoomed image");
    const canvas = document.createElement("div");
    canvas.dataset.lightboxZoomCanvas = "";
    canvas.style.setProperty("--lightbox-zoom-canvas-width", `${canvasWidth}px`);
    canvas.style.setProperty("--lightbox-zoom-canvas-height", `${canvasHeight}px`);
    const anchor = document.createElement("div");
    anchor.dataset.lightboxZoomAnchor = "";
    anchor.style.setProperty("--lightbox-zoom-anchor-left", `${x}px`);
    anchor.style.setProperty("--lightbox-zoom-anchor-top", `${y}px`);
    anchor.style.setProperty("--lightbox-zoom-item-width", `${g.width}px`);
    anchor.style.setProperty("--lightbox-zoom-item-height", `${g.height}px`);
    const placeholder = document.createElement("div");
    placeholder.dataset.lightboxZoomPlaceholder = "";
    placeholder.style.setProperty("--lightbox-zoom-placeholder-width", `${g.width}px`);
    placeholder.style.setProperty("--lightbox-zoom-placeholder-height", `${g.height}px`);
    image.replaceWith(placeholder);
    anchor.append(image);
    canvas.append(anchor);
    viewport.append(canvas);
    this.#root.querySelector("[data-lightbox-dialog]")!.append(viewport);
    image.style.setProperty("--lightbox-media-transform", `scale(${this.#pose.scale})`);
    this.#nativeOrigin = { x, y };
    this.#viewport = viewport;
    this.#placeholder = placeholder;
    viewport.scrollTo({
      left: x - g.left - this.#pose.x,
      top: y - g.top - this.#pose.y,
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
    this.#frame = 0;
    if (this.#animation && this.#image) {
      const matrix = new DOMMatrix(getComputedStyle(this.#image).transform);
      this.#pose = { scale: matrix.a, x: matrix.e, y: matrix.f };
      this.#animation.cancel();
      this.#animation = null;
    }
    if (this.#image) this.#paint();
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
    this.#geometry = {
      left: rect.left,
      top: rect.top,
      width: view.image.offsetWidth,
      height: view.image.offsetHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
    this.#panPadding = matchMedia("(hover: hover) and (pointer: fine)").matches ? 96 : 40;
    this.#rawScale = rawZoom(this.#pose.scale, this.#options.config().max);
    return true;
  }

  #paint() {
    this.#frame = 0;
    if (!this.#image) return;
    this.#image.style.setProperty("--lightbox-media-transform", transform(this.#pose));
  }

  #queue() {
    if (!this.#frame) this.#frame = requestAnimationFrame(() => this.#paint());
    this.#options.state(true);
  }

  #bounded(pose: Pose, rubber: boolean): Pose {
    const g = this.#geometry;
    const constrain = (value: number, base: number, size: number, viewport: number) => {
      const scaled = size * pose.scale;
      const extent = Math.max(viewport, scaled + (pose.scale > 1 ? this.#panPadding * 2 : 0));
      const origin = (extent - scaled) / 2;
      const min = origin - (extent - viewport) - base;
      const max = origin - base;
      return rubber ? resist(value, min, max, 70) : Math.max(min, Math.min(max, value));
    };
    return {
      ...pose,
      x: constrain(pose.x, g.left, g.width, g.viewportWidth),
      y: constrain(pose.y, g.top, g.height, g.viewportHeight),
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

  #animate(target: Pose, springBack = false) {
    this.#freeze();
    const image = this.#image;
    if (!image) return;
    const from = this.#pose;
    this.#pose = target;
    if (this.#options.reducedMotion()) {
      this.#paint();
      this.#options.state(target.scale > 1.001);
      this.#enterNative();
      return;
    }
    let frames: Keyframe[];
    if (springBack) {
      // Critically damped return with the reference's 0.25s response. Sample
      // once into compositor keyframes; no layout reads or JS animation loop.
      const omega = (2 * Math.PI) / 0.25;
      const remaining = (time: number) => (1 + omega * time) * Math.exp(-omega * time);
      const end = remaining(0.4);
      frames = Array.from({ length: 49 }, (_, i) => {
        const offset = i / 48;
        const progress = (1 - remaining(offset * 0.4)) / (1 - end);
        const scale = Math.exp(
          Math.log(from.scale) + Math.log(target.scale / from.scale) * progress,
        );
        const translation =
          Math.abs(target.scale - from.scale) > 0.000001
            ? (scale - from.scale) / (target.scale - from.scale)
            : progress;
        return {
          offset,
          transform: transform({
            scale,
            x: from.x + (target.x - from.x) * translation,
            y: from.y + (target.y - from.y) * translation,
          }),
        };
      });
    } else {
      // Keep logarithmic zoom easing, but translate by the same normalized
      // scale change so every image point follows a straight screen-space path.
      frames = Array.from({ length: 49 }, (_, i) => {
        const offset = i / 48;
        const zoomProgress = 1 - (1 - offset) ** 3;
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
    }
    const animation = image.animate(frames, {
      duration: springBack ? 400 : 320,
      easing: "linear",
      fill: "both",
    });
    this.#animation = animation;
    this.#options.state(true);
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
        this.#paint();
        animation.cancel();
        this.#options.state(target.scale > 1.001);
        this.#enterNative();
      },
      () => {},
    );
  }

  #settle() {
    clearTimeout(this.#idle);
    this.#source = null;
    this.#touch = null;
    const scale = Math.max(1, Math.min(this.#options.config().max, this.#pose.scale));
    const center = { x: innerWidth / 2, y: innerHeight / 2 };
    const target = scale === 1 ? fit() : this.#bounded(this.#around(scale, center), false);
    if (
      Math.abs(target.scale - this.#pose.scale) > 0.0001 ||
      Math.abs(target.x - this.#pose.x) > 0.1 ||
      Math.abs(target.y - this.#pose.y) > 0.1
    )
      this.#animate(target, true);
    else {
      cancelAnimationFrame(this.#frame);
      this.#paint();
      this.#options.state(scale > 1.001);
      this.#enterNative();
    }
  }

  #consume(event: Event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  #touchStart = (event: TouchEvent) => {
    this.#suppressClick = false;
    if ((event.target as Element).closest("button")) return;
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
    this.#source = "touch";
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
      rawScale: rawZoom(this.#pose.scale, this.#options.config().max),
    };
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
        (start.rawScale * distance(a, b)) / start.span,
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
    if (!event.ctrlKey && this.#viewport) {
      event.stopImmediatePropagation();
      return;
    }
    if (!event.ctrlKey && !this.zoomed) return;
    if (!event.ctrlKey) {
      this.#freeze();
      this.#settle();
      event.stopImmediatePropagation();
      return;
    }
    this.#consume(event);
    const source = this.#source;
    if (source !== "wheel") {
      if (!this.#acquire()) return;
      this.#source = "wheel";
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
    if (this.#source === "touch") {
      this.#consume(event);
      return;
    }
    if (!this.#acquire()) return;
    this.#consume(event);
    this.#source = "safari";
    this.#safariStart = { ...this.#pose };
    this.#options.state(true);
  };
  #gestureChange = (event: Event) => {
    if (this.#source !== "safari") return;
    this.#consume(event);
    const gesture = event as SafariGesture;
    const anchor = { x: gesture.clientX ?? this.#cursor.x, y: gesture.clientY ?? this.#cursor.y };
    const max = this.#options.config().max;
    const scale = rubberZoom(rawZoom(this.#safariStart.scale, max) * gesture.scale, max);
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
      "[data-lightbox-media], [data-lightbox-content], [data-lightbox-item-content]",
    );
    if (this.#suppressClick && (onMedia || target.closest("[data-lightbox-zoom-viewport]"))) {
      this.#suppressClick = false;
      return true;
    }
    if (target.matches("[data-lightbox-zoom-canvas], [data-lightbox-zoom-viewport]")) {
      this.#options.close();
      return true;
    }
    if (!onMedia) return false;
    if (event.detail === 0) return false;
    this.#tapAt({ x: event.clientX, y: event.clientY });
    return true;
  }

  #tapAt(anchor: Point) {
    const now = performance.now();
    const previous = this.#tap;
    clearTimeout(this.#clickTimer);
    if (previous && now - previous.time < 250 && distance(previous, anchor) < 40) {
      this.#tap = undefined;
      if (this.#acquire()) {
        const scale = this.#pose.scale > 1.01 ? 1 : this.#options.config().step;
        this.#animate(scale === 1 ? fit() : this.#bounded(this.#around(scale, anchor), false));
      }
    } else {
      this.#tap = { ...anchor, time: now };
      this.#clickTimer = setTimeout(() => {
        this.#tap = undefined;
      }, 250);
    }
  }

  zoomBy(factor: number) {
    if (!this.#acquire()) return;
    const scale = Math.max(1, Math.min(this.#options.config().max, this.#pose.scale * factor));
    this.#animate(
      scale === 1
        ? fit()
        : this.#bounded(this.#around(scale, { x: innerWidth / 2, y: innerHeight / 2 }), false),
    );
  }
  reset() {
    if (this.#acquire()) this.#animate(fit());
  }

  /** Leave the visible transform intact for the dismissal animation. */
  suspend() {
    this.#freeze();
    clearTimeout(this.#idle);
    clearTimeout(this.#clickTimer);
    this.#source = null;
    this.#touch = null;
    this.#tap = undefined;
    this.#pose = fit();
    this.#image = null;
    this.#options.state(false);
  }
  destroy() {
    this.suspend();
    this.#controller.abort();
  }
}
