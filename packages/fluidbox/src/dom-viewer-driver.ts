import { controlSelector, drawViewerLayer } from "./viewer-layer";
import { idOf, itemLabel } from "./items";
import { FluidboxMediaErrorEvent, type FluidboxOptions } from "./public-api";
import { chromeReach } from "./chrome-reach";
import { visibleOrigin } from "./origin-geometry";
import { originMatchesItem, originShowsItem } from "./origin-match";
import {
  backdropVisibility,
  boundDismissVelocity,
  dragDistance,
  dragProgress,
  dismissRadiusProgress,
  FluidboxGestureController,
  touchAxisThreshold,
  type FluidboxDragState,
} from "./fluidbox-gesture";
import {
  applyImageTransitionPose,
  createImageTransitionMotion,
  openImageTransitionPose,
  originTransitionPose,
  readImageTransitionPose,
  type ImageTransitionMotion,
  type ImageTransitionPose,
} from "./image-transition-motion";
import type {
  SessionController,
  FluidboxDispose,
  FluidboxExtension,
  FluidboxExtensionInstance,
  FluidboxItem,
  FluidboxItemId,
  FluidboxOrigin,
  FluidboxViewerLayer,
  FluidboxSlideRenderer,
  FluidboxSlides,
  FluidboxSource,
  FluidboxThumbnailOverlayRegistration,
  FluidboxZoomOptions,
} from "./runtime-types";
import type { FluidboxZoom, ZoomReason } from "./fluidbox-zoom";
import type {
  ViewerSessionCloseContext,
  ViewerSessionDriver,
  ViewerGestures,
  ViewerSessionMotionContext,
} from "./runtime-types";
import {
  createViewerPortal,
  mountViewerPortal,
  raiseWithViewer,
  ViewerModalIsolation,
  type ViewerPortalElements,
} from "./viewer-portal";
import type { FluidboxLabels } from "./labels";
import { ViewerStrip } from "./viewer-strip";
import type * as ViewerActions from "./viewer-actions";
import { canGoFullscreen, crossOrigin, downloadName, fileOf } from "./item-file";
import { activeViewer } from "./viewer-ownership";
import { mapRadii, mixInsets, type ImageClip } from "./transition-geometry";
import { fillContent, originPose, originPicture } from "./origin-pose";
import type { ThumbnailOverlayRuntime } from "./thumbnail-overlay-runtime";
import { publishOverlayPhase, resetOverlayPhase } from "./overlay-phase";

/** The controls whose actions load on demand. */
const ACTION_CONTROLS = "[data-fluidbox-fullscreen],[data-fluidbox-download],[data-fluidbox-share]";
/** The longest an open waits for its slide to be ready, as the instant open waits for its image. */
const SLIDE_READY_CAP = 3000;
const OPEN_DURATION = 300;
const TOUCH_DISMISS_DISTANCE = 60;
const OPENING_SPRING_RESPONSE = 210;
const TOUCH_OPENING_SPRING_RESPONSE = 380;
const DISMISS_RADIUS_END = 0.1;
const WHEEL_HANDOFF_QUIET_GAP = 120;
const WHEEL_HANDOFF_ACCELERATION = 1.25;
const WHEEL_HANDOFF_MIN_DELTA = 4;
const WHEEL_HANDOFF_TIMEOUT = 1200;
/** Content whose keys are its own: widgets that move with arrow keys, and content that owns its input. */
const KEY_OWNERS =
  "[data-fluidbox-owns-input], [role=radiogroup], [role=slider], [role=tablist], [role=listbox], [role=menu], [role=menubar], [role=grid], [role=treegrid], [role=tree], [role=toolbar], [role=combobox], [role=spinbutton]";
/** The control that takes focus from one that disables itself at an end. */
const PARTNERS = {
  "[data-fluidbox-previous]": "[data-fluidbox-next]",
  "[data-fluidbox-next]": "[data-fluidbox-previous]",
  "[data-fluidbox-zoom-in]": "[data-fluidbox-zoom-out]",
  "[data-fluidbox-zoom-out]": "[data-fluidbox-zoom-in]",
  "[data-fluidbox-zoom-reset]": "[data-fluidbox-zoom-in]",
};
/** Fields whose keys are typing. */
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable=false])";
/**
 * Content that handles Escape itself: a dialog or popover inside the viewer,
 * an open menu or combobox.
 */
const ESCAPE_OWNERS =
  "dialog[open], [popover], [role=menu], [role=menubar], [role=combobox][aria-expanded=true]";
const FOCUSABLE_HOST_SELECTOR =
  "[tabindex], a[href], button, input, select, textarea, summary, video[controls], audio[controls], iframe";

function focusableHostFor(element: HTMLElement | null) {
  return element?.parentElement?.closest<HTMLElement>(FOCUSABLE_HOST_SELECTOR) ?? null;
}

let descriptions = 0;

interface PaintedPose extends ImageTransitionPose {
  readonly frameOpacity: string;
  readonly backdropOpacity: string;
}

interface PreparedOpen<TItem extends FluidboxItem> {
  readonly token: object;
  readonly item: TItem;
  readonly index: number;
  readonly origin: HTMLElement | null;
  readonly picture: HTMLElement | null;
  readonly animations: Animation[];
  readonly start: PaintedPose & { readonly fromOrigin: boolean };
  readonly motion: ImageTransitionMotion;
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

/** A wheel gesture in `"navigate"` mode ends after this long without wheel input. */
const NAVIGATE_WHEEL_GAP = 150;

/** How far a drag that may not close moves the media: a short way, slowing as it goes. */
const rubberBand = (distance: number) =>
  Math.sign(distance) * 48 * (1 - Math.exp(-Math.abs(distance) / 160));

/** The trigger's live `<model-viewer>`, which a model slide syncs its camera with. */
function originModel(origin: FluidboxOrigin | null | undefined) {
  const visual = origin?.visual;
  if (!visual) return null;
  const model =
    visual.localName === "model-viewer"
      ? visual
      : visual.querySelector<HTMLElement>("model-viewer");
  return model?.isConnected ? model : null;
}

/** Plain DOM image driver. It has no dependency on custom elements or a framework. */
/** Zoom options with their defaults, or undefined when zoom is off. */
function zoomConfig(
  options: false | FluidboxZoomOptions | undefined,
): Required<FluidboxZoomOptions> | undefined {
  if (options === false) return undefined;
  const max = options?.max ?? 4;
  const step = options?.step ?? 2;
  if (!Number.isFinite(max) || max <= 1 || !Number.isFinite(step) || step <= 1 || step > max) {
    throw new RangeError("Fluidbox zoom step must be greater than 1 and no greater than max.");
  }
  return { max, step, click: options?.click ?? "single", tap: options?.tap ?? "double" };
}

export class DomViewerDriver<
  TItem extends FluidboxItem = FluidboxItem,
> implements ViewerSessionDriver<TItem> {
  readonly #portal: ViewerPortalElements;
  readonly #isolation: ViewerModalIsolation;
  /** Loaded with the first overlay, so a viewer without overlays never loads it. */
  #thumbnailOverlays: ThumbnailOverlayRuntime<TItem> | undefined;
  #overlaysLoad: Promise<unknown> | undefined;
  readonly #slides: FluidboxSlides<TItem>;
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
  #controller: SessionController<TItem> | undefined;
  #strip: ViewerStrip<TItem> | undefined;
  #loop = false;
  #portalDispose: FluidboxDispose | undefined;
  #source: FluidboxSource<TItem> | undefined;
  #extensions: FluidboxExtensionInstance<TItem>[] = [];
  /** Aborted when the mounted extensions are replaced. */
  #extensionLifetime: AbortController | undefined;
  /** The extension that took the current vertical touch drag, if one did. */
  #dragExtension: FluidboxExtensionInstance<TItem> | undefined;
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
  #crossfadeThumbnail: HTMLElement | undefined;
  #flightMarker: Comment | undefined;
  #preparedFlight:
    | { source: HTMLImageElement; image: HTMLImageElement; ready: Promise<boolean> }
    | undefined;
  #flightOrigin = { x: 0, y: 0, width: 0, height: 0 };
  #flightViewerOrigin = { x: 0, y: 0 };
  /** Aims the closing flight at where its origin is now. */
  #retargetClose: (() => void) | undefined;
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
  readonly #dragGesture = new FluidboxGestureController(
    (state) => this.#paintDrag(state),
    () => this.#commitWheelDismiss(),
  );
  #zoomOptions: Required<FluidboxZoomOptions> | undefined;
  #zoom: FluidboxZoom | undefined;
  /** The zoom command under way, until it settles. */
  #zoomCommand: { readonly scale: number } | undefined;
  #zoomLoad: Promise<FluidboxZoom | undefined> | undefined;
  #returnFocus: HTMLElement | null = null;
  #returnFocusFallback: HTMLElement | null = null;
  #viewportWidth = 0;
  #preparedOpen: PreparedOpen<TItem> | undefined;
  readonly #themeProperties = new Set<string>();
  #forceImmediateClose = false;
  #destroyed = false;
  #announcement: ReturnType<typeof setTimeout> | undefined;
  /** The element last focused in the dialog. */
  #lastFocus: HTMLElement | null = null;
  /** Counts opens, closes and the destroy, so an open that was called off knows whether one came after it. */
  #operation = 0;

  readonly #labels: FluidboxLabels;
  #gestures: ViewerGestures = {
    dismiss: { drag: true, backdrop: true },
    wheel: "dismiss",
  };
  /** When the last wheel event of a `"navigate"` gesture came. */
  #lastNavigateWheel = -Infinity;
  /** Fullscreen, download and share, once a press or a control for one has loaded them. */
  #actions: typeof ViewerActions | undefined;
  /** A cross-origin download's fetch, which a move or a close aborts. */
  #fileFetch: AbortController | undefined;
  #copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    ownerDocument: Document,
    zoomOptions: false | FluidboxZoomOptions | undefined,
    slides: FluidboxSlides<TItem> | undefined,
    labels: FluidboxLabels,
  ) {
    this.#labels = labels;
    this.#portal = createViewerPortal(ownerDocument, labels.viewer);
    this.#isolation = new ViewerModalIsolation(this.#portal.overlay);
    this.#slides = slides ?? {};
    this.#portal.dialog.dataset.fluidboxHeadless = "";
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
        if (!this.#gestures.dismiss.backdrop) return;
        if (
          event.target === this.#portal.dialog ||
          event.target === this.#portal.backdrop ||
          event.target === this.#portal.container ||
          (event.target instanceof Element &&
            !!event.target.closest("[data-fluidbox-slide]") &&
            !event.target.closest("[data-fluidbox-frame]"))
        ) {
          void this.#controller?.close({ reason: "pointer" });
        }
      },
      { signal: this.#lifetime.signal },
    );
    // Ahead of every other listener, the zoom's included: each input a person makes.
    for (const type of ["pointerdown", "touchstart", "wheel"] as const) {
      this.#portal.container.addEventListener(type, () => this.#userInteraction(), {
        capture: true,
        passive: true,
        signal: this.#lifetime.signal,
      });
    }
    for (const [type, listener, passive] of [
      ["pointerdown", this.#onPointerDown, true],
      ["pointermove", this.#onPointerMove, false],
      ["pointerup", this.#onPointerEnd, true],
      ["pointercancel", this.#onPointerEnd, true],
      ["wheel", this.#onWheel, false],
    ] as const) {
      this.#portal.container.addEventListener(type, listener as EventListener, {
        passive,
        signal: this.#lifetime.signal,
      });
    }
    for (const type of ["fullscreenchange", "webkitfullscreenchange"]) {
      ownerDocument.addEventListener(type, this.#onFullscreenChange, {
        signal: this.#lifetime.signal,
      });
    }
    // In the bubble phase, so content inside the viewer sees its keys first.
    ownerDocument.addEventListener("keydown", this.#onKeydown, { signal: this.#lifetime.signal });
    ownerDocument.addEventListener("focusin", this.#onFocus, {
      capture: true,
      signal: this.#lifetime.signal,
    });
    this.#portal.dialog.addEventListener(
      "focusin",
      (event) => (this.#lastFocus = event.target instanceof HTMLElement ? event.target : null),
      { signal: this.#lifetime.signal },
    );
    const changes = new MutationObserver(this.#onDialogChange);
    changes.observe(this.#portal.dialog, {
      subtree: true,
      childList: true,
      attributeFilter: ["disabled", "inert", "data-fluidbox-description"],
    });
    this.#lifetime.signal.addEventListener("abort", () => changes.disconnect());
    const ownerWindow = ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", this.#onResize, { signal: this.#lifetime.signal });
    ownerWindow?.addEventListener("scroll", this.#onPageScroll, {
      passive: true,
      signal: this.#lifetime.signal,
    });
    ownerWindow?.visualViewport?.addEventListener("resize", this.#onResize, {
      signal: this.#lifetime.signal,
    });
    this.#zoomOptions = zoomConfig(zoomOptions);
    this.#portal.dialog.toggleAttribute("data-zoomable", !!this.#zoomOptions);
    this.#markZoomClick();
  }

  /** What may close the viewer, and what a vertical wheel does, with their defaults. */
  setGestures({ dismiss, wheel }: Pick<FluidboxOptions, "dismiss" | "wheel">) {
    this.#gestures = {
      dismiss: { drag: dismiss?.drag ?? true, backdrop: dismiss?.backdrop ?? true },
      wheel: wheel ?? "dismiss",
    };
  }

  /** The document's fullscreen element, by the WebKit name too, as older iPad Safari has it. */
  #fullscreenElement() {
    const ownerDocument = this.#portal.overlay.ownerDocument as Document & {
      webkitFullscreenElement?: Element | null;
    };
    return ownerDocument.fullscreenElement ?? ownerDocument.webkitFullscreenElement ?? null;
  }

  #isFullscreen() {
    return this.#fullscreenElement() === this.#portal.overlay;
  }

  #loadActions() {
    return import("./viewer-actions").then((actions) => (this.#actions = actions));
  }

  /** Load the actions once the viewer holds a control for one, so its press finds them ready. */
  #preloadActions() {
    if (!this.#actions && this.#portal.dialog.querySelector(ACTION_CONTROLS)) {
      void this.#loadActions();
    }
  }

  /**
   * Make the viewer fill the screen, or stop. Resolves whether the viewer is as
   * asked. Loaded, the actions run in the press itself, as fullscreen needs.
   */
  async setFullscreen(on: boolean): Promise<boolean> {
    if (on === this.#isFullscreen()) return true;
    const actions = this.#actions ?? (await this.#loadActions());
    if (!on) {
      await actions.exitFullscreen(this.#portal.overlay);
      return !this.#isFullscreen();
    }
    return (
      canGoFullscreen() &&
      this.#controller?.state.status === "open" &&
      actions.enterFullscreen(this.#portal.overlay)
    );
  }

  #onFullscreenChange = () => {
    const on = this.#isFullscreen();
    if (!on) this.#actions?.raiseAgain(this.#portal.overlay);
    this.#portal.overlay.toggleAttribute("data-fullscreen", on);
    this.#controller?.fullscreenChanged?.(on);
  };

  /** The controls marked `name` in the viewer, default or your own. */
  #controlsNamed(name: string) {
    return this.#portal.dialog.querySelectorAll<HTMLElement>(`[data-fluidbox-${name}]`);
  }

  /** Load the slide on show again if it failed. False when it hadn't. */
  retry() {
    return this.#strip?.retry() ?? false;
  }

  /** Save the item's file; a move or a close stops a fetch under way. */
  async download(item: TItem) {
    this.#fileFetch?.abort();
    const fetching = (this.#fileFetch = new AbortController());
    const file = fileOf(item);
    if (!file) return false;
    const href = new URL(file.src, location.href).href;
    const { saveFile } = this.#actions ?? (await this.#loadActions());
    if (fetching.signal.aborted) return false;
    const { ownerDocument } = this.#portal.overlay;
    const name = downloadName(item, file);
    return saveFile(ownerDocument, href, name, crossOrigin(href), fetching.signal, (busy) => {
      for (const control of this.#controlsNamed("download")) {
        if (busy) control.setAttribute("aria-busy", "true");
        else control.removeAttribute("aria-busy");
      }
    });
  }

  /** Share a link to the item, or copy it and say so. */
  async share(item: TItem, url: string) {
    const { shareLink } = this.#actions ?? (await this.#loadActions());
    return shareLink(itemLabel(item), url, () => {
      this.#announce(this.#labels.linkCopied);
      const controls = this.#controlsNamed("share");
      for (const control of controls) control.toggleAttribute("data-copied", true);
      clearTimeout(this.#copiedTimer);
      this.#copiedTimer = setTimeout(() => {
        for (const control of controls) control.removeAttribute("data-copied");
      }, 2000);
    });
  }

  /** Go round the gallery, or stop at its ends. */
  setLoop(loop: boolean) {
    if (loop === this.#loop) return;
    this.#loop = loop;
    this.#strip?.setLoop(loop);
  }

  setZoom(options: false | FluidboxZoomOptions | undefined) {
    const next = zoomConfig(options);
    const current = this.#zoomOptions;
    if (
      next?.max === current?.max &&
      next?.step === current?.step &&
      next?.click === current?.click &&
      next?.tap === current?.tap
    )
      return;
    this.#zoomOptions = next;
    this.#portal.dialog.toggleAttribute("data-zoomable", !!next);
    this.#markZoomClick();
    if (next) return;
    this.#zoom?.reset("api");
    this.#zoom?.destroy();
    this.#zoom = undefined;
    this.#zoomLoad = undefined;
  }

  /** Say on the viewer what a click on the media does, for the cursor. */
  #markZoomClick() {
    this.#portal.overlay.dataset.fluidboxZoomClick = this.#zoomOptions?.click || "off";
  }

  /** Show the labels again after they changed in place. */
  relabel() {
    this.#strip?.relabel();
    for (const extension of this.#extensions) extension.relabel?.();
    const controller = this.#controller;
    const index = controller?.state.index ?? null;
    if (index !== null && this.#source && index < this.#source.count) {
      this.#render(this.#source.getItem(index), index, false);
    } else {
      this.#portal.dialog.setAttribute("aria-label", this.#labels.viewer);
    }
  }

  /** Draw the portal layer again, as after its controls or content changed. */
  setPortal(layer: FluidboxViewerLayer | undefined) {
    this.#portalDispose?.();
    this.#portalDispose = layer
      ? drawViewerLayer(layer, this.#portal.portalTarget, this.#lifetime.signal)
      : undefined;
  }

  /** Replace the extensions, as when the thumbnails or the sheet is turned on, off or changed. */
  setExtensions(extensions: readonly (FluidboxExtension<TItem> | undefined)[]) {
    this.#extensionLifetime?.abort();
    for (const extension of this.#extensions) extension.destroy();
    this.#extensions = [];
    this.#dragExtension = undefined;
    const controller = this.#controller;
    if (!controller || !this.#source) return;
    // Destroying the viewer aborts this too.
    this.#extensionLifetime = new AbortController();
    const { signal } = this.#extensionLifetime;
    for (const extension of extensions) {
      if (!extension) continue;
      this.#extensions.push(
        extension.mount({
          dialog: this.#portal.dialog,
          layer: this.#portal.addons,
          controller,
          source: this.#source,
          labels: this.#labels,
          gestures: this.#gestures,
          signal,
        }),
      );
    }
    // A viewer that is showing gives the new extensions their place now.
    if (this.#portal.overlay.isConnected) {
      for (const extension of this.#extensions) extension.attach?.();
    }
  }

  async #loadZoom() {
    if (!this.#zoomOptions || this.#destroyed) return undefined;
    if (this.#zoom) return this.#zoom;
    this.#zoomLoad ??= import("./fluidbox-zoom").then(({ FluidboxZoom }) => {
      if (this.#destroyed || !this.#zoomOptions) return undefined;
      const labels = this.#labels;
      return (this.#zoom = new FluidboxZoom(this.#portal.container, {
        prepare: () => this.#prepareZoom(),
        // Read on every gesture, so a change of options applies to the next one.
        config: () => {
          const options = this.#zoomOptions ?? { max: 1, step: 1, click: false, tap: false };
          // A box of your own can zoom further, or less far, than the rest.
          const max = this.#strip?.zoomable()?.max;
          return max ? { ...options, max } : options;
        },
        get label() {
          return labels.zoomed;
        },
        state: (locked) => {
          const dialog = this.#portal.dialog;
          const wasZoomed = dialog.hasAttribute("data-zoomed");
          if (locked && !wasZoomed) {
            dialog.style.setProperty(
              "--fluidbox-zoom-scroll-offset",
              `${this.#strip?.element.scrollLeft ?? 0}px`,
            );
          }
          dialog.toggleAttribute("data-zoomed", locked);
          if (!locked) {
            dialog.style.removeProperty("--fluidbox-zoom-scroll-offset");
            if (wasZoomed && this.#strip) void this.#strip.select(this.#strip.index, false);
          }
        },
        settled: (scale, reason) => {
          // The slide's image gets sharper as the zoom shows more of its pixels.
          if (this.#strip?.shows(this.#strip.index)) this.#strip.sharpen(scale);
          this.#controller?.zoomed?.(scale, reason);
          // The open viewer says how far it is zoomed, through its live status.
          if (this.#controller?.state.status === "open") {
            this.#announce(labels.zoomLevel(scale));
          }
        },
        reducedMotion: () => this.#prefersReducedMotion(),
        duration: (ms) => this.#duration(ms),
        watched: () => this.#strip?.watchesZoom() ?? false,
        pose: (image, pose) => this.#strip?.zoomPose(image, pose),
        interact: () => this.#userInteraction(),
        wheelZooms: () => this.#gestures.wheel === "zoom",
      }));
    });
    return this.#zoomLoad;
  }

  /**
   * Every duration and spring response the viewer plays, in milliseconds, as
   * its motion plays it. One place, so a motion speed changes them all.
   */
  #duration(ms: number) {
    return ms;
  }

  /** Listeners for a person's input to the open viewer. */
  readonly #interactions = new Set<() => void>();

  /** Follow every gesture, key and zoom a person makes in the viewer. Returns a function that stops. */
  onUserInteraction(listener: () => void) {
    this.#interactions.add(listener);
    return () => void this.#interactions.delete(listener);
  }

  /** A person's input: a pointer, a touch, a wheel, a key or a zoom. Every one passes here. */
  #userInteraction() {
    for (const listener of this.#interactions) listener();
  }

  /**
   * Whether the box of the item at `index` zooms, with its own largest scale if
   * it has one: null when it doesn't, undefined when the strip isn't on it.
   */
  zoomable(index: number): { readonly max?: number } | null | undefined {
    // Until the strip is on the item, the item's type answers, as an image zooms.
    return this.#strip?.index === index ? this.#strip.zoomable() : undefined;
  }

  /**
   * The scale a zoom under way is heading to, whether a command, a key or a
   * click started it; undefined while none is.
   */
  zoomGoal(): number | undefined {
    return this.#zoomCommand?.scale ?? this.#zoom?.goal;
  }

  /**
   * Zoom the image on show to `scale` about `origin`. Resolves true once it
   * rests there, false when nothing can zoom or the motion was interrupted.
   */
  zoomTo(
    scale: number,
    options: {
      readonly origin?: { readonly x: number; readonly y: number };
      readonly signal?: AbortSignal;
      readonly reason?: ZoomReason;
    },
  ): Promise<boolean> {
    // Its scale is the goal from now, before the zoom has loaded and started to move.
    const command = { scale };
    this.#zoomCommand = command;
    const settle = (rested: boolean) => {
      if (this.#zoomCommand === command) this.#zoomCommand = undefined;
      return rested;
    };
    return this.#loadZoom()
      .then((zoom) => zoom?.zoomTo(scale, options) ?? false)
      .then(settle, (error: unknown) => {
        settle(false);
        throw error;
      });
  }

  connect(
    controller: SessionController<TItem>,
    renderer?: FluidboxViewerLayer,
    extensions: readonly (FluidboxExtension<TItem> | undefined)[] = [],
  ) {
    this.#controller = controller;
    this.setPortal(renderer);
    this.setExtensions(extensions);
  }

  setSource(source: FluidboxSource<TItem>) {
    this.#source = source;
    for (const extension of this.#extensions) extension.setSource?.(source);
    this.#discardPreparation();
    this.#preparedFlight = undefined;
    if (this.#strip) {
      this.#strip.setSource(source);
      this.#portal.dialog.toggleAttribute("data-gallery", source.count > 1);
      return;
    }
    this.#strip = new ViewerStrip(
      this.#portal.overlay.ownerDocument,
      source,
      (index, settled) => {
        const controller = this.#controller;
        if (controller?.state.status === "open" && (controller.state.index !== index || settled)) {
          void controller.goTo({ index }, { reason: "pointer", scrub: !settled, approved: true });
        }
      },
      (index) => {
        const controller = this.#controller;
        return controller?.state.status !== "open" || controller.allows({ index }, "pointer");
      },
      this.#slides as Readonly<Record<string, FluidboxSlideRenderer<any> | undefined>>,
      this.#labels,
      this.#loop,
    );
    // A box the zoom holds goes back before its slide unloads, as new items can do.
    this.#strip.onUnload = (media) => {
      if (this.#zoom?.target !== media) return;
      this.#zoom.suspend();
      this.#zoom.release();
    };
    this.#strip.onZoomableChange = () => this.#controller?.zoomableChanged?.();
    this.#strip.onMediaError = (index, kind, cause) => {
      const item = source.getItem(index);
      this.#controller?.mediaError?.(
        new FluidboxMediaErrorEvent("mediaerror", { value: idOf(item), index, item, kind, cause }),
      );
    };
    this.#portal.frame.replaceWith(this.#strip.element);
    this.#portal.dialog.toggleAttribute("data-gallery", source.count > 1);
  }

  revealed() {
    this.#onPageScroll();
  }

  /** Whether an extension keeps the page's thumbnail in view while the viewer is open. */
  keepsThumbnail() {
    return this.#extensions.some((extension) => extension.keepsThumbnail?.());
  }

  registerThumbnailOverlay(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ) {
    if (this.#thumbnailOverlays) return this.#thumbnailOverlays.register(id, registration);
    // Until the runtime is here, the overlay shows its resting state.
    publishOverlayPhase(registration.element, "idle", 1);
    const ownerDocument = this.#portal.overlay.ownerDocument;
    this.#overlaysLoad ??= import("./thumbnail-overlay-runtime").then(
      ({ ThumbnailOverlayRuntime }) => {
        if (!this.#destroyed) this.#thumbnailOverlays = new ThumbnailOverlayRuntime(ownerDocument);
      },
      () => {
        this.#overlaysLoad = undefined;
      },
    );
    let released = false;
    let dispose: FluidboxDispose | undefined;
    void this.#overlaysLoad.then(() => {
      if (!released) dispose = this.#thumbnailOverlays?.register(id, registration);
    });
    return () => {
      released = true;
      if (dispose) dispose();
      else resetOverlayPhase(registration.element);
    };
  }

  prepare(context: Omit<ViewerSessionMotionContext<TItem>, "signal" | "reason">) {
    this.#discardPreparation();
    if (this.#destroyed || this.#controller?.state.status !== "closed" || activeViewer.active) {
      return () => {};
    }
    this.#stage(context.origin?.trigger ?? null);
    // The slide mounts knowing an open may wait for it, and what it opens from.
    this.#strip?.setOpening(context.index);
    this.#strip?.setOriginMedia(
      context.index,
      this.#originVideo(context),
      originModel(context.origin),
    );
    void this.#strip?.select(context.index, false);
    this.#strip?.prepareOpening(context.index, this.#matchingThumbnail(context));
    this.#render(context.item, context.index, false);
    this.#portal.overlay.dataset.fluidboxPrepared = "";
    mountViewerPortal(this.#portal.overlay);
    this.#strip?.mount();
    for (const extension of this.#extensions) extension.attach?.();

    const plan = this.#plan(context);
    this.#applyMediaPose(this.#frame, this.#media, plan.start);
    this.#frame.style.opacity = plan.start.frameOpacity;
    this.#portal.backdrop.style.opacity = plan.start.backdropOpacity;
    const animations = this.#animatePose(plan.motion);
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 0;
    }
    const token = {};
    this.#preparedOpen = { ...plan, token, item: context.item, index: context.index, animations };
    return () => {
      if (this.#preparedOpen?.token === token) this.#discardPreparation();
    };
  }

  async open(context: ViewerSessionMotionContext<TItem>) {
    const operation = ++this.#operation;
    this.#preloadActions();
    // Every wait below can end with the open called off: by a close, a destroy,
    // new items or the caller's signal. It then stops before touching the page.
    const abandoned = () => {
      if (!context.signal.aborted && !this.#destroyed) return false;
      this.#abandonOpen(operation);
      return true;
    };
    // The session has just hidden the card's image. Keep it painted until the
    // opening's first frame is ready to cover it, or the card blinks empty.
    this.#keepThumbnailVisible(context.origin?.thumbnail);
    this.#preparedFlight = undefined;
    // An overlay registered just before the open still travels with it.
    if (this.#overlaysLoad && !this.#thumbnailOverlays) {
      await this.#whileWaiting(this.#overlaysLoad, context.signal);
      if (abandoned()) return;
    }
    const previous = activeViewer.claim(this.#viewerOwner);
    if (previous && !previous.closeImmediately()) {
      activeViewer.claim(previous);
      this.#discardPreparation();
      return false;
    }
    this.#endWheelHandoff();
    void this.#loadZoom();
    this.#cancelAnimations(true);
    this.#removeFlight();
    const prepared =
      !context.instant &&
      this.#preparedOpen &&
      idOf(this.#preparedOpen.item) === idOf(context.item) &&
      this.#preparedOpen.index === context.index
        ? this.#preparedOpen
        : undefined;
    if (!prepared) this.#discardPreparation();
    else this.#preparedOpen = undefined;
    this.#strip?.setOpening(context.index);
    this.#strip?.setOriginMedia(
      context.index,
      this.#originVideo(context),
      originModel(context.origin),
    );
    const focused = this.#portal.overlay.ownerDocument.activeElement;
    this.#stage(context.origin?.trigger ?? (focused instanceof HTMLElement ? focused : null));
    if (!prepared) {
      await this.#strip?.select(context.index, false);
      if (abandoned()) return;
      if (!context.instant) {
        this.#strip?.prepareOpening(context.index, this.#matchingThumbnail(context));
      }
    }
    // The dialog's name says what it shows, so the opening announces only where.
    this.#render(context.item, context.index, "");
    this.#setActiveTrigger(context.origin?.trigger ?? null);
    this.#returnFocus =
      context.origin?.trigger ??
      (this.#portal.overlay.ownerDocument.activeElement instanceof HTMLElement
        ? this.#portal.overlay.ownerDocument.activeElement
        : null);
    this.#returnFocusFallback = focusableHostFor(this.#returnFocus);
    if (!this.#portal.overlay.isConnected) {
      this.#portal.overlay.dataset.fluidboxPrepared = "";
      mountViewerPortal(this.#portal.overlay);
    }
    this.#strip?.mount();
    for (const extension of this.#extensions) extension.attach?.();
    // An instant open waits for its image while the server's copy, inside the
    // page, stays usable; the page goes inert once the viewer shows.
    if (!context.instant) {
      this.#isolation.activate();
      // The trigger is inert now; focus goes in before the flight starts.
      this.#focusUnlessInside();
    }
    this.#setState("opening");
    if (context.instant) {
      // Hidden until the image can paint, so it replaces the server's copy in one frame.
      this.#keepThumbnailVisible(undefined);
      await Promise.all([this.#mediaReady(), this.#slideReady(context)]);
      if (abandoned()) return;
      this.#clearMotionStyles();
      this.#thumbnailOverlays?.prepare(context.item, context.index, this.#frame, "open", 0);
      this.#isolation.activate();
      delete this.#portal.overlay.dataset.fluidboxPrepared;
      this.#setState("open");
      // No one pressed anything yet, so focus the dialog without a ring on Close.
      this.#portal.dialog.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      return;
    }
    if (!prepared) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (abandoned()) return;
    // The card keeps its picture while the slide gets ready, so the flight
    // doesn't land on an empty box.
    await this.#slideReady(context);
    if (abandoned()) return;
    this.#strip?.setOpening(context.index, true);
    if (this.#prefersReducedMotion()) {
      this.#keepThumbnailVisible(undefined);
      for (const animation of prepared?.animations ?? []) animation.cancel();
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#thumbnailOverlays?.prepare(context.item, context.index, this.#frame, "open", 0);
      delete this.#portal.overlay.dataset.fluidboxPrepared;
      this.#setState("open");
      this.#focusUnlessInside();
      return;
    }

    const interruptedPose = this.#takeInterruptedPose(false);
    const { origin, picture, crossfade, start, motion } = this.#plan(
      context,
      interruptedPose,
      prepared,
    );
    this.#activeOrigin = origin;
    this.#activePicture = picture;
    const keptThumbnail = context.origin?.thumbnail;
    if (crossfade) this.#keepThumbnailVisible(keptThumbnail);
    const overlayFrom = interruptedPose ? (this.#thumbnailOverlays?.currentProgress(1) ?? 1) : 1;
    this.#thumbnailOverlays?.prepare(
      context.item,
      context.index,
      this.#frame,
      "opening",
      overlayFrom,
    );
    const controlsReady = motion.backdrop.find((keyframe) => Number(keyframe.opacity) >= 0.85);
    const controlsRevealDelay = Number(controlsReady?.offset ?? 0.7) * motion.duration;
    const controlsReveal = this.#thumbnailOverlays?.prepareControlsReveal(controlsRevealDelay);
    this.#applyMediaPose(this.#frame, this.#media, start);
    this.#frame.style.opacity = interruptedPose?.frameOpacity ?? start.frameOpacity;
    this.#portal.backdrop.style.opacity = interruptedPose?.backdropOpacity ?? "0";
    this.#portal.dialog.style.setProperty("--fluidbox-reveal-delay", `${controlsRevealDelay}ms`);
    this.#portal.dialog.dataset.revealing = "";
    const animations = this.#fly(
      motion,
      overlayFrom,
      0,
      prepared && !interruptedPose ? prepared.animations : this.#animatePose(motion),
    );
    delete this.#portal.overlay.dataset.fluidboxPrepared;
    // Safari can paint a freshly shown image a frame late. The opening starts
    // exactly over the card, so the card stays painted underneath until the
    // overlay has been presented once.
    if (!crossfade || !keptThumbnail) {
      this.#releaseThumbnailAfterFirstFrame(crossfade ? undefined : keptThumbnail, context.signal);
    }
    await this.#play(animations, context.signal, () =>
      this.#thumbnailOverlays?.set("opening", 0, new DOMMatrix()),
    );
    if (abandoned()) return;
    const reveals = this.#portal.dialog
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          (animation as CSSAnimation).animationName === "fluidbox-gallery-controls-appear",
      );
    await Promise.all(
      [...reveals, controlsReveal].map((animation) =>
        this.#waitForAnimation(animation, context.signal),
      ),
    );
    if (abandoned()) return;
    this.#setState("open");
    // A gesture that interrupted the opening owns the overlays until it settles.
    if (!this.#dragGesture.active) this.#thumbnailOverlays?.set("open", 0, new DOMMatrix());
    this.#endReveal();
    this.#focusUnlessInside();
  }

  async select(context: ViewerSessionMotionContext<TItem>) {
    this.#fileFetch?.abort();
    this.#preparedFlight = undefined;
    this.#cancelAnimations(true);
    this.#zoom?.suspend();
    void this.#loadZoom();
    this.#takeInterruptedPose();
    this.#activeOrigin = visibleOrigin(context.origin?.visual);
    this.#activePicture = this.#originPicture(
      this.#activeOrigin,
      context.origin,
      !originMatchesItem(context.origin, context.item),
    );
    this.#setActiveTrigger(context.origin?.trigger ?? null);
    const selected = this.#strip?.shows(context.index);
    // A native swipe updates the strip before it reports the selected index.
    // Sending that selection back into the strip would snap an in-progress
    // touch gesture to its midpoint and discard the browser's momentum.
    if (!selected) {
      const smooth =
        !this.#prefersReducedMotion() && context.reason !== "source-update" && !context.scrub;
      await this.#strip?.select(context.index, smooth, context.step);
      if (context.signal.aborted || this.#destroyed) return;
    }
    // The item left behind scrolled away zoomed; coming back, it shows at fit.
    this.#zoom?.release();
    this.#render(context.item, context.index, true);
    // The overlay is invisible while open. Moving it between slide frames
    // during native scrolling can invalidate the browser's painted snap.
    // A scrub is a direct preview. The full-size image swaps immediately
    // while native scrolling continues under the user's finger.
  }

  async close(context: ViewerSessionCloseContext) {
    const operation = ++this.#operation;
    const immediate = this.#forceImmediateClose;
    this.#fileFetch?.abort();
    // A close planned while the viewer covers the screen would fly to stale geometry.
    if (this.#isFullscreen()) {
      await this.setFullscreen(false);
      if (context.signal.aborted || this.#destroyed || operation !== this.#operation) return;
    }
    const settling = this.#extensions
      .map((extension) => extension.beforeClose?.())
      .filter((result): result is Promise<void> => result instanceof Promise);
    if (settling.length) {
      await Promise.all(settling);
      if (context.signal.aborted || this.#destroyed) return;
    }
    this.#zoom?.suspend();
    this.#cancelAnimations(true);
    const interruptedPose = this.#takeInterruptedPose(false);
    this.#setState("closing");
    this.#setActiveTrigger(null);
    if (context.origin?.trigger.isConnected) {
      this.#returnFocus = context.origin.trigger;
      this.#returnFocusFallback = focusableHostFor(context.origin.trigger);
    }
    // Every close, flown or not, tells the slide on show where it lands.
    this.#strip?.closing(this.#originVideo(context), originModel(context.origin));
    if (
      immediate ||
      this.#forceImmediateClose ||
      this.#prefersReducedMotion() ||
      // An open called off before the viewer showed has nothing painted to fly
      // back, and an emptied source has no slide; unattached media measure 0.
      !this.#portal.overlay.isConnected ||
      !this.#source?.count ||
      !this.#media.offsetWidth ||
      this.#extensions.some((extension) => extension.closesInPlace?.())
    ) {
      this.#preparedFlight = undefined;
      this.#takeInterruptedPose();
      this.#clearMotionStyles();
      this.#finishClose();
      return;
    }
    // A renderer's box with nothing in it has no picture to fly: it fades in place.
    const from = this.#strip?.empty ? null : visibleOrigin(context.origin?.visual);
    const closing = this.#strip?.shownItem;
    const crossfade = !!from && !!closing && !originMatchesItem(context.origin, closing);
    const picture = this.#originPicture(from, context.origin, crossfade);
    const video = this.#originVideo(context);
    if (video) this.#handBackVideo(video);
    this.#keepThumbnailVisible(crossfade ? context.origin?.thumbnail : undefined);
    const start = interruptedPose ?? {
      ...readImageTransitionPose(this.#frame, this.#media),
      frameOpacity: "1",
      backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
    };
    const originTarget = from ? originTransitionPose(from, picture, this.#media, start) : null;
    let target =
      originTarget ?? this.#shrunk(start.clip, new DOMMatrix(start.transform.toString()));
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
    // reset playback, and a custom element such as <model-viewer> can lose what
    // it drew, so embedded media close inside their own frame instead, as does
    // custom content that holds them, such as a playing YouTube embed.
    const playable = "iframe, video, audio";
    const embedded =
      media.matches(playable) ||
      !!media.querySelector(playable) ||
      [media, ...media.querySelectorAll("*")].some((element) => element.localName.includes("-"));
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
        // Keep the painted source visible until its flight clone can replace it.
        const image = media as HTMLImageElement;
        await (
          prepared
            ? prepared.ready.then(async (decoded) => {
                if (!decoded) await image.decode();
              })
            : image.decode()
        ).catch(() => {});
        if (context.signal.aborted || this.#destroyed) {
          // A later open or close may have its own flight by now.
          if (this.#flightMedia === media) this.#removeFlight();
          return;
        }
        source.dataset.fluidboxFlightSourceHidden = "";
        this.#flightSourceFrame?.setAttribute("data-fluidbox-flight-source-hidden", "");
        this.#flight?.style.removeProperty("visibility");
      }
      this.#closeOriginObserver = new ResizeObserver(this.#scheduleCloseTargetUpdate);
      this.#closeOriginObserver.observe(from);
    } else {
      this.#preparedFlight = undefined;
    }
    const closeMotion = (to: ImageTransitionPose, width: number, height: number) =>
      createImageTransitionMotion({
        opening: false,
        from: start,
        to,
        width,
        height,
        backdropFrom: Number(start.backdropOpacity),
        duration: this.#duration(duration),
        response: this.#duration(duration * 0.9),
        samples: 60,
        fadeFrame: !originTarget,
        crossfade,
      });
    const motion = closeMotion(target, this.#media.offsetWidth, this.#media.offsetHeight);
    this.#retargetClose =
      from && originTarget
        ? () => {
            const media = this.#flightMedia;
            if (!media || this.#animations.length < 3) return;
            const target = this.#flightTargetPose(from, picture, media);
            if (!target) return;
            const motion = closeMotion(target, media.offsetWidth, media.offsetHeight);
            const keyframes = [motion.frame, motion.image, motion.radius];
            for (const [index, frames] of keyframes.entries()) {
              const effect = this.#animations[index]!.effect;
              if (effect instanceof KeyframeEffect) effect.setKeyframes(frames);
            }
            this.#thumbnailOverlays?.retarget(this.#animations, motion.frame);
          }
        : undefined;
    const overlayFrom = this.#thumbnailOverlays?.currentProgress(0) ?? 0;
    if (this.#strip) {
      this.#thumbnailOverlays?.prepare(
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
      ? frame.querySelector<HTMLImageElement>(":scope > [data-fluidbox-media-cover][src]")
      : null;
    const animations = this.#fly(motion, overlayFrom, 1, [
      ...this.#animatePose(motion, frame, media),
      ...(cover
        ? [
            cover.animate([{ opacity: getComputedStyle(cover).opacity }, { opacity: 1 }], {
              duration: motion.duration * 0.6,
              easing: "ease-out",
              fill: "both",
            }),
          ]
        : []),
    ]);
    await this.#play(animations, context.signal, () =>
      this.#thumbnailOverlays?.set("closing", 1, target.transform),
    );
    if (context.signal.aborted) return;
    this.#finishClose();
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    ++this.#operation;
    this.#keepThumbnailVisible(undefined);
    this.#lifetime.abort();
    this.#extensionLifetime?.abort();
    clearTimeout(this.#suppressClickTimer);
    this.#dragGesture.cancel();
    this.#preparedFlight = undefined;
    this.#endWheelHandoff();
    this.#fileFetch?.abort();
    clearTimeout(this.#copiedTimer);
    if (this.#isFullscreen()) void this.setFullscreen(false);
    this.#actions?.raiseAgain(this.#portal.overlay);
    this.#zoom?.destroy();
    this.#mediaObserver?.disconnect();
    this.#mediaObserver = undefined;
    this.#observedMedia = undefined;
    this.#discardPreparation();
    this.#thumbnailOverlays?.destroy();
    this.#cancelAnimations(false);
    this.#portalDispose?.();
    this.#portalDispose = undefined;
    for (const extension of this.#extensions) extension.destroy();
    this.#extensions = [];
    this.#strip?.destroy();
    this.#strip = undefined;
    this.#finishClose();
  }

  /**
   * Wait until the opened slide is ready, for at most three seconds, with the
   * keys of a wait. The open's signal ends it: a close, a newer open, new
   * items or a destroy.
   */
  #slideReady(context: { readonly index: number; readonly signal: AbortSignal }) {
    const ready = this.#strip?.ready(context.index, SLIDE_READY_CAP);
    if (!ready) return Promise.resolve();
    const { signal } = context;
    const called = new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    return this.#whileWaiting(Promise.race([ready, called]), signal);
  }

  /** Wait until the active image has decoded and the strip shows it, for at most three seconds. */
  async #mediaReady() {
    const media = this.#media;
    if (!(media instanceof HTMLImageElement)) return;
    const shown = (async () => {
      await media.decode().catch(() => {});
      // The strip reveals an image a frame or so after it decodes.
      for (let frame = 0; frame < 10 && media.dataset.fluidboxImagePending !== undefined; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    })();
    await Promise.race([shown, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }

  /**
   * Put the page back after an open that was called off, unless a later open or
   * close took the viewer over: that one finishes what the page shows.
   */
  #abandonOpen(operation: number) {
    if (operation !== this.#operation || this.#destroyed) return;
    this.#cancelAnimations(false);
    this.#discardPreparation();
    this.#clearMotionStyles();
    this.#finishClose();
  }

  /**
   * Wait for code the open needs before the viewer shows. The viewer does not
   * have the keys yet, so Escape calls the open off and the arrows move it, as
   * they do while the viewer's own code loads.
   */
  async #whileWaiting(loading: Promise<unknown>, signal: AbortSignal) {
    const waiting = new AbortController();
    const ownerDocument = this.#portal.overlay.ownerDocument;
    // In the bubble phase, as the viewer's own keys: a field, widget or content
    // that owns its input keeps its keys, and only Escape is taken from them.
    ownerDocument.addEventListener(
      "keydown",
      (event) => {
        if (signal.aborted || event.defaultPrevented || event.isComposing) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const options = { reason: "keyboard" } as const;
        const target = event.target instanceof Element ? event.target : null;
        if (event.key === "Escape") {
          // An open menu or popover takes it; the page's own dialog, which a
          // trigger may be in, does not, as the open was the last thing asked.
          if (target?.closest(ESCAPE_OWNERS)?.matches(":not(dialog)")) return;
          void this.#controller?.close(options);
        } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !event.shiftKey) {
          if (target?.closest(`${KEY_OWNERS}, ${EDITABLE}, video[controls], audio[controls]`)) {
            return;
          }
          const rtl = getComputedStyle(target ?? ownerDocument.documentElement).direction === "rtl";
          void this.#controller?.[(event.key === "ArrowRight") !== rtl ? "next" : "previous"](
            options,
          );
        } else return;
        event.preventDefault();
      },
      { signal: waiting.signal },
    );
    try {
      await loading;
    } finally {
      waiting.abort();
    }
  }

  get #frame() {
    return this.#strip?.current?.frame ?? this.#portal.frame;
  }

  get #media() {
    return this.#strip?.current?.media ?? this.#portal.media;
  }

  /** Name the dialog for an item, and announce it: by `name`, by its own name, or not. */
  #render(item: TItem, index: number, announce: string | boolean) {
    const label = item.type === "image" ? item.alt : item.title;
    this.#portal.dialog.setAttribute("aria-label", label || this.#labels.viewer);
    const count = this.#controller?.state.count ?? 1;
    if (announce !== false && count > 1) {
      this.#announce(this.#labels.announcement(announce === true ? label : announce, index, count));
    }
    this.#trackMedia();
  }

  #announce(text: string) {
    const status = this.#portal.status;
    clearTimeout(this.#announcement);
    status.textContent = "";
    // A live region filled as it enters the page, or twice in a moment, says
    // nothing; the text goes in once the region has been there a while.
    this.#announcement = setTimeout(() => {
      if (status.isConnected) status.textContent = text;
    }, 150);
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
    this.#portal.dialog.style.setProperty("--fluidbox-media-width", `${media.offsetWidth}px`);
    this.#portal.dialog.style.setProperty("--fluidbox-media-height", `${media.offsetHeight}px`);
  };

  /**
   * The session hides the origin's image while its item is open. A crossfading
   * flight fades over the card, so the card's own image must stay painted.
   */
  #keepThumbnailVisible(thumbnail: HTMLElement | undefined) {
    if (this.#crossfadeThumbnail === thumbnail) return;
    if (this.#crossfadeThumbnail)
      delete this.#crossfadeThumbnail.dataset.fluidboxThumbnailCrossfade;
    this.#crossfadeThumbnail = thumbnail;
    if (thumbnail) thumbnail.dataset.fluidboxThumbnailCrossfade = "";
    else this.#thumbnailOverlays?.releaseGhost();
  }

  #releaseThumbnailAfterFirstFrame(thumbnail: HTMLElement | undefined, signal: AbortSignal) {
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    view.requestAnimationFrame(() =>
      view.requestAnimationFrame(() => {
        if (!signal.aborted && this.#crossfadeThumbnail === thumbnail) {
          this.#keepThumbnailVisible(undefined);
          this.#thumbnailOverlays?.releaseGhost();
        }
      }),
    );
  }

  /** The origin's image, when it shows the item being opened. */
  #matchingThumbnail(context: { item: TItem; origin?: FluidboxOrigin | null }) {
    const thumbnail = context.origin?.thumbnail;
    return thumbnail && originShowsItem(thumbnail, context.item) ? thumbnail : undefined;
  }

  /**
   * The card's own video picks up where the closing slide's player is, so it
   * lands on the same frame: the built-in video's, or what a custom slide
   * registered with `returnPlayback`.
   */
  #handBackVideo(origin: HTMLVideoElement) {
    const playback = this.#strip?.returnedPlayback();
    if (!playback) return;
    if (Math.abs(origin.currentTime - playback.currentTime) > 0.01) {
      origin.currentTime = playback.currentTime;
    }
    if (!playback.paused) void origin.play().catch(() => undefined);
  }

  /**
   * The trigger's video: what an opening slide gets as `origin`, and what a
   * close hands the playback back to. Whether the flight crossfades doesn't
   * matter, as a custom player's item never matches the clip the trigger plays.
   */
  #originVideo(context: { origin?: FluidboxOrigin | null }) {
    const picture = this.#originPicture(
      visibleOrigin(context.origin?.visual),
      context.origin,
      false,
    );
    return picture instanceof HTMLVideoElement ? picture : null;
  }

  /** The element that paints the item in the origin, unless the flight crossfades over it. */
  #originPicture(
    from: HTMLElement | null,
    origin: FluidboxOrigin | null | undefined,
    crossfade: boolean,
  ) {
    if (!from || crossfade) return null;
    const thumbnail = origin?.thumbnail;
    if (thumbnail && (thumbnail === from || from.contains(thumbnail))) return thumbnail;
    return originPicture(from);
  }

  /**
   * Where an opening starts and how it moves. A prepared opening keeps its own
   * plan, unless the opening takes over a motion that was interrupted.
   */
  #plan(
    context: Omit<ViewerSessionMotionContext<TItem>, "signal" | "reason">,
    interrupted?: PaintedPose,
    prepared?: PreparedOpen<TItem>,
  ) {
    // A renderer's box with nothing in it opens as if without an origin.
    const origin = this.#strip?.empty
      ? null
      : (prepared?.origin ?? visibleOrigin(context.origin?.visual));
    const shown = this.#strip?.shows(context.index) ? this.#strip.shownItem : undefined;
    const crossfade =
      !!origin && !originMatchesItem(context.origin, (shown as TItem | undefined) ?? context.item);
    const picture = prepared
      ? prepared.picture
      : this.#originPicture(origin, context.origin, crossfade);
    if (!prepared && picture instanceof HTMLVideoElement) {
      this.#strip?.continueVideo(context.index, picture);
    }
    if (prepared && !interrupted) {
      return { origin, picture, crossfade, start: prepared.start, motion: prepared.motion };
    }
    const start = interrupted
      ? { ...interrupted, fromOrigin: true }
      : this.#openingStart(origin, picture, crossfade);
    const motion = this.#openingMotion(start, crossfade && !interrupted);
    return { origin, picture, crossfade, start, motion };
  }

  #openingStart(
    from: HTMLElement | null,
    picture: HTMLElement | null,
    crossfade: boolean,
  ): PaintedPose & { readonly fromOrigin: boolean } {
    const openPose = openImageTransitionPose();
    const pose = from ? originTransitionPose(from, picture, this.#media, openPose) : null;
    if (pose) {
      return {
        ...pose,
        frameOpacity: crossfade ? "0" : "1",
        backdropOpacity: "0",
        fromOrigin: true,
      };
    }
    return {
      ...this.#shrunk(openPose.clip),
      frameOpacity: "0",
      backdropOpacity: "0",
      fromOrigin: false,
    };
  }

  /** Where a motion without an origin starts or ends: the media a little smaller, in place. */
  #shrunk(clip: ImageClip, from = new DOMMatrix()) {
    return {
      transform: from
        .translate(this.#media.offsetWidth * 0.02, this.#media.offsetHeight * 0.02)
        .scale(0.96),
      clip,
    };
  }

  #openingMotion(start: PaintedPose & { readonly fromOrigin: boolean }, crossfade: boolean) {
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
      duration: this.#duration(OPEN_DURATION),
      response: this.#duration(response),
      samples: 24,
      fadeFrame: !start.fromOrigin,
      crossfade,
    });
  }

  /** Play a motion on the media, its frame and the backdrop. */
  #animatePose(motion: ImageTransitionMotion, frame = this.#frame, media = this.#media) {
    const options: KeyframeAnimationOptions = {
      duration: motion.duration,
      easing: "linear",
      fill: "both",
    };
    return [
      frame.animate(motion.frame, options),
      media.animate(motion.image, options),
      frame.animate(motion.radius, options),
      this.#portal.backdrop.animate(motion.backdrop, options),
      ...Array.from(this.#fallbackLayers(frame), (layer) => layer.animate(motion.image, options)),
    ];
  }

  /** Start a motion's animations with the travelling overlays', from one progress to another. */
  #fly(motion: ImageTransitionMotion, from: number, to: number, animations: Animation[]) {
    const all = [
      ...animations,
      ...(this.#thumbnailOverlays?.animations(
        motion.frame,
        motion.progress,
        motion.duration,
        from,
        to,
      ) ?? []),
    ];
    this.#synchronizeStart(all);
    return all;
  }

  #fallbackLayers(frame: HTMLElement) {
    // Every layer that stands in for the media moves with it, so the frame's
    // crop is the only crop. An embed's snapshot would otherwise be cropped
    // to the frame and then again by its own cover fit.
    return frame.querySelectorAll<HTMLElement>(
      ":scope > :is([data-fluidbox-slide-placeholder], [data-fluidbox-slide-preview], [data-fluidbox-media-cover], [data-fluidbox-video-stand-in])",
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

  #discardPreparation() {
    const prepared = this.#preparedOpen;
    if (!prepared) return;
    this.#preparedOpen = undefined;
    this.#strip?.setOpening(undefined);
    for (const animation of prepared.animations) animation.cancel();
    this.#strip?.unmount();
    this.#clearMotionStyles();
    this.#portal.overlay.remove();
  }

  /** Size the viewer to the window and take the theme of its source. */
  #stage(theme: HTMLElement | null) {
    const view = this.#portal.overlay.ownerDocument.defaultView!;
    this.#viewportWidth = view.innerWidth;
    this.#sizeContainer(view);
    this.#applyTheme(theme);
    this.#applyLocale(theme ?? this.#portal.overlay.ownerDocument.documentElement);
    this.#syncPageHeight();
  }

  /**
   * The viewer lives at the end of the body, so it takes its direction and
   * language from the trigger instead: a right-to-left gallery on a
   * left-to-right page opens a right-to-left viewer.
   */
  #applyLocale(source: HTMLElement) {
    const overlay = this.#portal.overlay;
    overlay.dir = getComputedStyle(source).direction === "rtl" ? "rtl" : "ltr";
    const lang = source.closest<HTMLElement>("[lang]")?.lang;
    if (lang) overlay.lang = lang;
    else overlay.removeAttribute("lang");
  }

  #applyTheme(source: HTMLElement | null) {
    for (const property of this.#themeProperties) {
      this.#portal.overlay.style.removeProperty(property);
    }
    this.#themeProperties.clear();
    if (!source) return;
    // Read them all before writing any. The overlay may already be in the page,
    // and a read after each write would restyle it once per property.
    const style = getComputedStyle(source);
    const theme: [property: string, value: string][] = [];
    for (const property of style) {
      if (!property.startsWith("--fluidbox-")) continue;
      const value = style.getPropertyValue(property);
      if (value) theme.push([property, value]);
    }
    for (const [property, value] of theme) {
      this.#portal.overlay.style.setProperty(property, value);
      this.#themeProperties.add(property);
    }
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
    trigger.dataset.fluidboxStatus = open ? "open" : "closed";
    trigger.toggleAttribute("data-open", open);
    trigger.toggleAttribute("data-closed", !open);
    trigger.setAttribute("aria-haspopup", "dialog");
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
      this.#thumbnailOverlays?.preservePaint();
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
      "--fluidbox-drag-x",
      "--fluidbox-drag-y",
      "--fluidbox-dismiss-progress",
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
      this.#extensions.some((extension) => extension.allowsZoom?.() === false) ||
      this.#flight ||
      !this.#strip ||
      !this.#strip.zoomable()
    )
      return null;
    // A pinch can land mid-dismiss. Drop the drag whole, or the strip stays
    // frozen and the dialog keeps its dragging state, but leave the photo
    // where the finger took it: the zoom starts from its transform.
    if (this.#dragGesture.active) {
      const dragged = this.#media.getBoundingClientRect();
      this.#dropDrag();
      const rest = this.#media.getBoundingClientRect();
      if (rest.width > 0) {
        const scale = dragged.width / rest.width;
        this.#media.style.setProperty(
          "--fluidbox-media-transform",
          `matrix(${scale}, 0, 0, ${scale}, ${dragged.left - rest.left}, ${dragged.top - rest.top})`,
        );
      }
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
    // A close called off while its flight decoded leaves that flight behind.
    this.#removeFlight();
    const ownerDocument = this.#portal.overlay.ownerDocument;
    const view = ownerDocument.defaultView!;
    const bounds = source.getBoundingClientRect();
    const flight = ownerDocument.createElement("div");
    flight.dataset.fluidboxFlight = "";
    flight.setAttribute("aria-hidden", "true");
    flight.style.setProperty(
      "--fluidbox-flight-height",
      `${ownerDocument.documentElement.scrollHeight}px`,
    );
    const frame = ownerDocument.createElement("div");
    frame.dataset.fluidboxFrame = "";
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
    frame.style.setProperty("--fluidbox-flight-left", `${this.#flightOrigin.x}px`);
    frame.style.setProperty("--fluidbox-flight-top", `${this.#flightOrigin.y}px`);
    frame.style.setProperty("--fluidbox-flight-width", `${source.offsetWidth}px`);
    frame.style.setProperty("--fluidbox-flight-item-height", `${source.offsetHeight}px`);
    const media =
      prepared ??
      (source instanceof HTMLImageElement ? (source.cloneNode(true) as HTMLImageElement) : source);
    if (media !== source) {
      media.removeAttribute("style");
      flight.style.visibility = "hidden";
    } else {
      this.#flightMarker = ownerDocument.createComment("fluidbox-flight-home");
      source.before(this.#flightMarker);
    }
    media.dataset.fluidboxMedia = "";
    frame.append(media);
    flight.append(frame);
    ownerDocument.body.append(flight);
    raiseWithViewer(flight);
    this.#flight = flight;
    this.#flightFrame = frame;
    this.#flightMedia = media;
    this.#flightSource = source;
    this.#flightSourceFrame =
      media !== source
        ? (source.closest<HTMLElement>("[data-fluidbox-frame]") ?? this.#frame)
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
    const width = media.offsetWidth;
    const height = media.offsetHeight;
    return originPose({
      origin,
      picture,
      width,
      height,
      left: this.#flightOrigin.x - view.scrollX,
      top: this.#flightOrigin.y - view.scrollY,
      content: fillContent(media, width, height, picture ?? origin),
    });
  }

  #removeFlight() {
    if (this.#flightSource) delete this.#flightSource.dataset.fluidboxFlightSourceHidden;
    if (this.#flightSourceFrame) delete this.#flightSourceFrame.dataset.fluidboxFlightSourceHidden;
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
    this.#retargetClose = undefined;
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
      this.#retargetClose?.();
      this.#closeRetargetSettleFrame = requestAnimationFrame(() => {
        this.#closeRetargetSettleFrame = 0;
        this.#retargetClose?.();
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
      this.#retargetClose?.();
      this.#scheduleCloseTargetUpdate();
      return;
    }
    if (!widthChanged) return;
    if (this.#dragGesture.active) this.#endDrag(true);
    this.#viewportWidth = view.innerWidth;
    this.#sizeContainer(view);
    if (this.#zoom?.zoomed) {
      this.#zoom.reset("api");
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
    this.#portal.overlay.style.setProperty("--fluidbox-height", `${view.innerHeight}px`);
    this.#portal.overlay.style.setProperty("--fluidbox-chrome-reach", `${chromeReach(view)}px`);
    this.#pinContainer(view);
  }

  #pinContainer(view: Window) {
    this.#portal.overlay.style.setProperty("--fluidbox-scroll-top", `${view.scrollY}px`);
  }

  // The page can still scroll under an open viewer; follow it as sticky did.
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
    this.#portal.overlay.style.setProperty("--fluidbox-page-height", `${height}px`);
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
    this.#endReveal();
    const frame = this.#frame;
    if (this.#strip) {
      this.#thumbnailOverlays?.prepare(
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
    const from = visibleOrigin(this.#activeOrigin);
    const target =
      (from ? originTransitionPose(from, this.#activePicture, this.#media, current) : null) ??
      this.#shrunk(current.clip);
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

  #paintDrag(state: FluidboxDragState) {
    const distance = dragDistance(state);
    const progress = dragProgress(state);
    this.#portal.overlay.style.setProperty("--fluidbox-drag-x", `${state.x}px`);
    this.#portal.overlay.style.setProperty("--fluidbox-drag-y", `${state.y}px`);
    this.#portal.overlay.style.setProperty("--fluidbox-dismiss-progress", String(progress));
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
    this.#thumbnailOverlays?.set("dragging", progress, matrix);
    this.#portal.backdrop.style.opacity = String(state.opacity * backdropVisibility(progress));
    if (
      state.wheelTarget &&
      state.wheelPhase !== "tracking" &&
      Math.abs(dragDistance(state)) < 0.1
    ) {
      this.#dropDrag();
    }
  }

  /** Let go of a drag that leaves the viewer as it was. */
  #dropDrag() {
    this.#dragGesture.cancel();
    this.#preparedFlight = undefined;
    this.#clearMotionStyles();
    this.#strip?.resume();
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
      this.#gestures.dismiss.drag &&
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
      duration: this.#duration(duration),
      response: this.#duration(duration * 0.8),
      samples: 24,
    });
    const animations = this.#fly(
      motion,
      this.#thumbnailOverlays?.currentProgress(dragProgress(state)) ?? 0,
      0,
      this.#animatePose(motion),
    );
    void this.#play(animations, this.#lifetime.signal).then(() => {
      this.#thumbnailOverlays?.set("open", 0, new DOMMatrix());
      this.#strip?.resume();
    });
  }

  #finishClose() {
    this.#keepThumbnailVisible(undefined);
    this.#strip?.resume();
    this.#removeFlight();
    this.#thumbnailOverlays?.finishClose();
    this.#setActiveTrigger(null);
    activeViewer.release(this.#viewerOwner);
    this.#isolation.deactivate();
    this.#portal.overlay.remove();
    this.#strip?.hide();
    // The closing flight started from the zoomed pose; the next opening starts at fit.
    this.#zoom?.release();
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
    if (state !== "opening") this.#strip?.setOpening(undefined);
    for (const target of [this.#portal.overlay, this.#portal.dialog]) {
      target.dataset.fluidboxStatus = state;
      target.toggleAttribute("data-open", state !== "closed");
      target.toggleAttribute("data-closed", state === "closed");
      target.toggleAttribute("data-starting-style", state === "opening");
      target.toggleAttribute("data-ending-style", state === "closing");
      target.toggleAttribute("data-opening", state === "opening");
      // A drag that caught the opening still owns the viewer once it opens.
      target.toggleAttribute("data-dismissing", state === "closing" || this.#dragGesture.active);
    }
    if (state === "closed") this.#endReveal();
    // Once open, the actions load out of the flight's way, so a press on a
    // button of the app's own that calls setFullscreen, download or share
    // finds them ready, and keeps its user activation.
    if (state === "open" && !this.#actions) void this.#loadActions();
  }

  /**
   * Stop the controls' and chrome's reveal. Its animation would outrank the
   * rules that hide them, so a drag that catches the opening ends it first.
   */
  #endReveal() {
    this.#thumbnailOverlays?.finishControlsReveal();
    const { dialog } = this.#portal;
    delete dialog.dataset.revealing;
    dialog.style.removeProperty("--fluidbox-reveal-delay");
  }

  #onKeydown = (event: KeyboardEvent) => {
    const { overlay, dialog } = this.#portal;
    if (!overlay.isConnected || event.defaultPrevented || event.isComposing) return;
    const page = overlay.ownerDocument;
    // Keys pressed in the viewer, or with nothing focused. A popover or toast
    // the page shows over the viewer keeps its own.
    const target =
      event.target instanceof Element && dialog.contains(event.target) ? event.target : null;
    if (
      !target &&
      event.target !== page &&
      event.target !== page.body &&
      event.target !== page.documentElement
    ) {
      return;
    }
    this.#userInteraction();
    if (event.key === "Escape") {
      const owner = target?.closest(ESCAPE_OWNERS);
      if (owner && dialog.contains(owner) && owner !== dialog) return;
      event.preventDefault();
      if (this.#extensions.some((extension) => extension.keydown?.(event))) return;
      void this.#controller?.close({ reason: "keyboard" });
      return;
    }
    // The other keys are the viewer's only on the viewer itself: a focused
    // field, link, player, widget or content that owns its input keeps them.
    if ((target && !this.#ownsKeys(target)) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (this.#zoom?.zoomed && this.#zoom.keydown(event)) {
      event.preventDefault();
      return;
    }
    if (this.#extensions.some((extension) => extension.keydown?.(event))) {
      event.preventDefault();
    } else if (["+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault();
      void this.#loadZoom().then((zoom) => {
        if (event.key === "0") zoom?.reset();
        else zoom?.zoomBy(event.key === "-" ? 1 / 1.5 : 1.5);
      });
    } else if (event.shiftKey || !this.#acceptsGestures()) {
      return;
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      this.#zoom?.suspend();
      // The next slide sits on the left when the viewer reads right to left.
      const forward = (event.key === "ArrowRight") !== (overlay.dir === "rtl");
      void this.#controller?.[forward ? "next" : "previous"]({ reason: "keyboard" });
    } else if ((event.key === "Home" || event.key === "End") && this.#source) {
      event.preventDefault();
      this.#zoom?.suspend();
      const index = event.key === "Home" ? 0 : this.#source.count - 1;
      void this.#controller?.goTo({ index }, { reason: "keyboard" });
    }
  };

  /** Whether a key pressed on an element in the dialog is the viewer's. */
  #ownsKeys(target: Element) {
    return (
      (target === this.#portal.dialog ||
        target === this.#strip?.element ||
        target.matches(`${controlSelector}, [data-fluidbox-zoom-viewport]`)) &&
      !target.closest(KEY_OWNERS)
    );
  }

  /** Bring focus that lands on the page behind back into the viewer. */
  #onFocus = (event: FocusEvent) => {
    if (event.target instanceof Node && this.#isolation.covers(event.target)) this.#focus();
  };

  #onDialogChange = () => {
    this.#describe();
    this.#preloadActions();
    const { dialog } = this.#portal;
    const last = this.#lastFocus;
    const active = dialog.ownerDocument.activeElement;
    if (!last || (active !== last && active !== dialog.ownerDocument.body)) return;
    if (!last.matches(":disabled") && !last.closest("[inert]") && last.isConnected) return;
    // A Previous or Next, or a zoom control, that disables itself at an end
    // hands focus to the one going the other way; focus that would fall to the
    // page goes to Close.
    const other = Object.entries(PARTNERS).find(([control]) => last.matches(control))?.[1];
    const next = other
      ? Array.from(dialog.querySelectorAll<HTMLButtonElement>(other)).find(
          (button) => !button.disabled && button.checkVisibility?.() !== false,
        )
      : undefined;
    if (next) next.focus({ preventScroll: true });
    else if (this.#controller?.state.status !== "closed") this.#focus();
  };

  /** Describe the dialog by the element in it marked `data-fluidbox-description`. */
  #describe() {
    const { dialog } = this.#portal;
    const description = Array.from(
      dialog.querySelectorAll<HTMLElement>("[data-fluidbox-description]"),
    ).find((element) => !element.closest("[inert]"));
    if (description) {
      description.id ||= `fluidbox-description-${++descriptions}`;
      dialog.setAttribute("aria-describedby", description.id);
    } else {
      dialog.removeAttribute("aria-describedby");
    }
  }

  /** Move focus into a settled dialog, unless someone already put it there. */
  #focusUnlessInside() {
    const focused = this.#portal.dialog.ownerDocument.activeElement;
    if (!focused || !this.#portal.dialog.contains(focused)) this.#focus();
  }

  #focus() {
    const close = Array.from(
      this.#portal.dialog.querySelectorAll<HTMLButtonElement>("[data-fluidbox-close]"),
    ).find((button) => !button.disabled && button.checkVisibility?.() !== false);
    (close ?? this.#portal.dialog).focus({ preventScroll: true });
  }

  #eventUsesNativeInteraction(event: Event, includeMedia = true) {
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLElement &&
          target.matches(
            `${includeMedia ? "video, audio, " : ""}iframe, input, select, textarea, button, summary, a[href], [contenteditable], [data-fluidbox-owns-input]`,
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
    this.#dragExtension = undefined;
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
    if (!this.#dragGesture.active && !this.#dragExtension) {
      this.#dragExtension = this.#extensions.find((extension) => extension.claimDrag?.(y));
      this.#dragExtension?.drag?.("start", pointer.y);
    }
    if (this.#dragExtension) {
      this.#dragExtension.drag?.("move", event.clientY);
      return;
    }
    this.#beginDrag();
    // A drag that may not close follows the finger a little way, and springs back.
    if (this.#gestures.dismiss.drag) this.#dragGesture.moveTouch(x, y);
    else this.#dragGesture.moveTouch(rubberBand(x), rubberBand(y));
  };

  #onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.#pointer?.id) return;
    const cancel = event.type === "pointercancel";
    if (this.#releaseExtensionDrag(cancel ? "cancel" : "end", event.clientY)) return;
    this.#endDrag(cancel);
  };

  #releaseExtensionDrag(phase: "end" | "cancel", clientY: number) {
    const extension = this.#dragExtension;
    if (!extension) return false;
    this.#dragExtension = undefined;
    this.#pointer = undefined;
    extension.drag?.(phase, clientY);
    return true;
  }

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
      (event.target instanceof Element &&
        event.target.closest("[data-fluidbox-portal], [data-fluidbox-addons]"))
    ) {
      return;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    if (!this.#dragGesture.active) {
      for (const extension of this.#extensions) {
        const taken = extension.wheel?.(event.deltaY * unit);
        if (taken === "native") return;
        if (taken) {
          event.preventDefault();
          return;
        }
      }
    }
    event.preventDefault();
    const mode = this.#gestures.wheel;
    // "zoom" is the zoom's, which takes the wheel before this does; "none" keeps the page still.
    if (mode === "zoom" || mode === "none") return;
    if (mode === "navigate") {
      // One gesture, one move: trackpad inertia keeps the gesture going.
      const now = performance.now();
      const fresh = now - this.#lastNavigateWheel > NAVIGATE_WHEEL_GAP;
      this.#lastNavigateWheel = now;
      if (fresh && this.#controller?.state.status === "open") {
        const options = { reason: "wheel" as const };
        void (event.deltaY > 0
          ? this.#controller.next(options)
          : this.#controller.previous(options));
      }
      return;
    }
    const direction = Math.sign(-event.deltaY);
    this.#beginDrag(direction);
    this.#dragGesture.moveWheel(event.deltaY * unit);
  };
}
