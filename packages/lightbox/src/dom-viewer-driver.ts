import { originIsVisible } from "./origin-geometry";
import { originMatchesItem, originShowsItem } from "./origin-match";
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
  originTransitionPose,
  readImageTransitionPose,
  type ImageTransitionPose,
} from "./image-transition-motion";
import type {
  LightboxController,
  LightboxDispose,
  LightboxItem,
  LightboxOrigin,
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
import { viewerSelectionCommandOptions } from "./viewer-session";
import {
  createViewerPortal,
  ViewerModalIsolation,
  type ViewerPortalElements,
} from "./viewer-portal";
import { ViewerStrip } from "./viewer-strip";
import { activeViewer } from "./viewer-ownership";
import { handoffDecodedFlightImage } from "./flight-image";
import { mapRadii, mixInsets } from "./transition-geometry";
import { originPose, originPicture } from "./origin-pose";
import { ThumbnailOverlayRuntime } from "./thumbnail-overlay-runtime";

const OPEN_DURATION = 300;
const TOUCH_DISMISS_DISTANCE = 60;
const OPENING_SPRING_RESPONSE = 210;
const TOUCH_OPENING_SPRING_RESPONSE = 380;
const DISMISS_RADIUS_END = 0.1;
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
  readonly picture: HTMLElement | null;
  readonly animations: Animation[];
  readonly start: PaintedPose & { readonly fromOrigin: boolean };
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
    clip.top,
    clip.right,
    clip.bottom,
    clip.left,
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
  /** The element in the active origin that paints the item, when it does. */
  #activePicture: HTMLElement | null = null;
  #activeTrigger: HTMLElement | null = null;
  #flight: HTMLDivElement | undefined;
  #flightFrame: HTMLDivElement | undefined;
  #flightMedia: HTMLElement | undefined;
  #flightSource: HTMLElement | undefined;
  #flightSourceFrame: HTMLElement | undefined;
  #closeCrossfade = false;
  #crossfadeThumbnail: HTMLElement | undefined;
  #flightMarker: Comment | undefined;
  #preparedFlight:
    | { source: HTMLImageElement; image: HTMLImageElement; ready: Promise<boolean> }
    | undefined;
  #flightOrigin = { x: 0, y: 0, width: 0, height: 0 };
  #flightViewerOrigin = { x: 0, y: 0 };
  #closeStart: ImageTransitionPose | undefined;
  #closeTargetOrigin: HTMLElement | null = null;
  #closeTargetPicture: HTMLElement | null = null;
  #closeDuration = 0;
  #closeOriginObserver: ResizeObserver | undefined;
  #mediaObserver: ResizeObserver | undefined;
  #observedMedia: HTMLElement | undefined;
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
          event.target === this.#portal.container ||
          (event.target instanceof Element &&
            !!event.target.closest("[data-lightbox-slide]") &&
            !event.target.closest("[data-lightbox-frame], [data-lightbox-filmstrip]"))
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
    ownerWindow?.addEventListener("scroll", this.#onPageScroll, {
      passive: true,
      signal: this.#lifetime.signal,
    });
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
    this.#preparedFlight = undefined;
    if (this.#strip) {
      this.#strip.setSource(source);
      this.#portal.dialog.toggleAttribute("data-lightbox-gallery", source.count > 1);
      return;
    }
    this.#strip = new ViewerStrip(
      this.#portal.overlay.ownerDocument,
      source,
      (index, settled) => {
        const controller = this.#controller;
        if (
          controller?.state.status === "open" &&
          (controller.state.requestedIndex !== index || settled)
        ) {
          void controller.goTo({ index }, viewerSelectionCommandOptions("pointer", settled));
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
    this.#sizeContainer(view);
    this.#applyTheme(context.origin?.trigger ?? null);
    this.#syncPageHeight();
    void this.#strip?.select(context.index, false);
    this.#strip?.prepareOpening(context.index, this.#matchingThumbnail(context));
    this.#render(context.item, context.index);
    this.#portal.overlay.dataset.lightboxPrepared = "";
    this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    this.#strip?.mount();

    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const crossfade = !!from && !originMatchesItem(context.origin, context.item);
    const picture = this.#originPicture(from, context.origin, crossfade);
    if (picture instanceof HTMLVideoElement) this.#strip?.continueVideo(context.index, picture);
    const start = this.#openingStart(from, picture, undefined, crossfade);
    const motion = this.#openingMotion(start, start.fromOrigin, undefined, crossfade);
    this.#applyMediaPose(this.#frame, this.#media, start);
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
      picture,
      animations,
      start,
      motion,
    };
    return () => {
      if (this.#preparedOpen?.token === token) this.#discardPreparation();
    };
  }

  async open(context: ViewerSessionMotionContext<TItem>) {
    // The session has just hidden the card's image. Keep it painted until the
    // opening's first frame is ready to cover it, or the card blinks empty.
    this.#keepThumbnailVisible(context.origin?.thumbnail);
    this.#preparedFlight = undefined;
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
    this.#sizeContainer(view);
    const focused = this.#portal.overlay.ownerDocument.activeElement;
    this.#applyTheme(context.origin?.trigger ?? (focused instanceof HTMLElement ? focused : null));
    this.#syncPageHeight();
    if (!prepared) {
      await this.#strip?.select(context.index, false);
      this.#strip?.prepareOpening(context.index, this.#matchingThumbnail(context));
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
      this.#keepThumbnailVisible(undefined);
      for (const animation of prepared?.animations ?? []) animation.cancel();
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#thumbnailOverlays.prepare(context.item, context.index, this.#frame, "open", 0);
      this.#strip?.completeOpening(context.index);
      delete this.#portal.overlay.dataset.lightboxPrepared;
      this.#setState("open");
      this.#focusUnlessInside();
      return;
    }

    const interruptedPose = this.#takeInterruptedPose(false);
    const origin = context.origin?.visual;
    const from =
      prepared?.origin ?? (origin && origin.isConnected && originIsVisible(origin) ? origin : null);
    const crossfade = !!from && !originMatchesItem(context.origin, context.item);
    const picture = prepared
      ? prepared.picture
      : this.#originPicture(from, context.origin, crossfade);
    this.#activeOrigin = from;
    this.#activePicture = picture;
    if (!prepared && picture instanceof HTMLVideoElement) {
      this.#strip?.continueVideo(context.index, picture);
    }
    const keptThumbnail = context.origin?.thumbnail;
    if (crossfade) this.#keepThumbnailVisible(keptThumbnail);
    const start =
      prepared && !interruptedPose
        ? prepared.start
        : this.#openingStart(from, picture, interruptedPose, crossfade);
    const motion =
      prepared && !interruptedPose
        ? prepared.motion
        : this.#openingMotion(start, start.fromOrigin, interruptedPose, crossfade);
    const overlayFrom = interruptedPose ? this.#thumbnailOverlays.currentProgress(1) : 1;
    this.#thumbnailOverlays.prepare(
      context.item,
      context.index,
      this.#frame,
      "opening",
      overlayFrom,
    );
    const controlsReady = motion.backdrop.find((keyframe) => Number(keyframe.opacity) >= 0.85);
    const controlsRevealDelay = Number(controlsReady?.offset ?? 0.7) * motion.duration;
    const controlsReveal = this.#thumbnailOverlays.prepareControlsReveal(controlsRevealDelay);
    this.#applyMediaPose(this.#frame, this.#media, start);
    this.#frame.style.opacity = interruptedPose?.frameOpacity ?? start.frameOpacity;
    this.#portal.backdrop.style.opacity = interruptedPose?.backdropOpacity ?? "0";
    const animations = [
      ...(prepared && !interruptedPose ? prepared.animations : this.#openingAnimations(motion)),
      ...this.#thumbnailOverlays.animations(
        motion.frame,
        motion.progress,
        motion.duration,
        overlayFrom,
        0,
      ),
    ];
    if (this.#portal.dialog.hasAttribute("data-lightbox-gallery")) {
      this.#portal.dialog.style.setProperty(
        "--lightbox-gallery-controls-reveal-delay",
        `${controlsRevealDelay}ms`,
      );
      this.#portal.dialog.dataset.galleryControlsRevealing = "";
    }
    this.#portal.dialog.style.setProperty(
      "--lightbox-chrome-reveal-delay",
      `${controlsRevealDelay}ms`,
    );
    this.#portal.dialog.dataset.chromeRevealing = "";
    if (this.#portal.dialog.hasAttribute("data-filmstrip")) {
      this.#portal.dialog.style.setProperty(
        "--lightbox-filmstrip-reveal-delay",
        `${controlsRevealDelay}ms`,
      );
      this.#portal.dialog.dataset.filmstripRevealing = "";
    }
    this.#synchronizeStart(animations);
    delete this.#portal.overlay.dataset.lightboxPrepared;
    // Safari can paint a freshly shown image a frame late. The opening starts
    // exactly over the card, so the card stays painted underneath until the
    // overlay has been presented once.
    if (!crossfade) this.#releaseThumbnailAfterFirstFrame(keptThumbnail, context.signal);
    await this.#play(animations, context.signal, () =>
      this.#thumbnailOverlays.set("opening", 0, new DOMMatrix()),
    );
    if (context.signal.aborted) return;
    await Promise.all([
      this.#waitForFilmstripReveal(context.signal),
      this.#waitForGalleryControlsReveal(context.signal),
      this.#waitForChromeReveal(context.signal),
      this.#waitForAnimation(controlsReveal, context.signal),
    ]);
    if (context.signal.aborted) return;
    this.#setState("open");
    this.#strip?.completeOpening(context.index);
    // A gesture that interrupted the opening owns the overlays until it settles.
    if (!this.#dragGesture.active) this.#thumbnailOverlays.set("open", 0, new DOMMatrix());
    this.#thumbnailOverlays.finishControlsReveal();
    delete this.#portal.dialog.dataset.galleryControlsRevealing;
    this.#portal.dialog.style.removeProperty("--lightbox-gallery-controls-reveal-delay");
    delete this.#portal.dialog.dataset.filmstripRevealing;
    this.#portal.dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    delete this.#portal.dialog.dataset.chromeRevealing;
    this.#portal.dialog.style.removeProperty("--lightbox-chrome-reveal-delay");
    this.#focusUnlessInside();
  }

  async select(context: ViewerSessionMotionContext<TItem>) {
    this.#preparedFlight = undefined;
    this.#cancelAnimations(true);
    this.#zoom?.suspend();
    void this.#loadZoom();
    this.#takeInterruptedPose();
    const origin = context.origin?.visual;
    this.#activeOrigin = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    this.#activePicture = this.#originPicture(
      this.#activeOrigin,
      context.origin,
      !originMatchesItem(context.origin, context.item),
    );
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
    // The overlay is invisible while open. Moving it between slide frames
    // during native scrolling can invalidate the browser's painted snap.
    // Filmstrip movement is a direct preview scrub. The full-size image swaps
    // immediately while native scrolling continues under the user's finger.
    if (selected || context.reason === "filmstrip") return;
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
      this.#preparedFlight = undefined;
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#finishClose();
      return;
    }
    const origin = context.origin?.visual;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const closing = this.#strip?.activeItem;
    this.#closeCrossfade = !!from && !!closing && !originMatchesItem(context.origin, closing);
    const picture = this.#originPicture(from, context.origin, this.#closeCrossfade);
    if (picture instanceof HTMLVideoElement) this.#handBackVideo(picture);
    this.#keepThumbnailVisible(this.#closeCrossfade ? context.origin?.thumbnail : undefined);
    const start = interruptedPose ?? {
      ...readImageTransitionPose(this.#frame, this.#media),
      frameOpacity: "1",
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
    const originTarget = from
      ? originTransitionPose(from, picture, this.#frame, this.#media, start)
      : null;
    let target = originTarget ?? {
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
    // Moving an iframe or video into the body-level flight would reload it or
    // reset playback, so embedded media close inside their own frame instead.
    const embedded = media instanceof HTMLIFrameElement || media instanceof HTMLMediaElement;
    if (from && originTarget && !embedded) {
      const source = media;
      const prepared =
        source instanceof HTMLImageElement &&
        this.#preparedFlight?.source === source &&
        this.#preparedFlight.image.src === (source.currentSrc || source.src)
          ? this.#preparedFlight
          : undefined;
      this.#preparedFlight = undefined;
      const flight = this.#createCloseFlight(start, from, picture, media, prepared?.image);
      frame = flight.frame;
      media = flight.media;
      target = flight.target;
      if (media !== source) {
        const handedOff = await handoffDecodedFlightImage(
          source,
          media as HTMLImageElement,
          () => !context.signal.aborted,
          prepared?.ready.then(async (decoded) => {
            if (!decoded) await (media as HTMLImageElement).decode();
          }),
        );
        if (!handedOff) return this.#removeFlight();
        this.#flightSourceFrame?.setAttribute("data-lightbox-flight-source-hidden", "");
        this.#flight?.style.removeProperty("visibility");
      }
      this.#closeOriginObserver = new ResizeObserver(this.#scheduleCloseTargetUpdate);
      this.#closeOriginObserver.observe(from);
    } else {
      this.#preparedFlight = undefined;
    }
    this.#closeStart = start;
    this.#closeTargetOrigin = originTarget ? from : null;
    this.#closeTargetPicture = picture;
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
      fadeFrame: !originTarget,
      crossfade: this.#closeCrossfade,
    });
    const overlayFrom = this.#thumbnailOverlays.currentProgress(0);
    if (this.#strip) {
      this.#thumbnailOverlays.prepare(
        this.#strip.activeItem,
        this.#strip.index,
        frame,
        "closing",
        overlayFrom,
      );
    }
    this.#applyMediaPose(frame, media, start);
    // Embedded media lands on a static snapshot, so fade the snapshot back in.
    const cover = originTarget
      ? frame.querySelector<HTMLImageElement>(":scope > [data-lightbox-media-cover][src]")
      : null;
    const animations = [
      frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      media.animate(motion.image, this.#motionOptions(motion.duration)),
      frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
      ...this.#animateFallbacks(frame, motion.image, motion.duration),
      ...(cover
        ? [
            cover.animate([{ opacity: getComputedStyle(cover).opacity }, { opacity: 1 }], {
              duration: motion.duration * 0.6,
              easing: "ease-out",
              fill: "both",
            }),
          ]
        : []),
      ...this.#thumbnailOverlays.animations(
        motion.frame,
        motion.progress,
        motion.duration,
        overlayFrom,
        1,
      ),
    ];
    this.#synchronizeStart(animations);
    await this.#play(animations, context.signal, () =>
      this.#thumbnailOverlays.set("closing", 1, target.transform),
    );
    if (context.signal.aborted) return;
    this.#finishClose();
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#keepThumbnailVisible(undefined);
    this.#lifetime.abort();
    clearTimeout(this.#suppressClickTimer);
    this.#dragGesture.cancel();
    this.#preparedFlight = undefined;
    this.#endWheelHandoff();
    this.#zoom?.destroy();
    this.#mediaObserver?.disconnect();
    this.#mediaObserver = undefined;
    this.#observedMedia = undefined;
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
    this.#trackMedia();
  }

  // The active photo's drawn size, for consumer layers attached to it. Offset
  // sizes leave out flight, drag and zoom transforms; the photo is centred in
  // the stage, so its place follows from the stage insets.
  #trackMedia() {
    const media = this.#media;
    if (media !== this.#observedMedia) {
      const view = this.#portal.overlay.ownerDocument.defaultView;
      if (!view?.ResizeObserver) return;
      this.#mediaObserver ??= new view.ResizeObserver(this.#publishMedia);
      if (this.#observedMedia) this.#mediaObserver.unobserve(this.#observedMedia);
      this.#observedMedia = media;
      this.#mediaObserver.observe(media);
    }
    this.#publishMedia();
  }

  #publishMedia = () => {
    const media = this.#observedMedia;
    if (!media?.isConnected || !media.offsetWidth) return;
    this.#portal.dialog.style.setProperty("--lightbox-media-width", `${media.offsetWidth}px`);
    this.#portal.dialog.style.setProperty("--lightbox-media-height", `${media.offsetHeight}px`);
  };

  /**
   * The session hides the origin's image while its item is open. A crossfading
   * flight fades over the card, so the card's own image must stay painted.
   */
  #keepThumbnailVisible(thumbnail: HTMLElement | undefined) {
    if (this.#crossfadeThumbnail === thumbnail) return;
    if (this.#crossfadeThumbnail)
      delete this.#crossfadeThumbnail.dataset.lightboxThumbnailCrossfade;
    this.#crossfadeThumbnail = thumbnail;
    if (thumbnail) thumbnail.dataset.lightboxThumbnailCrossfade = "";
  }

  #releaseThumbnailAfterFirstFrame(thumbnail: HTMLElement | undefined, signal: AbortSignal) {
    if (!thumbnail) return;
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    view.requestAnimationFrame(() =>
      view.requestAnimationFrame(() => {
        if (!signal.aborted && this.#crossfadeThumbnail === thumbnail) {
          this.#keepThumbnailVisible(undefined);
        }
      }),
    );
  }

  /** The origin's image, when it shows the item being opened. */
  #matchingThumbnail(context: { item: TItem; origin?: LightboxOrigin | null }) {
    const thumbnail = context.origin?.thumbnail;
    return thumbnail && originShowsItem(thumbnail, context.item) ? thumbnail : undefined;
  }

  /** The card's own video picks up where the player is, so it lands on the same frame. */
  #handBackVideo(origin: HTMLVideoElement) {
    const player = this.#media;
    if (!(player instanceof HTMLVideoElement) || player.readyState < HTMLMediaElement.HAVE_METADATA)
      return;
    if (Math.abs(origin.currentTime - player.currentTime) > 0.01) {
      origin.currentTime = player.currentTime;
    }
    if (!player.paused && !player.ended) void origin.play().catch(() => undefined);
  }

  /** The element that paints the item in the origin, unless the flight crossfades over it. */
  #originPicture(
    from: HTMLElement | null,
    origin: LightboxOrigin | null | undefined,
    crossfade: boolean,
  ) {
    if (!from || crossfade) return null;
    const thumbnail = origin?.thumbnail;
    if (thumbnail && (thumbnail === from || from.contains(thumbnail))) return thumbnail;
    return originPicture(from);
  }

  #openingStart(
    from: HTMLElement | null,
    picture: HTMLElement | null,
    interrupted?: PaintedPose,
    crossfade = false,
  ): PaintedPose & { readonly fromOrigin: boolean } {
    if (interrupted) return { ...interrupted, fromOrigin: true };
    const openPose = openImageTransitionPose();
    const pose = from
      ? originTransitionPose(from, picture, this.#frame, this.#media, openPose)
      : null;
    if (pose) {
      return {
        ...pose,
        frameOpacity: crossfade ? "0" : "1",
        backdropOpacity: "0",
        fromOrigin: true,
      };
    }
    return {
      transform: new DOMMatrix()
        .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
        .scale(0.96),
      clip: openPose.clip,
      frameOpacity: "0",
      backdropOpacity: "0",
      fromOrigin: false,
    };
  }

  #openingMotion(
    start: PaintedPose,
    hasOrigin: boolean,
    interrupted?: PaintedPose,
    crossfade = false,
  ) {
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
      crossfade: crossfade && !interrupted,
    });
  }

  #openingAnimations(motion: ReturnType<typeof createImageTransitionMotion>) {
    return [
      this.#frame.animate(motion.frame, this.#motionOptions(motion.duration)),
      this.#media.animate(motion.image, this.#motionOptions(motion.duration)),
      this.#frame.animate(motion.radius, this.#motionOptions(motion.duration)),
      this.#portal.backdrop.animate(motion.backdrop, this.#motionOptions(motion.duration)),
      ...this.#animateFallbacks(this.#frame, motion.image, motion.duration),
    ];
  }

  #fallbackLayers(frame: HTMLElement) {
    // Every layer that stands in for the media moves with it, so the frame's
    // crop is the only crop. An embed's snapshot would otherwise be cropped
    // to the frame and then again by its own cover fit.
    return frame.querySelectorAll<HTMLElement>(
      ":scope > :is([data-lightbox-slide-placeholder], [data-lightbox-slide-preview], [data-lightbox-media-cover], [data-lightbox-video-stand-in])",
    );
  }

  #applyMediaPose(
    frame: HTMLElement,
    media: HTMLElement,
    pose: ImageTransitionPose,
    size?: { readonly width: number; readonly height: number },
  ) {
    const crop = applyImageTransitionPose(frame, media, pose, size);
    for (const layer of this.#fallbackLayers(frame)) {
      layer.style.transform = crop.image.toString();
    }
  }

  #animateFallbacks(frame: HTMLElement, keyframes: Keyframe[], duration: number) {
    return Array.from(this.#fallbackLayers(frame), (layer) =>
      layer.animate(keyframes, this.#motionOptions(duration)),
    );
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
    await this.#waitForAnimation(animation, signal);
  }

  async #waitForGalleryControlsReveal(signal: AbortSignal) {
    const control = this.#portal.dialog.querySelector<HTMLElement>(
      "[data-lightbox-previous], [data-lightbox-next], [data-lightbox-close]",
    );
    const animation = control
      ?.getAnimations()
      .find(
        (candidate) =>
          (candidate as CSSAnimation).animationName === "lightbox-gallery-controls-appear",
      );
    await this.#waitForAnimation(animation, signal);
  }

  async #waitForChromeReveal(signal: AbortSignal) {
    const chrome = this.#portal.dialog.querySelector<HTMLElement>("[data-lightbox-chrome]");
    const animation = chrome
      ?.getAnimations()
      .find(
        (candidate) =>
          (candidate as CSSAnimation).animationName === "lightbox-gallery-controls-appear",
      );
    await this.#waitForAnimation(animation, signal);
  }

  async #waitForAnimation(animation: Animation | undefined, signal: AbortSignal) {
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

  async #play(animations: Animation[], signal: AbortSignal, settle?: () => void) {
    this.#animations = animations;
    const cancel = () => this.#cancelAnimations(true);
    signal.addEventListener("abort", cancel, { once: true });
    await Promise.allSettled(animations.map((animation) => animation.finished));
    signal.removeEventListener("abort", cancel);
    if (this.#animations !== animations) return;
    this.#animations = [];
    // Filled animations otherwise reveal their preflight inline progress and
    // transform for a frame when canceled, before the caller updates state.
    settle?.();
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
    // Start every animation now, on the real clock. The timeline's own time is
    // the last frame's timestamp, and Firefox stops advancing it while nothing
    // animates, so after an idle moment it would start the motion in the past
    // and finish it on its first frame. Assigning the start right away (rather
    // than waiting for `ready`) keeps Safari from repainting time zero.
    const view = this.#portal.overlay.ownerDocument.defaultView;
    const timelineTime = view
      ? view.performance.now()
      : Number(this.#portal.overlay.ownerDocument.timeline.currentTime ?? 0);
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
        this.#applyMediaPose(this.#frame, this.#media, pose);
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
    for (const layer of this.#fallbackLayers(this.#frame)) {
      layer.style.removeProperty("transform");
    }
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
    // A pinch can land mid-dismiss; drop the drag whole, or the strip stays
    // frozen and the dialog keeps its dragging state.
    if (this.#dragGesture.active) {
      this.#dragGesture.cancel();
      this.#preparedFlight = undefined;
      this.#clearMotionStyles();
      this.#strip?.resume();
    }
    this.#cancelAnimations(true);
    const interrupted = this.#takeInterruptedPose();
    if (interrupted) this.#applyMediaPose(this.#frame, this.#media, interrupted);
    return { image: this.#media, frame: this.#frame };
  }

  #createCloseFlight(
    start: ImageTransitionPose,
    origin: HTMLElement,
    picture: HTMLElement | null,
    source: HTMLElement,
    prepared?: HTMLImageElement,
  ) {
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
      prepared ??
      (source instanceof HTMLImageElement ? (source.cloneNode(true) as HTMLImageElement) : source);
    if (media !== source) {
      media.removeAttribute("style");
      flight.style.visibility = "hidden";
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
    this.#flightSourceFrame =
      media !== source
        ? (source.closest<HTMLElement>("[data-lightbox-frame]") ?? this.#frame)
        : undefined;
    applyImageTransitionPose(frame, media, start);
    const target = this.#flightTargetPose(origin, picture, media) ?? start;
    return { frame, media, target };
  }

  #flightTargetPose(
    origin: HTMLElement,
    picture: HTMLElement | null,
    media: HTMLElement,
  ): ImageTransitionPose | null {
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    // The flight lives in document coordinates, so the pose is relative to its
    // origin wherever the page has scrolled to now.
    return originPose({
      origin,
      picture,
      width: media.offsetWidth,
      height: media.offsetHeight,
      left: this.#flightOrigin.x - view.scrollX,
      top: this.#flightOrigin.y - view.scrollY,
    });
  }

  #removeFlight() {
    if (this.#flightSource) delete this.#flightSource.dataset.lightboxFlightSourceHidden;
    if (this.#flightSourceFrame) delete this.#flightSourceFrame.dataset.lightboxFlightSourceHidden;
    if (this.#flightMarker?.parentNode && this.#flightSource) {
      this.#flightMarker.replaceWith(this.#flightSource);
    }
    this.#flightMarker = undefined;
    this.#flight?.remove();
    this.#flight = undefined;
    this.#flightFrame = undefined;
    this.#flightMedia = undefined;
    this.#flightSource = undefined;
    this.#flightSourceFrame = undefined;
    this.#closeStart = undefined;
    this.#closeTargetOrigin = null;
    this.#closeTargetPicture = null;
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
    this.#syncPageHeight();
    this.#pinContainer(view);
    const widthChanged = view.innerWidth !== this.#viewportWidth;
    if (this.#controller?.state.status === "closing") {
      if (widthChanged) {
        this.#viewportWidth = view.innerWidth;
        this.#sizeContainer(view);
      }
      this.#updateCloseTarget();
      this.#scheduleCloseTargetUpdate();
      return;
    }
    if (!widthChanged) return;
    if (this.#dragGesture.active) this.#endDrag(true);
    this.#viewportWidth = view.innerWidth;
    this.#sizeContainer(view);
    if (this.#zoom?.zoomed) {
      this.#zoom.reset();
      return;
    }
    if (this.#controller?.state.status === "opening") {
      this.#cancelAnimations(false);
      this.#clearMotionStyles();
    }
  };

  // The container is absolute at the page's scroll position, not sticky: iOS 26
  // Safari takes a sticky layer touching the screen's edge for chrome and tints
  // its bar with a colour from anywhere inside it. React Aria's Sheet does the
  // same for the same reason.
  #sizeContainer(view: Window) {
    this.#portal.overlay.style.setProperty("--lightbox-height", `${view.innerHeight}px`);
    this.#pinContainer(view);
  }

  #pinContainer(view: Window) {
    this.#portal.overlay.style.setProperty("--lightbox-scroll-top", `${view.scrollY}px`);
  }

  // The page can still scroll under an open lightbox; follow it as sticky did.
  #onPageScroll = () => {
    const view = this.#portal.overlay.ownerDocument.defaultView;
    if (!view || this.#controller?.state.status === "closed") return;
    this.#pinContainer(view);
  };

  #syncPageHeight() {
    const ownerDocument = this.#portal.overlay.ownerDocument;
    const view = ownerDocument.defaultView;
    const height = Math.max(
      ownerDocument.documentElement.scrollHeight,
      ownerDocument.body.scrollHeight,
      view?.innerHeight ?? 0,
    );
    this.#portal.overlay.style.setProperty("--lightbox-page-height", `${height}px`);
  }

  #updateCloseTarget() {
    const origin = this.#closeTargetOrigin;
    const start = this.#closeStart;
    const frame = this.#flightFrame;
    const media = this.#flightMedia;
    if (!origin || !start || !frame || !media || this.#animations.length < 3) return;
    const target = this.#flightTargetPose(origin, this.#closeTargetPicture, media);
    if (!target) return;
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
      crossfade: this.#closeCrossfade,
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

  /** Gestures take over an opening in flight as well as a settled viewer. */
  #acceptsGestures() {
    const status = this.#controller?.state.status;
    return status === "open" || status === "opening";
  }

  #beginDrag(wheelDirection = 0) {
    if (this.#dragGesture.active || !this.#acceptsGestures()) return;
    this.#zoom?.suspend();
    this.#cancelAnimations(true);
    const frame = this.#frame;
    if (this.#strip) {
      this.#thumbnailOverlays.prepare(
        this.#strip.activeItem,
        this.#strip.index,
        frame,
        "dragging",
        0,
      );
    }
    const current = readImageTransitionPose(frame, this.#media);
    const matrix = current.transform;
    this.#strip?.freeze();
    this.#preparedFlight = undefined;
    const origin = this.#activeOrigin;
    const from = origin && origin.isConnected && originIsVisible(origin) ? origin : null;
    const target = (from
      ? originTransitionPose(from, this.#activePicture, frame, this.#media, current)
      : null) ?? {
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
      clip: current.clip,
      targetClip: target.clip,
      width: this.#media.offsetWidth,
      height: this.#media.offsetHeight,
      time: performance.now(),
    });
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.dataset.dragging = "";
      target.dataset.dismissing = "";
    }
    this.#paintDrag(state);
    if (from && this.#media instanceof HTMLImageElement) {
      this.#prepareCloseFlight(this.#media);
    }
  }

  #prepareCloseFlight(source: HTMLImageElement) {
    const url = source.currentSrc || source.src;
    if (!url) return;
    const image = source.cloneNode(true) as HTMLImageElement;
    // Keep the selected resource when the clone leaves its picture or sizes context.
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.src = url;
    this.#preparedFlight = {
      source,
      image,
      ready: image.decode().then(
        () => true,
        () => false,
      ),
    };
  }

  #paintDrag(state: LightboxDragState) {
    const distance = dragDistance(state);
    const progress = dragProgress(state);
    this.#portal.overlay.style.setProperty("--lightbox-drag-x", `${state.x}px`);
    this.#portal.overlay.style.setProperty("--lightbox-drag-y", `${state.y}px`);
    this.#portal.overlay.style.setProperty("--lightbox-dismiss-progress", String(progress));
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
    this.#applyMediaPose(
      this.#frame,
      this.#media,
      {
        transform: matrix,
        clip: {
          ...mixInsets(
            state.clip,
            state.targetClip,
            (start, end) => start + (end - start) * progress,
          ),
          radii: mapRadii(
            state.borderRadii,
            (radius, index) => radius + (state.targetRadii[index]! - radius) * radiusProgress,
          ),
        },
      },
      state,
    );
    this.#thumbnailOverlays.set("dragging", progress, matrix);
    this.#portal.backdrop.style.opacity = String(state.opacity * backdropVisibility(progress));
    if (
      state.wheelTarget &&
      state.wheelPhase !== "tracking" &&
      Math.abs(dragDistance(state)) < 0.1
    ) {
      this.#dragGesture.finish();
      this.#preparedFlight = undefined;
      this.#clearMotionStyles();
      this.#strip?.resume();
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
    this.#preparedFlight = undefined;
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
      ...this.#animateFallbacks(this.#frame, motion.image, duration),
      ...this.#thumbnailOverlays.animations(
        motion.frame,
        motion.progress,
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
    this.#keepThumbnailVisible(undefined);
    this.#strip?.resume();
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
      delete this.#portal.dialog.dataset.galleryControlsRevealing;
      this.#portal.dialog.style.removeProperty("--lightbox-gallery-controls-reveal-delay");
      delete this.#portal.dialog.dataset.filmstripRevealing;
      this.#portal.dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
      delete this.#portal.dialog.dataset.chromeRevealing;
      this.#portal.dialog.style.removeProperty("--lightbox-chrome-reveal-delay");
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
    } else if (
      event.key === "ArrowRight" &&
      ["opening", "open"].includes(this.#controller?.state.status ?? "closed")
    ) {
      event.preventDefault();
      this.#zoom?.suspend();
      void this.#controller?.next({ reason: "keyboard" });
    } else if (
      event.key === "ArrowLeft" &&
      ["opening", "open"].includes(this.#controller?.state.status ?? "closed")
    ) {
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

  /** Move focus into a settled dialog, unless someone already put it there. */
  #focusUnlessInside() {
    const focused = this.#portal.dialog.ownerDocument.activeElement;
    if (!focused || !this.#portal.dialog.contains(focused)) this.#focus();
  }

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
      !this.#acceptsGestures() ||
      this.#zoom?.zoomed ||
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
    if (this.#zoom?.zoomed) {
      this.#pointer = undefined;
      return;
    }
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
      this.#zoom?.zoomed ||
      !this.#acceptsGestures() ||
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
