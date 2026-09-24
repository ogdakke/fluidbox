import { originIsVisible } from "./origin-geometry";
import {
  backdropVisibility,
  boundDismissVelocity,
  dragDistance,
  dragProgress,
  dismissRadiusProgress,
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
  LightboxItem,
  LightboxPortalRenderer,
  LightboxRenderer,
  LightboxSource,
  LightboxZoomOptions,
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
import { activeViewer } from "./viewer-ownership";
import { mapRadii } from "./transition-geometry";
import { ThumbnailOverlayRuntime } from "./thumbnail-overlay-runtime";

const OPEN_DURATION = 300;
const TOUCH_DISMISS_DISTANCE = 60;
const EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const OPENING_SPRING_RESPONSE = 210;
const TOUCH_OPENING_SPRING_RESPONSE = 380;
const DISMISS_RADIUS_END = 0.1;
const BROWSER_CHROME_RELEASE_PROGRESS = 0.34;
const BROWSER_CHROME_RESTORE_PROGRESS = 0.2;
const WHEEL_HANDOFF_QUIET_GAP = 120;
const WHEEL_HANDOFF_ACCELERATION = 1.25;
const WHEEL_HANDOFF_MIN_DELTA = 4;
const WHEEL_HANDOFF_TIMEOUT = 1200;
const LEGACY_THEME_PROPERTIES = new Set([
  "--radius",
  "--background",
  "--color",
  "--accent",
  "--border",
  "--primary",
]);
const FOCUSABLE_HOST_SELECTOR =
  "[tabindex], a[href], button, input, select, textarea, summary, video[controls], audio[controls], iframe";

function focusableHostFor(element: HTMLElement | null) {
  return element?.parentElement?.closest<HTMLElement>(FOCUSABLE_HOST_SELECTOR) ?? null;
}

interface PaintedPose extends ImageTransitionPose {
  readonly frameOpacity: string;
  readonly backdropOpacity: string;
}

interface PreparedOpen<TItem extends LightboxItem> {
  readonly token: object;
  readonly item: TItem;
  readonly index: number;
  readonly origin: HTMLElement | null;
  readonly animations: Animation[];
  readonly start: PaintedPose;
  readonly motion: ReturnType<typeof createImageTransitionMotion>;
}

function finitePose(pose: PaintedPose) {
  const { transform, clip } = pose;
  return [
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
    clip.x,
    clip.y,
    ...clip.radii,
  ].every(Number.isFinite);
}

/** Plain DOM image driver. It has no dependency on custom elements or a framework. */
export class DomViewerDriver<
  TItem extends LightboxItem = LightboxItem,
> implements ViewerSessionDriver<TItem> {
  readonly #portal: ViewerPortalElements;
  readonly #isolation: ViewerModalIsolation;
  readonly #thumbnailOverlays: ThumbnailOverlayRuntime<TItem>;
  readonly #renderers: Readonly<Record<string, LightboxRenderer<TItem>>>;
  readonly #viewerOwner = {
    closeImmediately: () => {
      const controller = this.#controller;
      if (!controller || controller.state.status === "closed") return true;
      this.#forceImmediateClose = true;
      void controller.close({ reason: "api" });
      this.#forceImmediateClose = false;
      return controller.state.status !== "open";
    },
  };
  readonly #lifetime = new AbortController();
  #controller: LightboxController<TItem> | undefined;
  #strip: ViewerStrip<TItem> | undefined;
  #portalDispose: LightboxDispose | undefined;
  #animations: Animation[] = [];
  #interruptedPose: PaintedPose | undefined;
  #activeOrigin: HTMLElement | null = null;
  #activeTrigger: HTMLElement | null = null;
  #flight: HTMLDivElement | undefined;
  #flightFrame: HTMLDivElement | undefined;
  #flightMedia: HTMLElement | undefined;
  #flightSource: HTMLElement | undefined;
  #flightMarker: Comment | undefined;
  #flightOrigin = { x: 0, y: 0, width: 0, height: 0 };
  #flightViewerOrigin = { x: 0, y: 0 };
  #closeStart: ImageTransitionPose | undefined;
  #closeTargetOrigin: HTMLElement | null = null;
  #closeDuration = 0;
  #closeOriginObserver: ResizeObserver | undefined;
  #closeRetargetFrame = 0;
  #closeRetargetSettleFrame = 0;
  #suppressClick = false;
  #suppressClickTimer: ReturnType<typeof setTimeout> | undefined;
  #wheelHandoff:
    | {
        controller: AbortController;
        lastMagnitude: number;
        lastTime: number;
        accelerationSamples: number;
        timeout: ReturnType<typeof setTimeout>;
      }
    | undefined;
  #pointer:
    | { id: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" }
    | undefined;
  readonly #dragGesture = new LightboxGestureController(
    (state) => this.#paintDrag(state),
    () => this.#commitWheelDismiss(),
  );
  readonly #zoomOptions: LightboxZoomOptions | undefined;
  #zoom: import("./lightbox-zoom").LightboxZoom | undefined;
  #zoomLoad: Promise<import("./lightbox-zoom").LightboxZoom | undefined> | undefined;
  #returnFocus: HTMLElement | null = null;
  #returnFocusFallback: HTMLElement | null = null;
  #viewportWidth = 0;
  #preparedOpen: PreparedOpen<TItem> | undefined;
  readonly #themeProperties = new Set<string>();
  #forceImmediateClose = false;
  #destroyed = false;

  constructor(
    ownerDocument: Document,
    zoomOptions: false | LightboxZoomOptions | undefined,
    renderers?: Readonly<Record<string, LightboxRenderer<TItem>>>,
  ) {
    this.#portal = createViewerPortal(ownerDocument, { defaultCloseButton: false });
    this.#isolation = new ViewerModalIsolation(this.#portal.overlay);
    this.#thumbnailOverlays = new ThumbnailOverlayRuntime(ownerDocument);
    this.#renderers = renderers ?? {};
    this.#portal.dialog.dataset.lightboxHeadless = "";
    this.#portal.container.addEventListener(
      "click",
      (event) => {
        if (this.#suppressClick) {
          this.#suppressClick = false;
          clearTimeout(this.#suppressClickTimer);
          return;
        }
        if (event instanceof MouseEvent && this.#zoom?.handleClick(event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
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
    ownerDocument.addEventListener("focusin", this.#onFocus, {
      capture: true,
      signal: this.#lifetime.signal,
    });
    const ownerWindow = ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", this.#onResize, { signal: this.#lifetime.signal });
    ownerWindow?.visualViewport?.addEventListener("resize", this.#onResize, {
      signal: this.#lifetime.signal,
    });
    if (zoomOptions !== false) {
      const max = zoomOptions?.max ?? 4;
      const step = zoomOptions?.step ?? 2;
      if (!Number.isFinite(max) || max <= 1 || !Number.isFinite(step) || step <= 1 || step > max) {
        throw new RangeError("Lightbox zoom step must be greater than 1 and no greater than max.");
      }
      this.#zoomOptions = { max, step };
    }
  }

  async #loadZoom() {
    if (!this.#zoomOptions || this.#destroyed) return undefined;
    if (this.#zoom) return this.#zoom;
    this.#zoomLoad ??= import("./lightbox-zoom").then(({ LightboxZoom }) => {
      if (this.#destroyed) return undefined;
      const { max = 4, step = 2 } = this.#zoomOptions!;
      return (this.#zoom = new LightboxZoom(this.#portal.container, {
        prepare: () => this.#prepareZoom(),
        config: () => ({ max, step }),
        state: (locked) => {
          const dialog = this.#portal.dialog;
          const wasZoomed = dialog.hasAttribute("data-zoomed");
          if (locked && !wasZoomed) {
            dialog.style.setProperty(
              "--lightbox-zoom-scroll-offset",
              `${this.#strip?.element.scrollLeft ?? 0}px`,
            );
          }
          dialog.toggleAttribute("data-zoomed", locked);
          if (!locked) {
            dialog.style.removeProperty("--lightbox-zoom-scroll-offset");
            if (wasZoomed && this.#strip) void this.#strip.select(this.#strip.index, false);
          }
        },
        close: () => void this.#controller?.close({ reason: "pointer" }),
        reducedMotion: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      }));
    });
    return this.#zoomLoad;
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
    this.#discardPreparation();
    if (this.#strip) {
      this.#strip.setSource(source);
      this.#portal.dialog.toggleAttribute("data-lightbox-gallery", source.count > 1);
      return;
    }
    this.#strip = new ViewerStrip(
      this.#portal.overlay.ownerDocument,
      source,
      (index) => {
        const controller = this.#controller;
        if (controller?.state.status === "open" && controller.state.requestedIndex !== index) {
          void controller.goTo({ index }, { reason: "pointer" });
        }
      },
      this.#renderers,
    );
    this.#portal.frame.replaceWith(this.#strip.element);
    this.#portal.dialog.toggleAttribute("data-lightbox-gallery", source.count > 1);
  }

  registerThumbnailOverlay(
    id: import("./public-api").LightboxItemId,
    registration: import("./public-api").LightboxThumbnailOverlayRegistration<TItem>,
  ) {
    return this.#thumbnailOverlays.register(id, registration);
  }

  prepare(context: Omit<ViewerSessionMotionContext<TItem>, "signal" | "reason">) {
    this.#discardPreparation();
    if (this.#destroyed || this.#controller?.state.status !== "closed" || activeViewer.active) {
      return () => {};
    }
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    this.#viewportWidth = view.innerWidth;
    this.#portal.overlay.style.setProperty("--lightbox-height", `${view.innerHeight}px`);
    this.#applyTheme(context.origin?.trigger ?? null);
    void this.#strip?.select(context.index, false);
    this.#strip?.prepareOpening(context.index, context.origin?.thumbnail);
    this.#render(context.item, context.index);
    this.#portal.overlay.dataset.lightboxPrepared = "";
    this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    this.#strip?.mount();

    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const start = this.#openingStart(from);
    const motion = this.#openingMotion(start, !!from);
    applyImageTransitionPose(this.#frame, this.#media, start);
    this.#frame.style.opacity = start.frameOpacity;
    this.#portal.backdrop.style.opacity = start.backdropOpacity;
    const animations = this.#openingAnimations(motion);
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 0;
    }
    const token = {};
    this.#preparedOpen = {
      token,
      item: context.item,
      index: context.index,
      origin: from,
      animations,
      start,
      motion,
    };
    return () => {
      if (this.#preparedOpen?.token === token) this.#discardPreparation();
    };
  }

  async open(context: ViewerSessionMotionContext<TItem>) {
    const previous = activeViewer.claim(this.#viewerOwner);
    if (previous && !previous.closeImmediately()) {
      activeViewer.claim(previous);
      this.#discardPreparation();
      return false;
    }
    this.#endWheelHandoff();
    void this.#loadZoom();
    this.#cancelAnimations(true);
    const prepared =
      this.#preparedOpen?.item.id === context.item.id && this.#preparedOpen.index === context.index
        ? this.#preparedOpen
        : undefined;
    if (!prepared) this.#discardPreparation();
    else this.#preparedOpen = undefined;
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    this.#viewportWidth = view.innerWidth;
    this.#portal.overlay.style.setProperty("--lightbox-height", `${view.innerHeight}px`);
    const focused = this.#portal.overlay.ownerDocument.activeElement;
    this.#applyTheme(context.origin?.trigger ?? (focused instanceof HTMLElement ? focused : null));
    if (!prepared) {
      await this.#strip?.select(context.index, false);
      this.#strip?.prepareOpening(context.index, context.origin?.thumbnail);
    }
    this.#render(context.item, context.index);
    this.#setActiveTrigger(context.origin?.trigger ?? null);
    this.#returnFocus =
      context.origin?.trigger ??
      (this.#portal.overlay.ownerDocument.activeElement instanceof HTMLElement
        ? this.#portal.overlay.ownerDocument.activeElement
        : null);
    this.#returnFocusFallback = focusableHostFor(this.#returnFocus);
    if (!this.#portal.overlay.isConnected) {
      this.#portal.overlay.dataset.lightboxPrepared = "";
      this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    }
    this.#strip?.mount();
    this.#isolation.activate();
    this.#setState("opening");
    if (!prepared) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) return;
    if (this.#prefersReducedMotion()) {
      for (const animation of prepared?.animations ?? []) animation.cancel();
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#thumbnailOverlays.prepare(context.item, context.index, this.#frame, "open", 0);
      this.#strip?.completeOpening(context.index);
      delete this.#portal.overlay.dataset.lightboxPrepared;
      this.#setState("open");
      this.#focus();
      return;
    }

    const interruptedPose = this.#takeInterruptedPose(false);
    const origin = context.origin?.visual;
    const from =
      prepared?.origin ?? (origin && origin.isConnected && originIsVisible(origin) ? origin : null);
    this.#activeOrigin = from;
    const start =
      prepared && !interruptedPose ? prepared.start : this.#openingStart(from, interruptedPose);
    const motion =
      prepared && !interruptedPose
        ? prepared.motion
        : this.#openingMotion(start, !!from, interruptedPose);
    const overlayFrom = interruptedPose ? this.#thumbnailOverlays.currentProgress(1) : 1;
    this.#thumbnailOverlays.prepare(
      context.item,
      context.index,
      this.#frame,
      "opening",
      overlayFrom,
    );
    applyImageTransitionPose(this.#frame, this.#media, start);
    this.#frame.style.opacity = interruptedPose?.frameOpacity ?? (!from ? "0" : "1");
    this.#portal.backdrop.style.opacity = interruptedPose?.backdropOpacity ?? "0";
    const animations = [
      ...(prepared && !interruptedPose ? prepared.animations : this.#openingAnimations(motion)),
      ...this.#thumbnailOverlays.animations(motion.frame, motion.duration, overlayFrom, 0),
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
    await this.#waitForFilmstripReveal(context.signal);
    if (context.signal.aborted) return;
    this.#setState("open");
    this.#strip?.completeOpening(context.index);
    this.#thumbnailOverlays.set("open", 0, new DOMMatrix());
    delete this.#portal.dialog.dataset.filmstripRevealing;
    this.#portal.dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    this.#focus();
  }

  async select(context: ViewerSessionMotionContext<TItem>) {
    this.#cancelAnimations(true);
    this.#zoom?.suspend();
    void this.#loadZoom();
    this.#takeInterruptedPose();
    const origin = context.origin?.visual;
    this.#activeOrigin = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    this.#setActiveTrigger(context.origin?.trigger ?? null);
    const selected = this.#strip?.index === context.index;
    // A native swipe updates the strip before it reports the selected index.
    // Sending that selection back into the strip would snap an in-progress
    // touch gesture to its midpoint and discard the browser's momentum.
    if (!selected) {
      const smooth =
        !this.#prefersReducedMotion() &&
        context.reason !== "source-update" &&
        context.reason !== "filmstrip";
      await this.#strip?.select(context.index, smooth);
    }
    this.#render(context.item, context.index);
    this.#thumbnailOverlays.prepare(context.item, context.index, this.#frame, "open", 0);
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
    this.#zoom?.suspend();
    this.#cancelAnimations(true);
    const interruptedPose = this.#takeInterruptedPose(false);
    this.#setState("closing");
    this.#setActiveTrigger(null);
    if (context.origin?.trigger.isConnected) {
      this.#returnFocus = context.origin.trigger;
      this.#returnFocusFallback = focusableHostFor(context.origin.trigger);
    }
    if (this.#forceImmediateClose || this.#prefersReducedMotion()) {
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#finishClose();
      return;
    }
    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const start = interruptedPose ?? {
      ...readImageTransitionPose(this.#frame, this.#media),
      frameOpacity: "1",
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
    let target = from
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
    let frame = this.#frame;
    let media = this.#media;
    if (from) {
      const flight = this.#createCloseFlight(start, from, media);
      frame = flight.frame;
      media = flight.media;
      target = flight.target;
      this.#closeOriginObserver = new ResizeObserver(this.#scheduleCloseTargetUpdate);
      this.#closeOriginObserver.observe(from);
    }
    this.#closeStart = start;
    this.#closeTargetOrigin = from;
    this.#closeDuration = duration;
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
    const overlayFrom = this.#thumbnailOverlays.currentProgress(0);
    this.#thumbnailOverlays.set("closing", overlayFrom);
    applyImageTransitionPose(frame, media, start);
    const animations = [
      frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      media.animate(motion.image, this.#motionOptions(motion.duration)),
      frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
      ...this.#thumbnailOverlays.animations(motion.frame, motion.duration, overlayFrom, 1),
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
    this.#endWheelHandoff();
    this.#zoom?.destroy();
    this.#discardPreparation();
    this.#thumbnailOverlays.destroy();
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
    const media = item.media;
    const label = media.type === "image" ? media.alt : media.title;
    this.#portal.dialog.setAttribute("aria-label", label || "Media viewer");
    this.#portal.status.textContent = `Item ${index + 1} of ${this.#controller?.state.count ?? 1}`;
  }

  #openingStart(from: HTMLElement | null, interrupted?: PaintedPose): PaintedPose {
    if (interrupted) return interrupted;
    const openPose = openImageTransitionPose();
    if (from) {
      return {
        ...poseFromThumbnail(thumbnailTransitionPose(from, this.#frame, this.#media, openPose)),
        frameOpacity: "1",
        backdropOpacity: "0",
      };
    }
    return {
      transform: new DOMMatrix()
        .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
        .scale(0.96),
      clip: openPose.clip,
      frameOpacity: "0",
      backdropOpacity: "0",
    };
  }

  #openingMotion(start: PaintedPose, hasOrigin: boolean, interrupted?: PaintedPose) {
    const response = matchMedia("(hover: none) and (pointer: coarse)").matches
      ? TOUCH_OPENING_SPRING_RESPONSE
      : OPENING_SPRING_RESPONSE;
    return createImageTransitionMotion({
      opening: true,
      from: start,
      to: openImageTransitionPose(),
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      backdropFrom: Number(start.backdropOpacity),
      backdropTo: 1,
      duration: OPEN_DURATION,
      response,
      samples: 24,
      fadeFrame: !hasOrigin && !interrupted,
    });
  }

  #openingAnimations(motion: ReturnType<typeof createImageTransitionMotion>) {
    return [
      this.#frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      this.#media.animate(motion.image, this.#motionOptions(motion.duration)),
      this.#frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
    ];
  }

  #discardPreparation() {
    const prepared = this.#preparedOpen;
    if (!prepared) return;
    this.#preparedOpen = undefined;
    for (const animation of prepared.animations) animation.cancel();
    this.#strip?.unmount();
    this.#clearMotionStyles();
    this.#portal.overlay.remove();
  }

  #applyTheme(source: HTMLElement | null) {
    for (const property of this.#themeProperties) {
      this.#portal.overlay.style.removeProperty(property);
    }
    this.#themeProperties.clear();
    if (!source) return;
    const style = getComputedStyle(source);
    for (const property of style) {
      if (!property.startsWith("--lightbox-") && !LEGACY_THEME_PROPERTIES.has(property)) continue;
      const value = style.getPropertyValue(property);
      if (!value) continue;
      this.#portal.overlay.style.setProperty(property, value);
      this.#themeProperties.add(property);
    }
  }

  async #waitForFilmstripReveal(signal: AbortSignal) {
    const filmstrip = this.#portal.dialog.querySelector<HTMLElement>("[data-lightbox-filmstrip]");
    const animation = filmstrip
      ?.getAnimations()
      .find(
        (candidate) => (candidate as CSSAnimation).animationName === "lightbox-filmstrip-appear",
      );
    if (!animation) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        signal.removeEventListener("abort", done);
        resolve();
      };
      signal.addEventListener("abort", done, { once: true });
      void animation.finished.then(done, done);
    });
  }

  #setActiveTrigger(trigger: HTMLElement | null) {
    if (this.#activeTrigger && this.#activeTrigger !== trigger) {
      this.#paintTrigger(this.#activeTrigger, false);
    }
    this.#activeTrigger = trigger;
    if (trigger) this.#paintTrigger(trigger, true);
  }

  #paintTrigger(trigger: HTMLElement, open: boolean) {
    trigger.dataset.lightboxState = open ? "open" : "closed";
    trigger.toggleAttribute("data-open", open);
    trigger.toggleAttribute("data-closed", !open);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", String(open));
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

  #prefersReducedMotion() {
    return (
      this.#portal.overlay.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)")
        .matches ?? false
    );
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
      this.#thumbnailOverlays.preservePaint();
      let pose: PaintedPose | undefined;
      try {
        pose = this.#flightFrame ? this.#paintedFlightPose() : this.#paintedPose();
      } catch {
        // A source replacement can recycle an unmeasured frame while the old
        // animation is still settling. There is no painted pose to preserve.
      }
      this.#removeFlight();
      if (pose && finitePose(pose) && this.#media.offsetWidth && this.#media.offsetHeight) {
        this.#interruptedPose = pose;
        applyImageTransitionPose(this.#frame, this.#media, pose);
        this.#frame.style.opacity = pose.frameOpacity;
        this.#portal.backdrop.style.opacity = pose.backdropOpacity;
      } else {
        this.#interruptedPose = undefined;
      }
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

  #paintedFlightPose(): PaintedPose {
    const frame = this.#flightFrame!;
    const media = this.#flightMedia!;
    const visible = media.getBoundingClientRect();
    const scaleX = visible.width / Math.max(1, media.offsetWidth);
    const scaleY = visible.height / Math.max(1, media.offsetHeight);
    const flightPose = readImageTransitionPose(frame, media);
    const transform = new DOMMatrix()
      .translate(
        visible.left - this.#flightViewerOrigin.x,
        visible.top - this.#flightViewerOrigin.y,
      )
      .scale(scaleX, scaleY);
    return {
      transform,
      clip: flightPose.clip,
      frameOpacity: getComputedStyle(frame).opacity,
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
  }

  #prepareZoom() {
    if (
      this.#controller?.state.status !== "open" ||
      this.#flight ||
      !this.#strip ||
      !(this.#media instanceof HTMLImageElement)
    )
      return null;
    this.#dragGesture.cancel();
    this.#cancelAnimations(true);
    const interrupted = this.#takeInterruptedPose();
    if (interrupted) applyImageTransitionPose(this.#frame, this.#media, interrupted);
    return { image: this.#media, frame: this.#frame };
  }

  #createCloseFlight(start: ImageTransitionPose, origin: HTMLElement, source: HTMLElement) {
    const ownerDocument = this.#portal.overlay.ownerDocument;
    const view = ownerDocument.defaultView!;
    const bounds = source.getBoundingClientRect();
    const flight = ownerDocument.createElement("div");
    flight.dataset.lightboxFlight = "";
    flight.setAttribute("aria-hidden", "true");
    flight.style.setProperty(
      "--lightbox-flight-height",
      `${ownerDocument.documentElement.scrollHeight}px`,
    );
    const frame = ownerDocument.createElement("div");
    frame.dataset.lightboxFrame = "";
    this.#flightOrigin = {
      x: bounds.left + view.scrollX - start.transform.e,
      y: bounds.top + view.scrollY - start.transform.f,
      width: source.offsetWidth,
      height: source.offsetHeight,
    };
    this.#flightViewerOrigin = {
      x: bounds.left - start.transform.e,
      y: bounds.top - start.transform.f,
    };
    frame.style.setProperty("--lightbox-flight-left", `${this.#flightOrigin.x}px`);
    frame.style.setProperty("--lightbox-flight-top", `${this.#flightOrigin.y}px`);
    frame.style.setProperty("--lightbox-flight-width", `${source.offsetWidth}px`);
    frame.style.setProperty("--lightbox-flight-item-height", `${source.offsetHeight}px`);
    const media =
      source instanceof HTMLImageElement ? (source.cloneNode(true) as HTMLImageElement) : source;
    if (media !== source) {
      media.removeAttribute("style");
      source.dataset.lightboxFlightSourceHidden = "";
    } else {
      this.#flightMarker = ownerDocument.createComment("lightbox-flight-home");
      source.before(this.#flightMarker);
    }
    media.dataset.lightboxMedia = "";
    frame.append(media);
    flight.append(frame);
    ownerDocument.body.append(flight);
    this.#flight = flight;
    this.#flightFrame = frame;
    this.#flightMedia = media;
    this.#flightSource = source;
    applyImageTransitionPose(frame, media, start);
    const target = this.#flightTargetPose(origin, media);
    return { frame, media, target };
  }

  #flightTargetPose(origin: HTMLElement, media: HTMLElement): ImageTransitionPose {
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    const rect = origin.getBoundingClientRect();
    const width = media.offsetWidth;
    const height = media.offsetHeight;
    const scale = Math.max(rect.width / Math.max(1, width), rect.height / Math.max(1, height));
    const x = Math.max(0, (width - rect.width / scale) / 2);
    const y = Math.max(0, (height - rect.height / scale) / 2);
    const style = getComputedStyle(origin);
    return {
      transform: new DOMMatrix()
        .translate(
          rect.left + view.scrollX - this.#flightOrigin.x - x * scale,
          rect.top + view.scrollY - this.#flightOrigin.y - y * scale,
        )
        .scale(scale),
      clip: {
        x,
        y,
        radii: [
          Number.parseFloat(style.borderTopLeftRadius) || 0,
          Number.parseFloat(style.borderTopRightRadius) || 0,
          Number.parseFloat(style.borderBottomRightRadius) || 0,
          Number.parseFloat(style.borderBottomLeftRadius) || 0,
        ],
      },
    };
  }

  #removeFlight() {
    if (this.#flightSource) delete this.#flightSource.dataset.lightboxFlightSourceHidden;
    if (this.#flightMarker?.parentNode && this.#flightSource) {
      this.#flightMarker.replaceWith(this.#flightSource);
    }
    this.#flightMarker = undefined;
    this.#flight?.remove();
    this.#flight = undefined;
    this.#flightFrame = undefined;
    this.#flightMedia = undefined;
    this.#flightSource = undefined;
    this.#closeStart = undefined;
    this.#closeTargetOrigin = null;
    this.#closeDuration = 0;
    this.#closeOriginObserver?.disconnect();
    this.#closeOriginObserver = undefined;
    cancelAnimationFrame(this.#closeRetargetFrame);
    cancelAnimationFrame(this.#closeRetargetSettleFrame);
    this.#closeRetargetFrame = 0;
    this.#closeRetargetSettleFrame = 0;
  }

  #scheduleCloseTargetUpdate = () => {
    cancelAnimationFrame(this.#closeRetargetFrame);
    cancelAnimationFrame(this.#closeRetargetSettleFrame);
    this.#closeRetargetFrame = requestAnimationFrame(() => {
      this.#closeRetargetFrame = 0;
      this.#updateCloseTarget();
      this.#closeRetargetSettleFrame = requestAnimationFrame(() => {
        this.#closeRetargetSettleFrame = 0;
        this.#updateCloseTarget();
      });
    });
  };

  #onResize = () => {
    const view = this.#portal.overlay.ownerDocument.defaultView;
    if (!view) return;
    const widthChanged = view.innerWidth !== this.#viewportWidth;
    if (this.#controller?.state.status === "closing") {
      if (widthChanged) {
        this.#viewportWidth = view.innerWidth;
        this.#portal.overlay.style.setProperty("--lightbox-height", `${view.innerHeight}px`);
      }
      this.#updateCloseTarget();
      this.#scheduleCloseTargetUpdate();
      return;
    }
    if (!widthChanged) return;
    if (this.#dragGesture.active) this.#endDrag(true);
    this.#viewportWidth = view.innerWidth;
    this.#portal.overlay.style.setProperty("--lightbox-height", `${view.innerHeight}px`);
    if (this.#zoom?.zoomed) {
      this.#zoom.reset();
      return;
    }
    if (this.#controller?.state.status === "opening") {
      this.#cancelAnimations(false);
      this.#clearMotionStyles();
    }
  };

  #updateCloseTarget() {
    const origin = this.#closeTargetOrigin;
    const start = this.#closeStart;
    const frame = this.#flightFrame;
    const media = this.#flightMedia;
    if (!origin || !start || !frame || !media || this.#animations.length < 3) return;
    const target = this.#flightTargetPose(origin, media);
    const motion = createImageTransitionMotion({
      opening: false,
      from: start,
      to: target,
      width: media.offsetWidth,
      height: media.offsetHeight,
      backdropFrom: 1,
      backdropTo: 0,
      duration: this.#closeDuration,
      response: this.#closeDuration * 0.9,
      samples: 60,
    });
    const [frameAnimation, mediaAnimation, radiusAnimation] = this.#animations;
    if (frameAnimation?.effect instanceof KeyframeEffect) {
      frameAnimation.effect.setKeyframes(motion.frame);
    }
    if (mediaAnimation?.effect instanceof KeyframeEffect) {
      mediaAnimation.effect.setKeyframes(motion.image);
    }
    if (radiusAnimation?.effect instanceof KeyframeEffect) {
      radiusAnimation.effect.setKeyframes(motion.radius);
    }
    this.#thumbnailOverlays.retarget(this.#animations, motion.frame);
  }

  #beginDrag(wheelDirection = 0) {
    if (this.#dragGesture.active || this.#controller?.state.status !== "open") return;
    this.#zoom?.suspend();
    this.#cancelAnimations(true);
    const frame = this.#frame;
    const current = readImageTransitionPose(frame, this.#media);
    const matrix = current.transform;
    this.#strip?.freeze();
    const origin = this.#activeOrigin;
    const target =
      origin && origin.isConnected && originIsVisible(origin)
        ? poseFromThumbnail(thumbnailTransitionPose(origin, frame, this.#media, current))
        : {
            transform: new DOMMatrix()
              .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
              .scale(0.96),
            clip: current.clip,
          };
    const wheelTarget = wheelDirection ? new DOMMatrix(target.transform.toString()) : undefined;
    const wheelOffset = !wheelTarget
      ? 0
      : matrix.a > 1
        ? 180 * Math.log(Math.max(0.001, 1 - (matrix.a - 1) / 0.12))
        : Math.abs(1 - wheelTarget.a) > 0.001
          ? (360 * (1 - matrix.a)) / (1 - wheelTarget.a)
          : Math.abs(1 - wheelTarget.d) > 0.001
            ? (360 * (1 - matrix.d)) / (1 - wheelTarget.d)
            : 0;
    const state = this.#dragGesture.begin({
      matrix,
      wheelTarget,
      wheelDirection,
      wheelOffset,
      wheelSnapOffset: wheelDirection ? (this.#strip?.snapOffset ?? 0) : 0,
      opacity: Number(getComputedStyle(this.#portal.backdrop).opacity),
      closeOpacity: 1,
      borderRadii: current.clip.radii,
      targetRadii: target.clip.radii,
      clipX: current.clip.x,
      clipY: current.clip.y,
      targetClipX: target.clip.x,
      targetClipY: target.clip.y,
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      time: performance.now(),
    });
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.dataset.dragging = "";
      target.dataset.dismissing = "";
    }
    this.#paintDrag(state);
  }

  #paintDrag(state: LightboxDragState) {
    const distance = dragDistance(state);
    const progress = dragProgress(state);
    this.#portal.overlay.style.setProperty("--lightbox-drag-x", `${state.x}px`);
    this.#portal.overlay.style.setProperty("--lightbox-drag-y", `${state.y}px`);
    this.#portal.overlay.style.setProperty("--lightbox-dismiss-progress", String(progress));
    if (!state.wheelTarget) this.#syncOverlayEdges(progress);
    const stretch = distance < 0 ? 1 + 0.12 * (1 - Math.exp(distance / 180)) : 1;
    const scale = 1 - progress * 0.3;
    const from = state.wheelTarget
      ? new DOMMatrix().translate(state.wheelSnapOffset * state.wheelSnapProgress, 0)
      : state.matrix;
    const to = state.wheelTarget;
    const matrix =
      to && distance < 0
        ? from
            .translate((state.width * (1 - stretch)) / 2, (state.height * (1 - stretch)) / 2)
            .scale(stretch)
        : to
          ? new DOMMatrix([
              from.a + (to.a - from.a) * progress,
              0,
              0,
              from.d + (to.d - from.d) * progress,
              from.e + (to.e - from.e) * progress,
              from.f + (to.f - from.f) * progress,
            ])
          : new DOMMatrix()
              .translate(state.x, state.y)
              .multiply(from)
              .translate((state.width * (1 - scale)) / 2, (state.height * (1 - scale)) / 2)
              .scale(scale);
    const radiusProgress = state.wheelTarget
      ? Math.min(1, progress / DISMISS_RADIUS_END)
      : dismissRadiusProgress(state.x, state.y);
    applyImageTransitionPose(this.#frame, this.#media, {
      transform: matrix,
      clip: {
        x: state.clipX + (state.targetClipX - state.clipX) * progress,
        y: state.clipY + (state.targetClipY - state.clipY) * progress,
        radii: mapRadii(
          state.borderRadii,
          (radius, index) => radius + (state.targetRadii[index]! - radius) * radiusProgress,
        ),
      },
    });
    this.#thumbnailOverlays.set("dragging", progress, matrix);
    this.#portal.backdrop.style.opacity = String(state.opacity * backdropVisibility(progress));
    if (
      state.wheelTarget &&
      state.wheelPhase === "past-open" &&
      Math.abs(dragDistance(state)) < 0.1
    ) {
      this.#dragGesture.finish();
      this.#clearMotionStyles();
      this.#strip?.resume();
    }
  }

  #syncOverlayEdges(progress: number) {
    if (progress >= BROWSER_CHROME_RELEASE_PROGRESS) {
      this.#portal.overlay.dataset.lightboxEdgeReleased = "";
    } else if (progress <= BROWSER_CHROME_RESTORE_PROGRESS) {
      delete this.#portal.overlay.dataset.lightboxEdgeReleased;
    }
  }

  #commitWheelDismiss() {
    const release = this.#dragGesture.finish();
    if (!release) return;
    this.#paintDrag(release.state);
    this.#interruptedPose = this.#paintedPose();
    this.#beginWheelHandoff();
    void this.#controller?.close({ reason: "wheel" });
  }

  #beginWheelHandoff() {
    if (this.#wheelHandoff) return;
    const controller = new AbortController();
    const handoff = {
      controller,
      lastMagnitude: 0,
      lastTime: performance.now(),
      accelerationSamples: 0,
      timeout: setTimeout(() => this.#endWheelHandoff(), WHEEL_HANDOFF_TIMEOUT),
    };
    this.#wheelHandoff = handoff;
    this.#portal.overlay.ownerDocument.defaultView?.addEventListener(
      "wheel",
      this.#onWheelHandoff,
      { capture: true, passive: false, signal: controller.signal },
    );
  }

  #onWheelHandoff = (event: WheelEvent) => {
    const handoff = this.#wheelHandoff;
    if (!handoff || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.3) return;
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.innerHeight : 1;
    const magnitude = Math.abs(event.deltaY * unit);
    const now = performance.now();
    const elapsed = Math.max(1, now - handoff.lastTime);
    const magnitudeIncreased =
      magnitude >= WHEEL_HANDOFF_MIN_DELTA &&
      handoff.lastMagnitude > 0 &&
      magnitude >= handoff.lastMagnitude * WHEEL_HANDOFF_ACCELERATION;
    handoff.accelerationSamples = magnitudeIncreased ? handoff.accelerationSamples + 1 : 0;
    if (elapsed >= WHEEL_HANDOFF_QUIET_GAP || handoff.accelerationSamples >= 2) {
      this.#endWheelHandoff();
      return;
    }
    handoff.lastMagnitude = magnitude;
    handoff.lastTime = now;
    if (event.cancelable) event.preventDefault();
  };

  #endWheelHandoff() {
    const handoff = this.#wheelHandoff;
    if (!handoff) return;
    clearTimeout(handoff.timeout);
    handoff.controller.abort();
    this.#wheelHandoff = undefined;
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
    const current = readImageTransitionPose(this.#frame, this.#media);
    const opacity = Number(getComputedStyle(this.#portal.backdrop).opacity);
    const settleX = boundDismissVelocity(state.x, velocityX, "x");
    const settleY = boundDismissVelocity(state.y, velocityY, "y");
    const duration = Math.max(140, 220 - Math.min(80, Math.hypot(settleX, settleY) * 50));
    const motion = createImageTransitionMotion({
      opening: true,
      from: current,
      to: openImageTransitionPose(),
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      backdropFrom: opacity,
      backdropTo: 1,
      duration,
      response: duration * 0.8,
      samples: 24,
    });
    const animations = [
      this.#frame.animate(motion.frame, this.#motionOptions(duration)),
      this.#media.animate(motion.image, this.#motionOptions(duration)),
      this.#frame.animate(motion.radius, this.#motionOptions(duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(duration)),
      ...this.#thumbnailOverlays.animations(
        motion.frame,
        duration,
        this.#thumbnailOverlays.currentProgress(dragProgress(state)),
        0,
      ),
    ];
    this.#synchronizeStart(animations);
    void this.#play(animations, this.#lifetime.signal).then(() => {
      this.#thumbnailOverlays.set("open", 0, new DOMMatrix());
      this.#strip?.resume();
    });
  }

  #finishClose() {
    this.#strip?.resume();
    delete this.#portal.overlay.dataset.lightboxEdgeReleased;
    this.#removeFlight();
    this.#thumbnailOverlays.finishClose();
    this.#setActiveTrigger(null);
    activeViewer.release(this.#viewerOwner);
    this.#isolation.deactivate();
    this.#portal.overlay.remove();
    this.#setState("closed");
    const returnFocus = this.#returnFocus?.isConnected
      ? this.#returnFocus
      : this.#returnFocusFallback?.isConnected
        ? this.#returnFocusFallback
        : null;
    returnFocus?.focus({ preventScroll: true });
    this.#returnFocus = null;
    this.#returnFocusFallback = null;
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

  #onKeydown = (event: KeyboardEvent) => {
    if (!this.#portal.overlay.isConnected) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      void this.#controller?.close({ reason: "keyboard" });
    } else if (["+", "=", "-", "0"].includes(event.key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      void this.#loadZoom().then((zoom) => {
        if (event.key === "0") zoom?.reset();
        else zoom?.zoomBy(event.key === "-" ? 1 / 1.5 : 1.5);
      });
    } else if (event.key === "Tab") {
      event.preventDefault();
      const controls = Array.from(
        this.#portal.dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, video[controls], audio[controls], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (control) =>
          !control.hasAttribute("disabled") &&
          !control.hasAttribute("hidden") &&
          !control.closest("[hidden], [aria-hidden=true]") &&
          getComputedStyle(control).pointerEvents !== "none" &&
          (this.#controller?.state.status !== "closing" ||
            !control.closest("[data-lightbox-slides]")),
      );
      const active = this.#portal.overlay.ownerDocument.activeElement;
      const index = controls.findIndex((control) => control === active);
      const nextIndex =
        index < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      const next = controls[nextIndex];
      if (next) next.focus({ preventScroll: true });
      else this.#focus();
    } else if (
      (this.#controller?.state.count ?? 0) > 1 &&
      ["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      void this.#controller?.close({ reason: "keyboard" });
    } else if (event.key === "ArrowRight" && this.#controller?.state.status === "open") {
      event.preventDefault();
      this.#zoom?.suspend();
      void this.#controller?.next({ reason: "keyboard" });
    } else if (event.key === "ArrowLeft" && this.#controller?.state.status === "open") {
      event.preventDefault();
      this.#zoom?.suspend();
      void this.#controller?.previous({ reason: "keyboard" });
    }
  };

  #onFocus = (event: FocusEvent) => {
    if (!this.#portal.overlay.isConnected || event.composedPath().includes(this.#portal.dialog))
      return;
    this.#focus();
  };

  #focus() {
    const close = this.#portal.dialog.querySelector<HTMLElement>("[data-lightbox-close]");
    (close && !close.hasAttribute("hidden") ? close : this.#portal.dialog).focus({
      preventScroll: true,
    });
  }

  #eventUsesNativeInteraction(event: Event, includeMedia = true) {
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          target.matches(
            `${includeMedia ? "video, audio, " : ""}iframe, input, select, textarea, button, summary, a[href], [contenteditable], [data-lightbox-filmstrip]`,
          ),
      );
  }

  #onPointerDown = (event: PointerEvent) => {
    if (
      event.pointerType !== "touch" ||
      !event.isPrimary ||
      this.#controller?.state.status !== "open" ||
      this.#eventUsesNativeInteraction(event)
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
    if (this.#controller?.state.status === "closing") {
      if (this.#wheelHandoff && event.cancelable) event.preventDefault();
      return;
    }
    if (
      event.ctrlKey ||
      this.#controller?.state.status !== "open" ||
      Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.3 ||
      this.#eventUsesNativeInteraction(event, false) ||
      (event.target instanceof Element && event.target.closest("[data-lightbox-portal]"))
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
