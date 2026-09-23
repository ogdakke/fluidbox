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

const OPEN_DURATION = 260;
const CLOSE_DURATION = 220;
const TOUCH_DISMISS_DISTANCE = 60;
const EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";

interface PaintedPose {
  readonly transform: string;
  readonly opacity: string;
  readonly borderTopLeftRadius: string;
  readonly borderTopRightRadius: string;
  readonly borderBottomRightRadius: string;
  readonly borderBottomLeftRadius: string;
  readonly backdropOpacity: string;
}

function isImageItem(item: LightboxItem): item is LightboxItem<LightboxImageMedia> {
  return item.media.type === "image";
}

function originTransform(from: DOMRect, to: DOMRect) {
  const scaleX = from.width / Math.max(1, to.width);
  const scaleY = from.height / Math.max(1, to.height);
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`;
}

function radiusFor(element: HTMLElement | null) {
  if (!element) return "0px";
  const style = getComputedStyle(element);
  return `${style.borderTopLeftRadius} ${style.borderTopRightRadius} ${style.borderBottomRightRadius} ${style.borderBottomLeftRadius}`;
}

function frameKeyframe(pose: PaintedPose): Keyframe {
  return {
    transform: pose.transform,
    opacity: pose.opacity,
    borderTopLeftRadius: pose.borderTopLeftRadius,
    borderTopRightRadius: pose.borderTopRightRadius,
    borderBottomRightRadius: pose.borderBottomRightRadius,
    borderBottomLeftRadius: pose.borderBottomLeftRadius,
  };
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
      this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    }
    this.#strip?.mount();
    this.#isolation.activate();
    this.#setState("opening");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) return;

    const interruptedPose = this.#takeInterruptedPose();
    const origin = context.origin?.visual;
    const target = this.#frame.getBoundingClientRect();
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const frameMotion: Keyframe[] = interruptedPose
      ? [frameKeyframe(interruptedPose), { transform: "none", borderRadius: "0px", opacity: 1 }]
      : from
        ? [
            {
              transform: originTransform(from.getBoundingClientRect(), target),
              borderRadius: radiusFor(from),
              opacity: 1,
            },
            { transform: "none", borderRadius: "0px", opacity: 1 },
          ]
        : [
            { transform: "scale(0.96)", borderRadius: "0px", opacity: 0 },
            { transform: "none", borderRadius: "0px", opacity: 1 },
          ];
    await this.#play(
      [
        this.#frame.animate(frameMotion, {
          duration: OPEN_DURATION,
          easing: EASING,
          fill: "both",
        }),
        this.#portal.backdrop.animate(
          [{ opacity: interruptedPose?.backdropOpacity ?? 0 }, { opacity: 1 }],
          {
            duration: OPEN_DURATION,
            easing: EASING,
            fill: "both",
          },
        ),
      ],
      context.signal,
    );
    if (context.signal.aborted) return;
    this.#setState("open");
    this.#portal.dialog.focus({ preventScroll: true });
  }

  async select(context: ViewerSessionMotionContext<TItem>) {
    this.#assertImage(context.item);
    this.#cancelAnimations(true);
    this.#takeInterruptedPose();
    const selected = this.#strip?.index === context.index;
    await this.#strip?.select(context.index, !selected && context.reason !== "source-update");
    this.#render(context.item, context.index);
    if (selected) return;
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
    const interruptedPose = this.#takeInterruptedPose();
    this.#setState("closing");
    if (context.origin?.trigger.isConnected) this.#returnFocus = context.origin.trigger;
    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const frame = this.#frame.getBoundingClientRect();
    const frameMotion: Keyframe[] = from
      ? [
          interruptedPose
            ? frameKeyframe(interruptedPose)
            : { transform: "none", borderRadius: "0px", opacity: 1 },
          {
            transform: originTransform(from.getBoundingClientRect(), frame),
            borderRadius: radiusFor(from),
            opacity: 1,
          },
        ]
      : [
          interruptedPose ? frameKeyframe(interruptedPose) : { transform: "none", opacity: 1 },
          { transform: "scale(0.96)", opacity: 0 },
        ];
    await this.#play(
      [
        this.#frame.animate(frameMotion, {
          duration: CLOSE_DURATION,
          easing: EASING,
          fill: "both",
        }),
        this.#portal.backdrop.animate(
          [{ opacity: interruptedPose?.backdropOpacity ?? 1 }, { opacity: 0 }],
          {
            duration: CLOSE_DURATION,
            easing: EASING,
            fill: "both",
          },
        ),
      ],
      context.signal,
    );
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

  #cancelAnimations(preserve: boolean) {
    if (preserve && this.#animations.length > 0) {
      this.#interruptedPose = this.#paintedPose();
      Object.assign(this.#frame.style, {
        transform: this.#interruptedPose.transform,
        opacity: this.#interruptedPose.opacity,
        borderTopLeftRadius: this.#interruptedPose.borderTopLeftRadius,
        borderTopRightRadius: this.#interruptedPose.borderTopRightRadius,
        borderBottomRightRadius: this.#interruptedPose.borderBottomRightRadius,
        borderBottomLeftRadius: this.#interruptedPose.borderBottomLeftRadius,
      });
      this.#portal.backdrop.style.opacity = this.#interruptedPose.backdropOpacity;
    }
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
  }

  #takeInterruptedPose() {
    const pose = this.#interruptedPose;
    this.#interruptedPose = undefined;
    this.#clearMotionStyles();
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
      transform: frame.transform,
      opacity: frame.opacity,
      borderTopLeftRadius: frame.borderTopLeftRadius,
      borderTopRightRadius: frame.borderTopRightRadius,
      borderBottomRightRadius: frame.borderBottomRightRadius,
      borderBottomLeftRadius: frame.borderBottomLeftRadius,
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
