import { originIsVisible } from "./origin-geometry";
import {
  backdropVisibility,
  boundDismissVelocity,
  dragDistance,
  dragProgress,
  LightboxGestureController,
  touchAxisThreshold,
  type LightboxDragState,
} from "./lightbox-gesture";
import {
  applyImageTransitionPose,
  createImageTransitionMotion,
  openImageTransitionPose,
  poseFromThumbnail,
  readImageTransitionPose,
  thumbnailTransitionPose,
  type ImageTransitionPose,
} from "./image-transition-motion";
import type {
  LightboxController,
  LightboxDispose,
  LightboxImageMedia,
  LightboxItem,
  LightboxPortalRenderer,
  LightboxSource,
} from "./public-api";
import type {
  ViewerSessionCloseContext,
  ViewerSessionDriver,
  ViewerSessionMotionContext,
} from "./viewer-session";
import {
  createViewerPortal,
  ViewerModalIsolation,
  type ViewerPortalElements,
} from "./viewer-portal";
import { ViewerStrip } from "./viewer-strip";

const OPEN_DURATION = 300;
const TOUCH_DISMISS_DISTANCE = 60;
const EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const OPENING_SPRING_RESPONSE = 210;
const TOUCH_OPENING_SPRING_RESPONSE = 380;

interface PaintedPose extends ImageTransitionPose {
  readonly frameOpacity: string;
  readonly backdropOpacity: string;
}

function isImageItem(item: LightboxItem): item is LightboxItem<LightboxImageMedia> {
  return item.media.type === "image";
}

/** Plain DOM image driver. It has no dependency on custom elements or a framework. */
export class DomViewerDriver<
  TItem extends LightboxItem = LightboxItem,
> implements ViewerSessionDriver<TItem> {
  readonly #portal: ViewerPortalElements;
  readonly #isolation: ViewerModalIsolation;
  readonly #lifetime = new AbortController();
  #controller: LightboxController<TItem> | undefined;
  #strip: ViewerStrip<TItem> | undefined;
  #portalDispose: LightboxDispose | undefined;
  #animations: Animation[] = [];
  #interruptedPose: PaintedPose | undefined;
  #suppressClick = false;
  #suppressClickTimer: ReturnType<typeof setTimeout> | undefined;
  #pointer:
    | { id: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" }
    | undefined;
  readonly #dragGesture = new LightboxGestureController(
    (state) => this.#paintDrag(state),
    () => this.#commitWheelDismiss(),
  );
  #returnFocus: HTMLElement | null = null;
  #destroyed = false;

  constructor(ownerDocument: Document) {
    this.#portal = createViewerPortal(ownerDocument, { defaultCloseButton: false });
    this.#isolation = new ViewerModalIsolation(this.#portal.overlay);
    this.#portal.dialog.dataset.lightboxHeadless = "";
    this.#portal.container.addEventListener(
      "click",
      (event) => {
        if (this.#suppressClick) {
          this.#suppressClick = false;
          clearTimeout(this.#suppressClickTimer);
          return;
        }
        if (
          event.target === this.#portal.dialog ||
          event.target === this.#portal.backdrop ||
          event.target === this.#portal.container
        ) {
          void this.#controller?.close({ reason: "pointer" });
        }
      },
      { signal: this.#lifetime.signal },
    );
    this.#portal.container.addEventListener("pointerdown", this.#onPointerDown, {
      passive: true,
      signal: this.#lifetime.signal,
    });
    this.#portal.container.addEventListener("pointermove", this.#onPointerMove, {
      passive: false,
      signal: this.#lifetime.signal,
    });
    this.#portal.container.addEventListener("pointerup", this.#onPointerEnd, {
      passive: true,
      signal: this.#lifetime.signal,
    });
    this.#portal.container.addEventListener("pointercancel", this.#onPointerCancel, {
      passive: true,
      signal: this.#lifetime.signal,
    });
    this.#portal.container.addEventListener("wheel", this.#onWheel, {
      passive: false,
      signal: this.#lifetime.signal,
    });
    ownerDocument.addEventListener("keydown", this.#onKeydown, {
      capture: true,
      signal: this.#lifetime.signal,
    });
  }

  connect(controller: LightboxController<TItem>, renderer?: LightboxPortalRenderer<TItem>) {
    this.#controller = controller;
    if (!renderer) return;
    this.#portalDispose =
      renderer.mount({
        target: this.#portal.portalTarget,
        controller,
        signal: this.#lifetime.signal,
      }) ?? undefined;
  }

  setSource(source: LightboxSource<TItem>) {
    if (this.#strip) {
      this.#strip.setSource(source);
      this.#portal.dialog.toggleAttribute("data-lightbox-gallery", source.count > 1);
      return;
    }
    this.#strip = new ViewerStrip(this.#portal.overlay.ownerDocument, source, (index) => {
      const controller = this.#controller;
      if (controller?.state.status === "open" && controller.state.requestedIndex !== index) {
        void controller.goTo({ index }, { reason: "pointer" });
      }
    });
    this.#portal.frame.replaceWith(this.#strip.element);
    this.#portal.dialog.toggleAttribute("data-lightbox-gallery", source.count > 1);
  }

  async open(context: ViewerSessionMotionContext<TItem>) {
    this.#assertImage(context.item);
    this.#cancelAnimations(true);
    await this.#strip?.select(context.index, false);
    this.#render(context.item, context.index);
    this.#returnFocus =
      context.origin?.trigger ??
      (this.#portal.overlay.ownerDocument.activeElement instanceof HTMLElement
        ? this.#portal.overlay.ownerDocument.activeElement
        : null);
    if (!this.#portal.overlay.isConnected) {
      this.#portal.overlay.dataset.lightboxPrepared = "";
      this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    }
    this.#strip?.mount();
    this.#isolation.activate();
    this.#setState("opening");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) return;

    const interruptedPose = this.#takeInterruptedPose(false);
    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const openPose = openImageTransitionPose();
    const start = interruptedPose
      ? interruptedPose
      : from
        ? poseFromThumbnail(thumbnailTransitionPose(from, this.#frame, this.#media, openPose))
        : {
            transform: new DOMMatrix()
              .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
              .scale(0.96),
            clip: openPose.clip,
            frameOpacity: "0",
            backdropOpacity: "0",
          };
    const response = matchMedia("(hover: none) and (pointer: coarse)").matches
      ? TOUCH_OPENING_SPRING_RESPONSE
      : OPENING_SPRING_RESPONSE;
    const motion = createImageTransitionMotion({
      opening: true,
      from: start,
      to: openPose,
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      backdropFrom: Number(interruptedPose?.backdropOpacity ?? 0),
      backdropTo: 1,
      duration: OPEN_DURATION,
      response,
      samples: 24,
      fadeFrame: !from && !interruptedPose,
    });
    applyImageTransitionPose(this.#frame, this.#media, start);
    this.#frame.style.opacity = interruptedPose?.frameOpacity ?? (!from ? "0" : "1");
    this.#portal.backdrop.style.opacity = interruptedPose?.backdropOpacity ?? "0";
    const animations = [
      this.#frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      this.#media.animate(motion.image, this.#motionOptions(motion.duration)),
      this.#frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
    ];
    if (this.#portal.dialog.hasAttribute("data-filmstrip")) {
      const ready = motion.backdrop.find((keyframe) => Number(keyframe.opacity) >= 0.85);
      this.#portal.dialog.style.setProperty(
        "--lightbox-filmstrip-reveal-delay",
        `${Number(ready?.offset ?? 0.7) * motion.duration}ms`,
      );
      this.#portal.dialog.dataset.filmstripRevealing = "";
    }
    this.#synchronizeStart(animations);
    delete this.#portal.overlay.dataset.lightboxPrepared;
    await this.#play(animations, context.signal);
    if (context.signal.aborted) return;
    this.#setState("open");
    delete this.#portal.dialog.dataset.filmstripRevealing;
    this.#portal.dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    this.#portal.dialog.focus({ preventScroll: true });
  }

  async select(context: ViewerSessionMotionContext<TItem>) {
    this.#assertImage(context.item);
    this.#cancelAnimations(true);
    this.#takeInterruptedPose();
    const selected = this.#strip?.index === context.index;
    // A native swipe updates the strip before it reports the selected index.
    // Sending that selection back into the strip would snap an in-progress
    // touch gesture to its midpoint and discard the browser's momentum.
    if (!selected) {
      const smooth = context.reason !== "source-update" && context.reason !== "filmstrip";
      await this.#strip?.select(context.index, smooth);
    }
    this.#render(context.item, context.index);
    // Filmstrip movement is a direct preview scrub. The full-size image swaps
    // immediately while native scrolling continues under the user's finger.
    if (selected || context.reason === "filmstrip") return;
    await this.#play(
      [
        this.#media.animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 160,
          easing: EASING,
        }),
      ],
      context.signal,
    );
  }

  async close(context: ViewerSessionCloseContext) {
    this.#cancelAnimations(true);
    const interruptedPose = this.#takeInterruptedPose(false);
    this.#setState("closing");
    if (context.origin?.trigger.isConnected) this.#returnFocus = context.origin.trigger;
    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const start = interruptedPose ?? {
      ...readImageTransitionPose(this.#frame, this.#media),
      frameOpacity: "1",
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
    const target = from
      ? poseFromThumbnail(thumbnailTransitionPose(from, this.#frame, this.#media, start))
      : {
          transform: new DOMMatrix(start.transform.toString())
            .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
            .scale(0.96),
          clip: start.clip,
        };
    const travel = Math.max(
      Math.abs(target.transform.e - start.transform.e),
      Math.abs(target.transform.f - start.transform.f),
      Math.abs(target.transform.a - start.transform.a) * this.#media.offsetWidth,
      Math.abs(target.transform.d - start.transform.d) * this.#media.offsetHeight,
    );
    const duration = Math.min(480, 220 + Math.sqrt(Math.max(0, travel - 240)) * 4);
    const motion = createImageTransitionMotion({
      opening: false,
      from: start,
      to: target,
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      backdropFrom: Number(start.backdropOpacity),
      backdropTo: 0,
      duration,
      response: duration * 0.9,
      samples: 60,
      fadeFrame: !from,
    });
    applyImageTransitionPose(this.#frame, this.#media, start);
    const animations = [
      this.#frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      this.#media.animate(motion.image, this.#motionOptions(motion.duration)),
      this.#frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
    ];
    this.#synchronizeStart(animations);
    await this.#play(animations, context.signal);
    if (context.signal.aborted) return;
    this.#finishClose();
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#lifetime.abort();
    clearTimeout(this.#suppressClickTimer);
    this.#dragGesture.cancel();
    this.#cancelAnimations(false);
    this.#portalDispose?.();
    this.#portalDispose = undefined;
    this.#strip?.destroy();
    this.#strip = undefined;
    this.#finishClose();
  }

  get #frame() {
    return this.#strip?.active.frame ?? this.#portal.frame;
  }

  get #media() {
    return this.#strip?.active.image ?? this.#portal.media;
  }

  #render(item: TItem, index: number) {
    this.#assertImage(item);
    const media = item.media;
    this.#portal.dialog.setAttribute("aria-label", media.alt || "Image viewer");
    this.#portal.status.textContent = `Item ${index + 1} of ${this.#controller?.state.count ?? 1}`;
  }

  async #play(animations: Animation[], signal: AbortSignal) {
    this.#animations = animations;
    const cancel = () => this.#cancelAnimations(true);
    signal.addEventListener("abort", cancel, { once: true });
    await Promise.allSettled(animations.map((animation) => animation.finished));
    signal.removeEventListener("abort", cancel);
    if (this.#animations !== animations) return;
    this.#animations = [];
    for (const animation of animations) animation.cancel();
    this.#clearMotionStyles();
  }

  #motionOptions(duration: number): KeyframeAnimationOptions {
    return { duration, easing: "linear", fill: "both" };
  }

  #synchronizeStart(animations: Animation[]) {
    const timelineTime = Number(this.#portal.overlay.ownerDocument.timeline.currentTime ?? 0);
    for (const animation of animations) {
      animation.play();
      animation.currentTime = 0;
      animation.startTime = timelineTime;
    }
  }

  #cancelAnimations(preserve: boolean) {
    if (preserve && this.#animations.length > 0) {
      this.#interruptedPose = this.#paintedPose();
      applyImageTransitionPose(this.#frame, this.#media, this.#interruptedPose);
      this.#frame.style.opacity = this.#interruptedPose.frameOpacity;
      this.#portal.backdrop.style.opacity = this.#interruptedPose.backdropOpacity;
    }
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
  }

  #takeInterruptedPose(clear = true) {
    const pose = this.#interruptedPose;
    this.#interruptedPose = undefined;
    if (clear) this.#clearMotionStyles();
    return pose;
  }

  #clearMotionStyles() {
    for (const property of [
      "transform",
      "opacity",
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
    ]) {
      this.#frame.style.removeProperty(property);
    }
    this.#portal.backdrop.style.removeProperty("opacity");
    this.#media.style.removeProperty("opacity");
    this.#media.style.removeProperty("transform");
    for (const property of [
      "--lightbox-drag-x",
      "--lightbox-drag-y",
      "--lightbox-dismiss-progress",
    ]) {
      this.#portal.overlay.style.removeProperty(property);
    }
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.removeAttribute("data-dragging");
      target.removeAttribute("data-dismissing");
    }
  }

  #paintedPose(): PaintedPose {
    const frame = getComputedStyle(this.#frame);
    return {
      ...readImageTransitionPose(this.#frame, this.#media),
      frameOpacity: frame.opacity,
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
  }

  #beginDrag(wheelDirection = 0) {
    if (this.#dragGesture.active || this.#controller?.state.status !== "open") return;
    const frame = this.#frame;
    const style = getComputedStyle(frame);
    const number = (value: string) => Number.parseFloat(value) || 0;
    const matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
    const state = this.#dragGesture.begin({
      matrix,
      wheelTarget: wheelDirection ? new DOMMatrix() : undefined,
      wheelDirection,
      wheelOffset: 0,
      wheelSnapOffset: 0,
      opacity: Number(getComputedStyle(this.#portal.backdrop).opacity),
      closeOpacity: 1,
      borderRadii: [
        number(style.borderTopLeftRadius),
        number(style.borderTopRightRadius),
        number(style.borderBottomRightRadius),
        number(style.borderBottomLeftRadius),
      ],
      targetRadii: [0, 0, 0, 0],
      clipX: 0,
      clipY: 0,
      targetClipX: 0,
      targetClipY: 0,
      width: frame.offsetWidth,
      height: frame.offsetHeight,
      time: performance.now(),
    });
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.dataset.dragging = "";
      target.dataset.dismissing = "";
    }
    this.#paintDrag(state);
  }

  #paintDrag(state: LightboxDragState) {
    const progress = dragProgress(state);
    const scale = 1 - progress * 0.3;
    this.#portal.overlay.style.setProperty("--lightbox-drag-x", `${state.x}px`);
    this.#portal.overlay.style.setProperty("--lightbox-drag-y", `${state.y}px`);
    this.#portal.overlay.style.setProperty("--lightbox-dismiss-progress", String(progress));
    this.#frame.style.transform = `translate(${state.x}px, ${state.y}px) scale(${scale})`;
    this.#portal.backdrop.style.opacity = String(state.opacity * backdropVisibility(progress));
    if (
      state.wheelTarget &&
      state.wheelPhase === "past-open" &&
      Math.abs(dragDistance(state)) < 0.1
    ) {
      this.#dragGesture.finish();
      this.#clearMotionStyles();
    }
  }

  #commitWheelDismiss() {
    const release = this.#dragGesture.finish();
    if (!release) return;
    this.#paintDrag(release.state);
    this.#interruptedPose = this.#paintedPose();
    void this.#controller?.close({ reason: "wheel" });
  }

  #endDrag(cancel = false) {
    this.#pointer = undefined;
    const release = this.#dragGesture.finish();
    if (!release) return;
    this.#paintDrag(release.state);
    const { state, inputDistance, inputSpeed, velocityX, velocityY } = release;
    const commit =
      !cancel &&
      (inputDistance > TOUCH_DISMISS_DISTANCE ||
        (inputDistance > 30 &&
          inputSpeed > 0.6 &&
          velocityX * state.inputX + velocityY * state.inputY > 0));
    if (commit) {
      this.#interruptedPose = this.#paintedPose();
      void this.#controller?.close({ reason: "pointer" });
      return;
    }
    const transform = getComputedStyle(this.#frame).transform;
    const opacity = getComputedStyle(this.#portal.backdrop).opacity;
    const settleX = boundDismissVelocity(state.x, velocityX, "x");
    const settleY = boundDismissVelocity(state.y, velocityY, "y");
    const duration = Math.max(140, 220 - Math.min(80, Math.hypot(settleX, settleY) * 50));
    void this.#play(
      [
        this.#frame.animate([{ transform }, { transform: "none" }], {
          duration,
          easing: EASING,
          fill: "both",
        }),
        this.#portal.backdrop.animate([{ opacity }, { opacity: 1 }], {
          duration,
          easing: EASING,
          fill: "both",
        }),
      ],
      this.#lifetime.signal,
    );
  }

  #finishClose() {
    this.#isolation.deactivate();
    this.#portal.overlay.remove();
    this.#setState("closed");
    if (this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    this.#returnFocus = null;
  }

  #setState(state: "closed" | "opening" | "open" | "closing") {
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.dataset.lightboxState = state;
      target.toggleAttribute("data-open", state !== "closed");
      target.toggleAttribute("data-closed", state === "closed");
      target.toggleAttribute("data-starting-style", state === "opening");
      target.toggleAttribute("data-ending-style", state === "closing");
      target.toggleAttribute("data-opening", state === "opening");
      target.toggleAttribute("data-dismissing", state === "closing");
    }
    if (state === "closed") {
      delete this.#portal.dialog.dataset.filmstripRevealing;
      this.#portal.dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    }
  }

  #assertImage(item: TItem): asserts item is TItem & LightboxItem<LightboxImageMedia> {
    if (!isImageItem(item)) {
      throw new TypeError(`The plain DOM image driver does not yet support ${item.media.type}.`);
    }
  }

  #onKeydown = (event: KeyboardEvent) => {
    if (!this.#portal.overlay.isConnected) return;
    if (event.key === "Escape") {
      event.preventDefault();
      void this.#controller?.close({ reason: "keyboard" });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      void this.#controller?.next({ reason: "keyboard" });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      void this.#controller?.previous({ reason: "keyboard" });
    }
  };

  #onPointerDown = (event: PointerEvent) => {
    if (
      event.pointerType !== "touch" ||
      !event.isPrimary ||
      this.#controller?.state.status !== "open" ||
      (event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea"))
    ) {
      return;
    }
    this.#pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: "pending",
    };
    this.#suppressClick = false;
  };

  #onPointerMove = (event: PointerEvent) => {
    const pointer = this.#pointer;
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    if (Math.max(Math.abs(x), Math.abs(y)) < touchAxisThreshold) return;
    if (pointer.axis === "pending") {
      if (Math.abs(x) > Math.abs(y) * 1.3) pointer.axis = "horizontal";
      else if (Math.abs(y) > Math.abs(x) * 1.3) pointer.axis = "vertical";
    }
    if (pointer.axis !== "vertical") return;
    if (event.cancelable) event.preventDefault();
    this.#suppressClick = true;
    clearTimeout(this.#suppressClickTimer);
    this.#suppressClickTimer = setTimeout(() => (this.#suppressClick = false), 400);
    this.#beginDrag();
    this.#dragGesture.moveTouch(x, y);
  };

  #onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.#pointer?.id) return;
    this.#endDrag();
  };

  #onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== this.#pointer?.id) return;
    this.#endDrag(true);
  };

  #onWheel = (event: WheelEvent) => {
    if (
      event.ctrlKey ||
      this.#controller?.state.status !== "open" ||
      Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.3 ||
      (event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea, [data-lightbox-portal]"))
    ) {
      return;
    }
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const direction = Math.sign(-event.deltaY);
    this.#beginDrag(direction);
    this.#dragGesture.moveWheel(event.deltaY * unit);
  };
}
