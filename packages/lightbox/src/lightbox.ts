import { LightboxZoom } from "./lightbox-zoom";
import { triggerLoad } from "unlazy";
import { GalleryStrip, type GalleryItem, type GalleryItemSource } from "./gallery-strip";
import { AppGallery } from "./gallery";
import { AppFilmstrip, type FilmstripSession } from "./filmstrip";
import {
  backdropVisibility,
  boundDismissVelocity,
  dismissCloseValue,
  dismissRadiusProgress,
  dismissReturnValue,
  dragDistance,
  dragProgress,
  LightboxGestureController,
  touchAxisThreshold,
  wheelDismissDistance,
  type CornerRadii,
  type LightboxDragState,
} from "./lightbox-gesture";

const BROWSER_CHROME_RELEASE_PROGRESS = 0.34;
const BROWSER_CHROME_RESTORE_PROGRESS = 0.2;
const TOUCH_DISMISS_DISTANCE = 60;
const DISMISS_RADIUS_END = 0.1;
const WHEEL_HANDOFF_QUIET_GAP = 120;
const WHEEL_HANDOFF_ACCELERATION = 1.25;
const WHEEL_HANDOFF_MIN_DELTA = 4;
const WHEEL_HANDOFF_TIMEOUT = 1200;
const OPENING_SPRING_RESPONSE = 210;
const TOUCH_OPENING_SPRING_RESPONSE = 380;
const OPENING_BACKDROP_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
type TransitionPhase = "preview" | "opening" | "open" | "dragging" | "closing";

interface ImageClip {
  x: number;
  y: number;
  radii: CornerRadii;
}

interface ThumbnailPose extends ImageClip {
  transform: string;
}

const emptyRadii = (): CornerRadii => [0, 0, 0, 0];
const emptyClip = (): ImageClip => ({ x: 0, y: 0, radii: emptyRadii() });

function mapRadii(radii: CornerRadii, map: (radius: number, index: number) => number): CornerRadii {
  return [map(radii[0], 0), map(radii[1], 1), map(radii[2], 2), map(radii[3], 3)];
}

interface CropPose {
  frame: DOMMatrix;
  image: DOMMatrix;
  borderRadius: string;
}

function cropPose(transform: DOMMatrix, clip: ImageClip, width: number, height: number): CropPose {
  const x = Math.min(Math.max(0, clip.x), Math.max(0, width / 2 - 0.01));
  const y = Math.min(Math.max(0, clip.y), Math.max(0, height / 2 - 0.01));
  const crop = new DOMMatrix()
    .translate(x, y)
    .scale(Math.max(0.0001, (width - x * 2) / width), Math.max(0.0001, (height - y * 2) / height));
  const frame = transform.multiply(crop);
  const image = frame.inverse().multiply(transform);
  const radiiX = mapRadii(clip.radii, (radius) => radius / Math.max(0.0001, Math.abs(frame.a)));
  const radiiY = mapRadii(clip.radii, (radius) => radius / Math.max(0.0001, Math.abs(frame.d)));
  return {
    frame,
    image,
    borderRadius: `${radiiX.join("px ")}px / ${radiiY.join("px ")}px`,
  };
}

class AppLightbox extends HTMLElement {
  static observedAttributes = ["src", "alt", "loading", "close-button"];
  static #progressRegistered = false;

  #controller: AbortController | undefined;
  #zoom: LightboxZoom | undefined;
  static #active: AppLightbox | null = null;
  #overlay: HTMLDivElement | null = null;
  #dialog: HTMLDivElement | null = null;
  #backdrop: HTMLDivElement | null = null;
  #modalController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #inertElements = new Map<Element, boolean>();
  #returnFocus: HTMLElement | null = null;
  #animations: Animation[] = [];
  #phase: "closed" | "open" | "closing" = "closed";
  #revision = 0;
  #closeStartTransform = "none";
  #closeTarget = new DOMMatrix();
  #closeStartClip = emptyClip();
  #closeTargetClip = emptyClip();
  #flight: HTMLDivElement | undefined;
  #flightFrame: HTMLElement | undefined;
  #flightImage: HTMLElement | undefined;
  #transitionLayer: HTMLElement | undefined;
  #transitionLayerMarker: Comment | undefined;
  #transitionContent: HTMLDivElement | undefined;
  #transitionContentMarkers: Comment[] = [];
  #transitionOpenBounds = { left: 0, top: 0, width: 0, height: 0 };
  #preparedTransitionContentMotion: Keyframe[] = [];
  #takingDragOwnership = false;
  #flightUsesLiveContent = false;
  #flightLiveStyle: string | null = null;
  #flightOrigin = { x: 0, y: 0, width: 0, height: 0 };
  #viewportWidth = 0;
  #backgroundSelection = -1;
  #image: HTMLElement | null = null;
  #closeButton: HTMLButtonElement | null = null;
  #imageLoaded = false;
  #decodedPreviewSrc = "";
  #decodedPreviewWidth = 0;
  #decodedPreviewHeight = 0;
  #hiddenThumbnail: HTMLElement | null = null;
  #pendingImage: (() => void) | undefined;
  #gallery: GalleryStrip | undefined;
  #filmstrip: FilmstripSession | undefined;
  #filmstripDock: HTMLDivElement | undefined;
  #openingControlsRevealDelay = 210;
  #preparedGallery: { group: AppGallery; index: number; gallery: GalleryStrip } | undefined;
  #preparedOverlay = false;
  #preparedOpening = false;
  #prepareCleanup: ReturnType<typeof setTimeout> | undefined;
  #galleryTrigger: HTMLElement | null = null;
  #gallerySelectionIndex = -1;
  #standaloneImage: HTMLElement | null = null;
  #standaloneFrame: HTMLDivElement | null = null;
  #frame: HTMLElement | null = null;
  #portableContent: HTMLElement | null = null;
  #portableMarker: Comment | null = null;
  #portablePreviewProxy: HTMLImageElement | null = null;
  #status: HTMLElement | null = null;
  #triggerElement: HTMLElement | null = null;
  #triggerRoot: HTMLElement | null = null;
  #gesture:
    | { x: number; y: number; time: number; axis: "pending" | "horizontal" | "vertical" }
    | undefined;
  #suppressClick = false;
  #dragGesture = new LightboxGestureController(
    (state) => this.#paintDrag(state),
    () => {
      this.#beginWheelHandoff();
      this.#endDrag(false, true);
    },
  );
  #settleVelocityX = 0;
  #settleVelocityY = 0;
  #wheelPaintSample: { matrix: DOMMatrix; time: number; velocity: DOMMatrix } | undefined;
  #settleMatrixVelocity: DOMMatrix | undefined;
  #wheelDirection = 0;
  #wheelHandoff:
    | {
        controller: AbortController;
        lastMagnitude: number;
        lastTime: number;
        accelerationSamples: number;
        timeout: ReturnType<typeof setTimeout>;
      }
    | undefined;

  connectedCallback() {
    if (!AppLightbox.#progressRegistered && "registerProperty" in CSS) {
      try {
        CSS.registerProperty({
          name: "--lightbox-progress",
          syntax: "<number>",
          inherits: true,
          initialValue: "1",
        });
      } catch {
        // Another lightbox instance may have registered it first.
      }
      AppLightbox.#progressRegistered = true;
    }
    this.#controller = new AbortController();
    this.#imageLoaded = false;
    this.#pendingImage = undefined;
    this.#render();
    this.#setupEventListeners(this.#controller.signal);

    this.#setPresentationState("closed");
    if (this.hasAttribute("close-button")) {
      this.dataset.closeButton = "";
    }

    // Eager loading if specified
    if (this.getAttribute("loading") === "eager") {
      this.#loadImage();
    }
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.close();
    this.#finishClose();
    this.#endWheelHandoff();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    if (name === "close-button") {
      if (newValue !== null) {
        this.dataset.closeButton = "";
      } else {
        delete this.dataset.closeButton;
      }
    }
    this.#closeButton?.toggleAttribute("hidden", !this.hasAttribute("close-button"));
    if (name === "close-button" && this.#phase === "open") this.#focus();
  }

  #render() {
    const customTrigger = this.querySelector<HTMLElement>(":scope > [slot=trigger]");
    if (customTrigger) {
      customTrigger.removeAttribute("slot");
      this.#triggerRoot = customTrigger;
      this.#triggerElement =
        customTrigger.querySelector<HTMLElement>("[data-lightbox-open]") ?? customTrigger;
    } else {
      let trigger = this.querySelector<HTMLButtonElement>(":scope > [data-lightbox-trigger]");
      if (!trigger) {
        trigger = document.createElement("button");
        trigger.type = "button";
        trigger.dataset.lightboxTrigger = "";
        for (const child of Array.from(this.childNodes)) {
          if (
            child instanceof HTMLTemplateElement ||
            (child instanceof Element && child.getAttribute("slot") === "content")
          )
            continue;
          trigger.append(child);
        }
        this.prepend(trigger);
      }
      this.#triggerRoot = trigger;
      this.#triggerElement = trigger;
    }
    this.#triggerElement!.dataset.lightboxTrigger = "";
    this.#triggerElement?.setAttribute("aria-haspopup", "dialog");
    this.#triggerElement?.setAttribute("aria-expanded", "false");

    // A body-level portal avoids transformed or clipped ancestors while staying
    // in the same style tree as authored shared elements.
    this.#overlay = document.createElement("div");
    this.#overlay.dataset.lightboxOverlay = "";
    this.#overlay.innerHTML = `
      <div data-lightbox-container>
        <div data-lightbox-backdrop></div>
        <div data-lightbox-dialog role="dialog" aria-modal="true"
             aria-label="Image viewer" tabindex="-1">
          <div data-lightbox-frame><img data-lightbox-media part="image" /></div>
          <button type="button" data-lightbox-close aria-label="Close">&times;</button>
          <span data-lightbox-status role="status" aria-live="polite" aria-atomic="true"></span>
        </div>
      </div>
    `;
    this.#dialog = this.#overlay.querySelector("[data-lightbox-dialog]");
    this.#backdrop = this.#overlay.querySelector("[data-lightbox-backdrop]");
    this.#image = this.#overlay.querySelector("[data-lightbox-media]");
    this.#standaloneImage = this.#image;
    this.#status = this.#overlay.querySelector("[data-lightbox-status]");
    this.#closeButton = this.#overlay.querySelector("[data-lightbox-close]");
    this.#closeButton!.hidden = !this.hasAttribute("close-button");
    this.#standaloneFrame = this.#overlay.querySelector("[data-lightbox-frame]");
    this.#frame = this.#standaloneFrame;
    this.#imageLoaded = false;
    const initialThumbnail = this.#ownThumbnail;
    this.#decodedPreviewSrc = initialThumbnail?.currentSrc || initialThumbnail?.src || "";
    this.#decodedPreviewWidth =
      initialThumbnail?.naturalWidth || Number(initialThumbnail?.getAttribute("width"));
    this.#decodedPreviewHeight =
      initialThumbnail?.naturalHeight || Number(initialThumbnail?.getAttribute("height"));
    const contentTemplate = this.querySelector<HTMLTemplateElement>(
      ':scope > template[slot="content"], :scope > template[data-lightbox-content]',
    );
    const slottedContent = this.querySelector<HTMLElement>(
      ':scope > [slot="content"]:not(template)',
    );
    const authoredTarget = customTrigger?.querySelector<HTMLElement>(
      "[data-lightbox-target], video, audio",
    );
    if (contentTemplate || slottedContent || authoredTarget) {
      const content = document.createElement("div");
      content.dataset.lightboxContent = "";
      content.part.add("content");
      if (contentTemplate) content.append(contentTemplate.content.cloneNode(true));
      const moveSelector = contentTemplate?.getAttribute("data-lightbox-move-trigger");
      if (slottedContent) {
        this.#portableContent = slottedContent;
      } else if (authoredTarget || (moveSelector !== null && customTrigger)) {
        const selector = moveSelector || "[data-lightbox-target], video, audio";
        this.#portableContent =
          authoredTarget ?? customTrigger?.querySelector<HTMLElement>(selector) ?? null;
      }
      if (this.#portableContent) {
        this.#portableMarker = document.createComment("lightbox-content-home");
        this.#portableContent.after(this.#portableMarker);
      }
      const sizedElement = this.#portableContent ?? content.firstElementChild;
      const width = Number(sizedElement?.getAttribute("width"));
      const height = Number(sizedElement?.getAttribute("height"));
      if (width > 0 && height > 0) {
        content.dataset.sized = "";
        content.style.setProperty("--lightbox-content-ratio", String(width / height));
        content.style.setProperty("--lightbox-content-inverse-ratio", String(height / width));
      }
      this.#standaloneImage!.replaceWith(content);
      this.#image = content;
      this.#standaloneImage = content;
      this.#imageLoaded = true;
      if (contentTemplate?.hasAttribute("slot") || slottedContent) {
        const preview = this.#previewSource(initialThumbnail);
        if (preview) {
          const proxy = new Image();
          proxy.dataset.lightboxContentPreview = "";
          proxy.src = preview;
          proxy.alt = "";
          proxy.setAttribute("aria-hidden", "true");
          content.prepend(proxy);
        }
      }
    }
  }

  #setupEventListeners(signal: AbortSignal) {
    const trigger = this.#triggerElement!;
    trigger.addEventListener("click", () => this.open(), { signal });
    for (const close of this.querySelectorAll<HTMLElement>("[data-lightbox-close]")) {
      close.addEventListener("click", () => this.close(), { signal });
    }
    trigger.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event instanceof PointerEvent &&
          event.isPrimary &&
          !this.closest("app-gallery") &&
          !(event.target instanceof Element && event.target.closest("[data-lightbox-open]"))
        )
          this.#prepareOpen();
      },
      { signal, passive: true },
    );
    trigger.addEventListener(
      "pointerup",
      () => {
        clearTimeout(this.#prepareCleanup);
        this.#prepareCleanup = setTimeout(() => this.#discardPreparation(), 250);
      },
      { signal, passive: true },
    );
    trigger.addEventListener("pointercancel", () => this.#discardPreparation(), {
      signal,
      passive: true,
    });
    this.#closeButton!.addEventListener("click", () => this.#toggle(), { signal });
    this.#overlay!.addEventListener(
      "click",
      (event) => {
        if (this.#suppressClick) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (event instanceof MouseEvent && this.#zoom?.handleClick(event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        const target = event.target as HTMLElement;
        if (
          target === this.#backdrop ||
          target === this.#dialog ||
          target.matches("[data-lightbox-slide], [data-lightbox-slides], [data-lightbox-container]")
        )
          this.#toggle();
      },
      { signal, capture: true },
    );
  }

  #updateCloseTarget() {
    const thumbnail = this.#thumbnailImg;
    const frameEffect = this.#animations[0]?.effect;
    const imageEffect = this.#animations[1]?.effect;
    const radiusEffect = this.#animations[2]?.effect;
    if (
      !thumbnail ||
      !(frameEffect instanceof KeyframeEffect) ||
      !(imageEffect instanceof KeyframeEffect) ||
      !(radiusEffect instanceof KeyframeEffect) ||
      !this.#flightImage
    )
      return;
    // Only viewport resize can invalidate document geometry; no scroll-time work.
    const rect = thumbnail.getBoundingClientRect();
    const origin = this.#flightOrigin;
    const scale = Math.max(rect.width / origin.width, rect.height / origin.height);
    const x = Math.max(0, (origin.width - rect.width / scale) / 2);
    const y = Math.max(0, (origin.height - rect.height / scale) / 2);
    this.#closeTarget = new DOMMatrix()
      .translate(
        rect.left + window.scrollX - origin.x - x * scale,
        rect.top + window.scrollY - origin.y - y * scale,
      )
      .scale(scale);
    this.#closeTargetClip = { x, y, radii: this.#thumbnailRadii };
    const start = cropPose(
      new DOMMatrix(this.#closeStartTransform === "none" ? undefined : this.#closeStartTransform),
      this.#closeStartClip,
      origin.width,
      origin.height,
    );
    const target = cropPose(this.#closeTarget, this.#closeTargetClip, origin.width, origin.height);
    frameEffect.setKeyframes([
      { transform: start.frame.toString() },
      { transform: target.frame.toString() },
    ]);
    imageEffect.setKeyframes([
      { transform: start.image.toString() },
      { transform: target.image.toString() },
    ]);
    radiusEffect.setKeyframes([
      { borderRadius: start.borderRadius },
      { borderRadius: target.borderRadius },
    ]);
  }

  get #thumbnailImg(): HTMLElement | null {
    if (!this.#gallery) return this.#ownPreview;
    const item = this.#gallery.item;
    const previewMore = this.#previewMore;
    if (previewMore && this.#usesPreviewMore(item.trigger))
      return previewMore.#ownPreview ?? previewMore;
    return item.preview ?? item.thumbnail;
  }

  #usesPreviewMore(trigger = this.#gallery?.item.trigger) {
    const previewMore = this.#previewMore;
    return (
      !!previewMore &&
      trigger instanceof AppLightbox &&
      (trigger === previewMore || trigger.hasAttribute("data-lightbox-preview-hidden"))
    );
  }

  get #previewMore(): AppLightbox | null {
    const trigger = this.#gallery?.item.trigger;
    const group =
      trigger?.closest<AppGallery>("app-gallery") ?? this.closest<AppGallery>("app-gallery");
    return (
      group?.querySelector<AppLightbox>(":scope > app-lightbox[data-lightbox-preview-more]") ?? null
    );
  }

  #setPreviewMoreSource(source: string) {
    if (!this.#gallery) return;
    const item = this.#gallery.item;
    if (
      !(item.trigger instanceof AppLightbox) ||
      !item.trigger.hasAttribute("data-lightbox-preview-hidden")
    )
      return;
    const previewMore = this.#previewMore;
    const thumbnail = previewMore ? previewMore.#ownThumbnail : null;
    if (!previewMore || !thumbnail || !source) return;
    previewMore.dataset.lightboxPreviewIndex = String(this.#gallery.index);
    const picture = thumbnail.closest("picture");
    if (picture && previewMore.#triggerRoot?.contains(picture)) {
      let proxy = picture.parentElement?.querySelector<HTMLImageElement>(
        ":scope > [data-lightbox-preview-proxy]",
      );
      if (!proxy) {
        proxy = new Image();
        proxy.dataset.lightboxPreviewProxy = "";
        proxy.setAttribute("aria-hidden", "true");
        picture.after(proxy);
        picture.dataset.lightboxPreviewSourceHidden = "";
      }
      proxy.src = source;
      proxy.alt = item.alt;
      return;
    }
    thumbnail.src = source;
    thumbnail.dataset.src = source;
    thumbnail.alt = item.alt;
    const preview = previewMore.#ownPreview;
    if (preview && !preview.contains(thumbnail) && !(preview instanceof HTMLImageElement)) {
      let proxy = preview.querySelector<HTMLImageElement>("[data-lightbox-preview-proxy]");
      if (!proxy) {
        proxy = new Image();
        proxy.dataset.lightboxPreviewProxy = "";
        preview.prepend(proxy);
      }
      proxy.src = source;
      proxy.alt = item.alt;
    }
  }

  #warmPreviewMore() {
    if (!this.#gallery) return;
    const gallery = this.#gallery;
    const index = gallery.index;
    const item = gallery.item;
    if (item.trigger === this.#previewMore) {
      this.#resetPicturePreviewMore();
      return;
    }
    if (
      !(item.trigger instanceof AppLightbox) ||
      !item.trigger.hasAttribute("data-lightbox-preview-hidden")
    )
      return;
    const source = item.src;
    if (!source) return;
    const loader = new Image();
    loader.src = source;
    void loader
      .decode()
      .then(() => {
        if (this.#gallery !== gallery || gallery.index !== index) return;
        this.#setPreviewMoreSource(source);
      })
      .catch(() => {
        // The existing decoded teaser remains visible if warming fails.
      });
  }

  #syncPreviewMore() {
    const item = this.#gallery?.item;
    if (item?.trigger === this.#previewMore) this.#resetPicturePreviewMore();
    else if (item?.src) this.#setPreviewMoreSource(item.src);
  }

  #resetPicturePreviewMore() {
    const previewMore = this.#previewMore;
    if (!previewMore) return;
    const picture = previewMore.#ownThumbnail?.closest("picture");
    if (!picture?.hasAttribute("data-lightbox-preview-source-hidden")) return;
    picture.parentElement?.querySelector(":scope > [data-lightbox-preview-proxy]")?.remove();
    delete picture.dataset.lightboxPreviewSourceHidden;
    delete previewMore.dataset.lightboxPreviewIndex;
  }

  #mountTransitionLayer(frame: HTMLElement, progress?: number, measure = true) {
    const previewMore = this.#previewMore;
    const transitionOwner =
      previewMore && this.#usesPreviewMore()
        ? previewMore
        : this.#gallery?.item.trigger instanceof AppLightbox
          ? this.#gallery.item.trigger
          : this;
    const layer =
      this.#transitionLayer ??
      transitionOwner.querySelector<HTMLElement>("[data-lightbox-transition-layer]");
    if (!layer) return null;
    if (!this.#transitionLayerMarker) {
      this.#transitionLayerMarker = document.createComment("lightbox-transition-layer");
      layer.before(this.#transitionLayerMarker);
      const style = getComputedStyle(layer);
      for (const property of [
        "--lightbox-layer-color",
        "--lightbox-layer-mask-opacity",
        "--lightbox-transition-layer-opacity",
        "--lightbox-transition-content-opacity",
      ]) {
        layer.style.setProperty(property, style.getPropertyValue(property));
      }
      const sourceLabel = layer.querySelector<HTMLElement>("[data-lightbox-more-label]");
      if (sourceLabel) {
        const labelStyle = getComputedStyle(sourceLabel);
        sourceLabel.style.setProperty("--lightbox-label-color", labelStyle.color);
        sourceLabel.style.setProperty("--lightbox-label-font", labelStyle.font);
        sourceLabel.style.setProperty("--lightbox-label-letter-spacing", labelStyle.letterSpacing);
        sourceLabel.style.setProperty("--lightbox-label-text-shadow", labelStyle.textShadow);
      }
      const content = document.createElement("div");
      content.dataset.lightboxTransitionContent = "";
      for (const child of Array.from(layer.children)) {
        const marker = document.createComment("lightbox-transition-content");
        child.before(marker);
        this.#transitionContentMarkers.push(marker);
        content.append(child);
      }
      document.body.append(content);
      this.#transitionContent = content;
      content.style.setProperty(
        "--lightbox-transition-content-opacity",
        style.getPropertyValue("--lightbox-transition-content-opacity"),
      );
      this.#setTransitionPhase("preview");
    }
    if (progress !== undefined) {
      layer.style.setProperty("--lightbox-progress", String(progress));
      this.#transitionContent?.style.setProperty("--lightbox-progress", String(progress));
    }
    frame.append(layer);
    this.#transitionLayer = layer;
    if (this.#transitionContent && measure) this.#prepareTransitionBounds();
    return layer;
  }

  #restoreTransitionLayer() {
    this.#setTransitionPhase("preview");
    if (this.#transitionLayer && this.#transitionLayerMarker?.isConnected) {
      this.#transitionLayerMarker.replaceWith(this.#transitionLayer);
      this.#transitionLayer.style.removeProperty("--lightbox-progress");
      delete this.#transitionLayer.dataset.lightboxPhase;
    }
    if (this.#transitionContent) {
      for (const target of this.#transitionCounterScaleTargets()) {
        target.style.removeProperty("--lightbox-transition-counter-transform");
      }
      const children = Array.from(this.#transitionContent.children);
      for (const [index, child] of children.entries()) {
        this.#transitionContentMarkers[index]?.replaceWith(child);
      }
      this.#transitionContent.remove();
    }
    this.#transitionContent = undefined;
    this.#transitionContentMarkers = [];
    this.#transitionLayer = undefined;
    this.#transitionLayerMarker = undefined;
  }

  #attachPreparedTransitionLayer() {
    // #animate measured the untransformed, open frame before pausing at the
    // thumbnail pose. Reusing that geometry avoids measuring the transformed
    // frame and applying its thumbnail scale twice to the detached plane.
    const layer = this.#mountTransitionLayer(this.#frame!, undefined, false);
    const frameEffect = this.#animations[0]?.effect;
    if (!layer || !(frameEffect instanceof KeyframeEffect)) return layer;
    const timing = frameEffect.getComputedTiming();
    this.#setTransitionPhase("opening");
    layer.style.setProperty("--lightbox-progress", "0");
    this.#transitionContent?.style.setProperty("--lightbox-progress", "0");
    const animation = new Animation(
      new KeyframeEffect(layer, this.#transitionProgressMotion(1, 0), {
        duration: timing.duration,
        easing: "linear",
        fill: "both",
      }),
      document.timeline,
    );
    animation.currentTime = 0;
    this.#animations.push(animation);
    if (this.#transitionContent) {
      const contentMotion = this.#preparedTransitionContentMotion;
      const finalMotion = contentMotion.at(-1);
      this.#applyTransitionContentTransform(finalMotion);
      const contentAnimation = new Animation(
        new KeyframeEffect(this.#transitionContent, contentMotion, {
          duration: timing.duration,
          easing: "linear",
          fill: "both",
        }),
        document.timeline,
      );
      contentAnimation.currentTime = 0;
      this.#animations.push(contentAnimation);
      const counterScaleMotion = this.#transitionCounterScaleMotion(contentMotion);
      for (const target of this.#transitionCounterScaleTargets()) {
        const counterScaleAnimation = new Animation(
          new KeyframeEffect(target, counterScaleMotion, {
            duration: timing.duration,
            easing: "linear",
            fill: "both",
          }),
          document.timeline,
        );
        counterScaleAnimation.currentTime = 0;
        this.#animations.push(counterScaleAnimation);
      }
      const progressAnimation = new Animation(
        new KeyframeEffect(this.#transitionContent, this.#transitionProgressMotion(1, 0), {
          duration: timing.duration,
          easing: "linear",
          fill: "both",
        }),
        document.timeline,
      );
      progressAnimation.currentTime = 0;
      this.#animations.push(progressAnimation);
    }
    return layer;
  }

  #transitionProgressMotion(from: number, to: number): Keyframe[] {
    return [
      { "--lightbox-progress": String(from) },
      { "--lightbox-progress": String(to) },
    ] as Keyframe[];
  }

  #setTransitionPhase(phase: TransitionPhase) {
    for (const target of [this.#transitionLayer, this.#transitionContent]) {
      if (target) target.dataset.lightboxPhase = phase;
    }
  }

  #setPresentationState(state: "closed" | "opening" | "open" | "closing") {
    for (const target of [this, this.#overlay, this.#dialog]) {
      if (!target) continue;
      target.dataset.lightboxState = state;
      target.toggleAttribute("data-open", state !== "closed");
      target.toggleAttribute("data-closed", state === "closed");
      target.toggleAttribute("data-starting-style", state === "opening");
      target.toggleAttribute("data-ending-style", state === "closing");
    }
  }

  #transitionContentMotion(frameMotion: Keyframe[]): Keyframe[] {
    return frameMotion.map((keyframe) => ({
      offset: keyframe.offset,
      transform: keyframe.transform,
    }));
  }

  #transitionCounterScaleMotion(frameMotion: Keyframe[]): Keyframe[] {
    return frameMotion.map((keyframe) => {
      const transform = String(keyframe.transform ?? "none");
      const matrix = new DOMMatrix(transform === "none" ? undefined : transform);
      return {
        offset: keyframe.offset,
        transform: `scale(${1 / Math.max(0.0001, Math.abs(matrix.a))}, ${1 / Math.max(0.0001, Math.abs(matrix.d))})`,
      };
    });
  }

  #transitionCounterScaleTargets() {
    if (!this.#transitionContent) return [];
    return Array.from(this.#transitionContent.children).flatMap((child) => {
      if (!(child instanceof HTMLElement)) return [];
      const targets = Array.from(
        child.querySelectorAll<HTMLElement>("[data-lightbox-counter-scale]"),
      );
      return targets.length ? targets : [child];
    });
  }

  #applyTransitionContentTransform(keyframe?: Keyframe) {
    if (!this.#transitionContent || !keyframe) return;
    this.#transitionContent.style.setProperty(
      "--lightbox-transition-transform",
      String(keyframe.transform ?? "none"),
    );
  }

  #prepareTransitionBounds() {
    const frameRect = this.#frame!.getBoundingClientRect();
    this.#transitionOpenBounds = {
      left: frameRect.left + window.scrollX,
      top: frameRect.top + window.scrollY,
      width: frameRect.width,
      height: frameRect.height,
    };
    if (this.#transitionContent) {
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-width",
        `${frameRect.width}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-height",
        `${frameRect.height}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-left",
        `${frameRect.left + window.scrollX}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-top",
        `${frameRect.top + window.scrollY}px`,
      );
    }
  }

  #paintTransitionLayer(layer: HTMLElement, progress: number, frameTransform?: DOMMatrix) {
    layer.style.setProperty("--lightbox-progress", String(progress));
    if (this.#transitionContent) {
      this.#transitionContent.style.setProperty("--lightbox-progress", String(progress));
      this.#setTransitionPhase("dragging");
      if (frameTransform) {
        this.#transitionContent.style.setProperty(
          "--lightbox-transition-transform",
          frameTransform.toString(),
        );
        for (const target of this.#transitionCounterScaleTargets()) {
          target.style.setProperty(
            "--lightbox-transition-counter-transform",
            `scale(${1 / Math.max(0.0001, Math.abs(frameTransform.a))}, ${1 / Math.max(0.0001, Math.abs(frameTransform.d))})`,
          );
        }
      }
    }
  }

  get #ownPreview(): HTMLElement | null {
    const trigger = this.#triggerRoot ?? this.#triggerElement;
    if (!trigger) return null;

    if (this.hasAttribute("data-lightbox-preview-more")) {
      const proxy = trigger.querySelector<HTMLImageElement>("[data-lightbox-preview-proxy]");
      if (proxy) return proxy;
    }

    if (trigger.matches("[data-lightbox-preview]")) return trigger;
    const preview = trigger.querySelector<HTMLElement>("[data-lightbox-preview]");
    if (preview) return preview;

    if (trigger.matches("[data-lightbox-target]")) return trigger;
    const target = trigger.querySelector<HTMLElement>("[data-lightbox-target]");
    if (target) return target;

    if (trigger.matches("img, video")) return trigger;
    return (
      trigger.querySelector<HTMLElement>("img, video") ??
      this.#portableMarker?.parentElement ??
      null
    );
  }

  get #ownThumbnail(): HTMLImageElement | null {
    const explicit = this.querySelector<HTMLImageElement>(":scope > [data-lightbox-thumbnail]");
    if (explicit) return explicit;
    const trigger = this.#triggerRoot ?? this.#triggerElement;
    if (trigger instanceof HTMLImageElement) return trigger;
    return trigger?.querySelector("img") ?? null;
  }

  #previewSource(thumbnail = this.#ownThumbnail) {
    if (!thumbnail) return "";
    const source = thumbnail.currentSrc || thumbnail.src;
    if (thumbnail.complete && thumbnail.naturalWidth && source) {
      this.#decodedPreviewSrc = source;
      this.#decodedPreviewWidth = thumbnail.naturalWidth;
      this.#decodedPreviewHeight = thumbnail.naturalHeight;
      return source;
    }
    return this.#decodedPreviewSrc || source;
  }

  get #prefersReducedMotion(): boolean {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  #prepareGallery() {
    if (this.#phase !== "closed") return;
    const group = this.closest<AppGallery>("app-gallery");
    if (!(group instanceof AppGallery) || group.itemCount < 2) return;
    const ownIndex = group.source
      ? Number(this.dataset.lightboxSourceIndex)
      : group.lightboxes.indexOf(this);
    const proxyIndex = Number(this.dataset.lightboxPreviewIndex);
    const index =
      this.hasAttribute("data-lightbox-preview-more") &&
      Number.isInteger(proxyIndex) &&
      proxyIndex >= 0 &&
      proxyIndex < group.itemCount
        ? proxyIndex
        : ownIndex;
    if (
      index < 0 ||
      (this.#preparedGallery?.group === group && this.#preparedGallery.index === index)
    )
      return;
    this.#preparedGallery?.gallery.destroy();
    const lightboxes = group.lightboxes;
    const source = group.source;
    const items: GalleryItemSource | GalleryItem[] = source
      ? {
          length: source.count,
          get: (itemIndex) => {
            const data = source.getItem(itemIndex);
            const origin = source.getOrigin?.(data.id) ?? null;
            const thumbnail =
              origin instanceof HTMLImageElement
                ? origin
                : (origin?.querySelector<HTMLImageElement>("img") ?? null);
            return {
              id: data.id,
              trigger: origin ?? this,
              preview: thumbnail,
              thumbnail,
              thumbnailSrc: data.thumbnailSrc,
              previewSrc: data.previewSrc ?? data.thumbnailSrc,
              src: data.src,
              alt: data.alt ?? "",
              width: data.width,
              height: data.height,
            };
          },
        }
      : lightboxes.map((lightbox, itemIndex) => {
          const hiddenSelectionPreview =
            itemIndex === index &&
            lightbox.hasAttribute("data-lightbox-preview-hidden") &&
            this.hasAttribute("data-lightbox-preview-more")
              ? this.#ownPreview instanceof HTMLImageElement
                ? this.#ownPreview
                : this.#ownThumbnail
              : null;
          const thumbnail = lightbox.#ownThumbnail;
          const customContent = !(lightbox.#standaloneImage instanceof HTMLImageElement);
          return {
            trigger: lightbox,
            preview: lightbox.#ownPreview,
            thumbnail,
            openingPreview: hiddenSelectionPreview,
            previewSrc: lightbox.#previewSource(thumbnail),
            src:
              lightbox.getAttribute("src") ||
              (customContent ? thumbnail?.dataset.src : undefined) ||
              thumbnail?.currentSrc ||
              "",
            alt: lightbox.getAttribute("alt") || thumbnail?.alt || "",
            content: customContent ? (lightbox.#standaloneImage ?? undefined) : undefined,
            mount: customContent
              ? () => {
                  lightbox.#mountPortableContent();
                }
              : undefined,
            restore: customContent
              ? () => {
                  if (lightbox.#standaloneImage && lightbox.#standaloneFrame) {
                    lightbox.#standaloneFrame.append(lightbox.#standaloneImage);
                  }
                  lightbox.#restorePortableContent();
                }
              : undefined,
          };
        });
    this.#preparedGallery = {
      group,
      index,
      gallery: new GalleryStrip(items, index, this.#onGalleryChange),
    };
  }

  #mountFilmstrip(group: AppGallery, gallery = this.#gallery) {
    const marker = Array.from(group.children).find(
      (child): child is AppFilmstrip => child instanceof AppFilmstrip,
    );
    if (!marker || !gallery || this.#filmstrip) return;
    this.#filmstrip = marker.createSession(gallery.items, gallery.index, (index) => {
      if (this.#phase !== "open" || !this.#gallery || index === this.#gallery.index) return;
      this.#zoom?.suspend();
      this.#completeOpening();
      this.#gallery.select(index);
    });
    this.#filmstripDock = document.createElement("div");
    this.#filmstripDock.dataset.lightboxFilmstripDock = "";
    this.#filmstripDock.append(this.#filmstrip.element);
    this.#dialog!.dataset.filmstrip = "";
    this.#dialog!.append(this.#filmstripDock);
    this.#filmstrip.mount(gallery.index);
  }

  #applyOverlayTheme() {
    const style = getComputedStyle(this);
    for (const name of [
      "--radius",
      "--background",
      "--color",
      "--accent",
      "--border",
      "--primary",
    ]) {
      this.#overlay!.style.setProperty(name, style.getPropertyValue(name));
    }
    this.#viewportWidth = window.innerWidth;
    this.#overlay!.style.setProperty("--lightbox-height", `${window.innerHeight}px`);
  }

  #prepareOpen() {
    if (this.#phase !== "closed" || this.#preparedOverlay || !this.#overlay) return;
    this.#prepareGallery();
    const prepared = this.#preparedGallery;
    if (!prepared) return;
    this.#backgroundSelection = prepared.index;
    this.#standaloneFrame!.remove();
    this.#dialog!.dataset.lightboxGallery = "";
    this.#dialog!.dataset.opening = "";
    this.#dialog!.prepend(prepared.gallery.element);
    this.#mountFilmstrip(prepared.group, prepared.gallery);
    this.#image = prepared.gallery.active.image;
    this.#frame = prepared.gallery.active.frame;
    this.#applyOverlayTheme();
    this.#overlay.dataset.lightboxPrepared = "";
    document.body.append(this.#overlay);
    prepared.gallery.mount();
    this.#preparedOverlay = true;
    this.#animate(true, undefined, true);
    this.#preparedOpening = true;
  }

  #discardPreparation() {
    if (this.#phase !== "closed" || !this.#preparedOverlay) return;
    clearTimeout(this.#prepareCleanup);
    this.#prepareCleanup = undefined;
    this.#cancelAnimations();
    this.#preparedGallery?.gallery.destroy();
    this.#preparedGallery = undefined;
    this.#filmstrip?.destroy();
    this.#filmstrip = undefined;
    this.#filmstripDock?.remove();
    this.#filmstripDock = undefined;
    this.#restoreTransitionLayer();
    if (this.#dialog) delete this.#dialog.dataset.filmstrip;
    this.#overlay?.remove();
    if (this.#overlay) delete this.#overlay.dataset.lightboxPrepared;
    if (this.#dialog) delete this.#dialog.dataset.lightboxGallery;
    if (this.#dialog) delete this.#dialog.dataset.opening;
    this.#dialog?.prepend(this.#standaloneFrame!);
    this.#image = this.#standaloneImage;
    this.#frame = this.#standaloneFrame;
    this.#preparedOverlay = false;
    this.#preparedOpening = false;
  }

  public get isOpen() {
    return this.#phase === "open";
  }

  public select(index: number) {
    if (this.#phase === "open" && this.#gallery) this.#gallery.select(index);
  }

  public open() {
    clearTimeout(this.#prepareCleanup);
    this.#prepareCleanup = undefined;
    if (this.#phase === "closing") {
      this.#reverseClose();
      return;
    }
    if (this.#phase === "open" || !this.isConnected || !this.#overlay || !this.#image) return;
    this.#endWheelHandoff();
    if (!("inert" in HTMLElement.prototype) || !this.#image.animate) {
      throw new Error(
        "The lightbox requires browser support for inert and the Web Animations API.",
      );
    }
    const switchingImage = AppLightbox.#active !== null;
    if (AppLightbox.#active) {
      AppLightbox.#active.close();
      if (AppLightbox.#active) AppLightbox.#active.#finishClose();
    }
    AppLightbox.#active = this;
    this.#mountPortableContent();
    for (const image of this.#standaloneImage?.querySelectorAll<HTMLImageElement>(
      "img[data-src]",
    ) ?? []) {
      triggerLoad(image);
    }
    const group = this.closest<AppGallery>("app-gallery");
    if (group instanceof AppGallery && group.itemCount > 1) {
      if (!this.#preparedOverlay) this.#prepareOpen();
      this.#gallery = this.#preparedGallery?.gallery;
      this.#preparedGallery = undefined;
      if (!this.#gallery) return;
      this.#backgroundSelection = this.#gallery.index;
      this.#galleryTrigger = this;
      this.#gallerySelectionIndex = this.#gallery.index;
      this.#image = this.#gallery.active.image;
      this.#frame = this.#gallery.active.frame;
      this.#mountFilmstrip(group);
    } else {
      this.#loadImage(true);
      this.#frame = this.#standaloneFrame;
    }
    let focused = document.activeElement;
    this.#returnFocus =
      !switchingImage && focused instanceof HTMLElement && focused !== document.body
        ? focused
        : this.#triggerElement;
    if (!this.#preparedOverlay) {
      this.#applyOverlayTheme();
      document.body.append(this.#overlay);
    } else {
      delete this.#overlay.dataset.lightboxPrepared;
    }
    this.#phase = "open";
    this.#setPresentationState("opening");
    this.#triggerElement!.setAttribute("aria-expanded", "true");
    this.#dialog!.setAttribute("aria-label", this.#contentLabel);
    this.#isolateBackground();
    if (!this.#preparedOverlay) this.#gallery?.mount();
    this.#preparedOverlay = false;
    this.#observer = new MutationObserver(() => this.#isolateBackground());
    this.#observer.observe(document.body, { childList: true });
    this.#modalController = new AbortController();
    const { signal } = this.#modalController;
    document.addEventListener("keydown", this.#onKeydown, { capture: true, signal });
    document.addEventListener("focusin", this.#onFocus, { capture: true, signal });
    window.addEventListener("resize", this.#onResize, { signal });
    window.visualViewport?.addEventListener("resize", this.#onResize, { signal });
    this.#suppressClick = false;
    const root = this.#overlay.querySelector<HTMLElement>("[data-lightbox-container]")!;
    root.addEventListener("touchstart", this.#onTouchStart, { passive: true, signal });
    root.addEventListener("touchmove", this.#onTouchMove, { passive: false, signal });
    root.addEventListener("touchend", this.#onTouchEnd, { passive: true, signal });
    root.addEventListener("touchcancel", () => this.#endDrag(true), { passive: true, signal });
    root.addEventListener("wheel", this.#onWheel, { passive: false, signal });
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse") this.#suppressClick = false;
      },
      { passive: true, signal },
    );
    this.#zoom = this.#zoomableImage(this.#image)
      ? new LightboxZoom(root, {
          prepare: () => this.#prepareZoom(),
          config: () => {
            const trigger = this.#gallery?.item.trigger ?? this;
            const max = Number(trigger.getAttribute("max-zoom") ?? 4);
            const step = Number(trigger.getAttribute("zoom-step") ?? 2);
            if (
              !Number.isFinite(max) ||
              max <= 1 ||
              !Number.isFinite(step) ||
              step <= 1 ||
              step > max
            )
              throw new Error(
                "Lightbox zoom-step must be greater than 1 and no greater than max-zoom.",
              );
            return { max, step };
          },
          state: (locked) => {
            const dialog = this.#dialog!;
            const wasZoomed = dialog.hasAttribute("data-zoomed");
            if (locked && !dialog.hasAttribute("data-zoomed")) {
              dialog.style.setProperty(
                "--lightbox-zoom-scroll-offset",
                `${this.#gallery?.element.scrollLeft ?? 0}px`,
              );
            }
            dialog.toggleAttribute("data-zoomed", locked);
            if (!locked) {
              dialog.style.removeProperty("--lightbox-zoom-scroll-offset");
              if (wasZoomed && this.#gallery) this.#gallery.select(this.#gallery.index);
            }
          },
          close: () => this.close(),
          reducedMotion: () => this.#prefersReducedMotion,
        })
      : undefined;
    if (this.#preparedOpening) {
      this.#preparedOpening = false;
      this.#attachPreparedTransitionLayer();
      this.#hideThumbnail();
      const timelineTime = Number(document.timeline.currentTime ?? 0);
      for (const animation of this.#animations) {
        animation.play();
        animation.currentTime = 0;
        animation.startTime = timelineTime;
      }
    } else {
      this.#hideThumbnail();
      this.#animate(true);
    }
    if (this.#filmstrip && this.#dialog?.hasAttribute("data-opening")) {
      this.#dialog.dataset.filmstripRevealing = "";
    }
    if (this.#transitionContent?.querySelector("[data-lightbox-video-actions]")) {
      this.#transitionContent.style.setProperty(
        "--lightbox-controls-reveal-delay",
        `${this.#openingControlsRevealDelay}ms`,
      );
      this.#transitionContent.dataset.lightboxControlsRevealing = "";
    }
    this.#focus();
    this.dispatchEvent(new CustomEvent("lightbox-open", { bubbles: true }));
  }

  #prepareZoom() {
    if (this.#phase === "closed" || !this.#zoomableImage(this.#image) || !this.#frame) return null;
    if (this.#phase === "closing") this.#reverseClose();
    const transform = getComputedStyle(this.#image).transform;
    this.#dragGesture.cancel();
    this.#revision++;
    this.#cancelAnimations();
    this.#completeOpening();
    this.#image.style.setProperty("--lightbox-media-transform", transform);
    this.#backdrop!.style.setProperty("--lightbox-backdrop-opacity", "1");
    return { image: this.#image, frame: this.#frame };
  }

  #zoomableImage(image: HTMLElement | null): image is HTMLElement {
    return image instanceof HTMLImageElement || !!image?.querySelector(":scope > picture > img");
  }

  #toggle() {
    if (this.#phase === "closing") this.#reverseClose();
    else this.close();
  }

  #reverseClose() {
    if (!this.#flightFrame || !this.#flightImage || !this.#image || !this.#frame) return;
    this.#endWheelHandoff();
    this.#restoreOverlayEdges();
    if (!this.#overlay!.isConnected) document.body.append(this.#overlay!);
    // Capture the visible pose before removing the document-scrolling image.
    const visible = this.#flightImage.getBoundingClientRect();
    const frame = this.#frame.getBoundingClientRect();
    const width = this.#image.offsetWidth;
    const height = this.#image.offsetHeight;
    const opacity = getComputedStyle(this.#backdrop!).opacity;
    const closeOpacity = getComputedStyle(this.#closeButton!).opacity;
    const crop = this.#readCropPose(this.#flightFrame, this.#flightImage);
    const transform = `translate(${visible.left - frame.left}px, ${visible.top - frame.top}px) scale(${visible.width / width}, ${visible.height / height})`;
    if (this.#flightUsesLiveContent) {
      this.#frame.append(this.#image);
      this.#restoreLiveContentStyle();
      this.#flightUsesLiveContent = false;
    }
    this.#phase = "open";
    this.#setTriggerState(this.#gallery?.item.trigger || this, true);
    this.#animate(true, {
      transform,
      opacity,
      closeOpacity,
      clip: crop.clip,
    });
    this.dispatchEvent(new CustomEvent("lightbox-open", { bubbles: true }));
  }

  public close() {
    if (this.#phase !== "open") return;
    if (this.#dialog) delete this.#dialog.dataset.filmstripRevealing;
    if (this.#transitionContent) delete this.#transitionContent.dataset.lightboxControlsRevealing;
    this.#zoom?.suspend();
    const release = this.#dragGesture.finish();
    if (release) this.#paintDrag(release.state);
    this.#gallery?.sync();
    this.#syncPreviewMore();
    if (this.#gallery) {
      const group = this.closest<AppGallery>("app-gallery");
      if (group?.source) {
        const id = this.#gallery.item.id;
        const origin = id ? group.source.getOrigin?.(id) : null;
        this.#returnFocus = origin?.isConnected ? origin : group;
      } else {
        const trigger = this.#gallery.item.trigger;
        this.#returnFocus = trigger instanceof AppLightbox ? trigger.#triggerElement : trigger;
      }
    }
    this.#phase = "closing";
    this.#setPresentationState("closing");
    this.#triggerElement!.setAttribute("aria-expanded", "false");
    this.#animate(false);
    this.dispatchEvent(new CustomEvent("lightbox-close", { bubbles: true }));
    if (this.#gallery) this.#setTriggerState(this.#gallery.item.trigger, false);
  }

  #setTriggerState(trigger: HTMLElement, open: boolean) {
    trigger.dataset.lightboxState = open ? "open" : "closed";
    trigger.toggleAttribute("data-open", open);
    trigger.toggleAttribute("data-closed", !open);
    if (trigger instanceof AppLightbox) {
      trigger.#triggerElement?.setAttribute("aria-expanded", String(open));
    }
  }

  #onGalleryChange = (_index: number, settled: boolean) => {
    if (this.#phase !== "open" || !this.#gallery) return;
    if (!settled) this.#completeOpening();
    const changed = this.#gallerySelectionIndex !== this.#gallery.index;
    if (changed) {
      const outgoingVideo =
        this.#image instanceof HTMLVideoElement
          ? this.#image
          : this.#image?.querySelector<HTMLVideoElement>("video");
      outgoingVideo?.pause();
      this.#zoom?.suspend();
      this.#image?.style.removeProperty("--lightbox-media-transform");
      if (this.#galleryTrigger) this.#setTriggerState(this.#galleryTrigger, false);
      this.#galleryTrigger = this.#gallery.item.trigger;
      this.#gallerySelectionIndex = this.#gallery.index;
      this.#setTriggerState(this.#galleryTrigger, true);
    }
    this.#image = this.#gallery.active.image;
    this.#frame = this.#gallery.active.frame;
    if (settled) this.#filmstrip?.settle(this.#gallery.index);
    else {
      const filmstripControls = this.#filmstrip?.controlling ?? false;
      this.#filmstrip?.sync(this.#gallery.index, !filmstripControls, !filmstripControls);
    }
    this.#warmPreviewMore();
    this.#restoreTransitionLayer();
    const transitionLayer = settled ? this.#mountTransitionLayer(this.#frame, 0) : null;
    if (transitionLayer && this.#transitionContent) {
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-width",
        `${this.#transitionOpenBounds.width}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-height",
        `${this.#transitionOpenBounds.height}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-left",
        `${this.#transitionOpenBounds.left}px`,
      );
      this.#transitionContent.style.setProperty(
        "--lightbox-transition-top",
        `${this.#transitionOpenBounds.top}px`,
      );
      this.#transitionContent.style.setProperty("--lightbox-transition-transform", "none");
      this.#setTransitionPhase("open");
    }
    this.#hideThumbnail();
    if (settled) {
      this.#status!.textContent = `Item ${this.#gallery.index + 1} of ${this.#gallery.items.length}`;
      this.#dialog!.setAttribute("aria-label", this.#gallery.item.alt || "Media viewer");
    }
    if (settled && this.#gallery.index !== this.#backgroundSelection) {
      this.#backgroundSelection = this.#gallery.index;
      // Only navigation changes the background; opening preserves the reading position.
      const trigger = this.#gallery.item.trigger;
      const group = trigger.closest("app-gallery");
      if (group instanceof AppGallery && trigger instanceof AppLightbox) {
        group.scrollItemIntoView(trigger);
      }
    }
    if (changed)
      this.dispatchEvent(
        new CustomEvent("lightbox-change", {
          bubbles: true,
          detail: {
            index: this.#gallery.index,
            id: this.#gallery.item.id,
            lightbox: this.#gallery.item.trigger,
          },
        }),
      );
  };

  #restoreThumbnail() {
    if (!this.#hiddenThumbnail) return;
    delete this.#hiddenThumbnail.dataset.lightboxThumbnailHidden;
    this.#hiddenThumbnail = null;
  }

  #hideThumbnail() {
    const thumbnail = this.#thumbnailImg;
    if (thumbnail === this.#hiddenThumbnail) return;
    this.#restoreThumbnail();
    if (!thumbnail) return;
    this.#hiddenThumbnail = thumbnail;
    thumbnail.dataset.lightboxThumbnailHidden = "";
  }

  #completeOpening() {
    this.#setTransitionPhase("open");
    this.#setPresentationState("open");
    if (this.#standaloneImage) this.#revealContent(this.#standaloneImage);
    for (const slide of this.#gallery?.slides.values() ?? []) {
      if (slide.image.hasAttribute("data-lightbox-item-content")) this.#revealContent(slide.image);
    }
    for (const property of [
      "--lightbox-drag-x",
      "--lightbox-drag-y",
      "--lightbox-dismiss-progress",
    ]) {
      this.#overlay?.style.removeProperty(property);
    }
    if (!this.#dragGesture.active && !this.#takingDragOwnership) {
      this.#wheelDirection = 0;
      if (this.#dialog) delete this.#dialog.dataset.dismissing;
      this.#gallery?.resume();
    }
    if (!this.#dialog?.hasAttribute("data-opening")) return;
    this.#revision++;
    delete this.#dialog.dataset.opening;
    delete this.#dialog.dataset.filmstripRevealing;
    this.#dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    if (this.#transitionContent) {
      delete this.#transitionContent.dataset.lightboxControlsRevealing;
      this.#transitionContent.style.removeProperty("--lightbox-controls-reveal-delay");
    }
    this.#cancelAnimations();
    this.#gallery?.opened();
    this.#filmstrip?.activate(this.#gallery?.index);
  }

  #revealContent(content: HTMLElement) {
    const image = content.querySelector<HTMLImageElement>(
      "img:not([data-lightbox-content-preview])",
    );
    if (!image) {
      content.setAttribute("data-content-revealed", "");
      return;
    }
    if (image.hasAttribute("data-src")) {
      image.addEventListener("load", () => this.#revealContent(content), { once: true });
      return;
    }
    void image
      .decode()
      .then(() => {
        if (this.#phase === "open") content.setAttribute("data-content-revealed", "");
      })
      .catch(() => {});
  }

  #beginDrag(wheel = false) {
    if (this.#dragGesture.active || this.#phase === "closed") return;
    this.#takingDragOwnership = true;
    // Transfer ownership before dragging. A previous zoom-to-fit still retains
    // the image; suspending it at release would repaint over the dragged pose.
    this.#zoom?.suspend();
    if (this.#phase === "closing") this.#reverseClose();
    try {
      this.#gallery?.freeze();
      this.#gallery?.sync();
    } finally {
      this.#takingDragOwnership = false;
    }
    const current = this.#readCropPose();
    const matrix = current.transform;
    const opacity = Number(getComputedStyle(this.#backdrop!).opacity);
    const closeOpacity = Number(getComputedStyle(this.#closeButton!).opacity);
    const borderRadii = current.clip.radii;
    const width = this.#image!.offsetWidth;
    const height = this.#image!.offsetHeight;
    const currentClip = current.clip;
    const targetPose = this.#thumbnailPose();
    const wheelTarget = wheel ? new DOMMatrix(targetPose.transform) : undefined;
    // Keep a single full-size reference even when grabbing a settling image.
    const wheelOffset = !wheelTarget
      ? 0
      : matrix.a > 1
        ? 180 * Math.log(Math.max(0.001, 1 - (matrix.a - 1) / 0.12))
        : Math.abs(1 - wheelTarget.a) > 0.001
          ? (360 * (1 - matrix.a)) / (1 - wheelTarget.a)
          : Math.abs(1 - wheelTarget.d) > 0.001
            ? (360 * (1 - matrix.d)) / (1 - wheelTarget.d)
            : 0;
    this.#revision++;
    this.#cancelAnimations();
    // A native gallery swipe deliberately leaves the transition layer at its
    // source until scrolling settles. If vertical dismissal takes ownership
    // first, mount it against the frozen, selected frame now so controls and
    // labels inherit the exact interrupted pose.
    if (!this.#transitionLayer) {
      const transitionLayer = this.#mountTransitionLayer(this.#frame!, 0);
      if (transitionLayer && this.#transitionContent) this.#setTransitionPhase("dragging");
    }
    if (wheel) this.#wheelPaintSample = undefined;
    const drag = this.#dragGesture.begin({
      matrix,
      wheelTarget,
      wheelDirection: wheel ? this.#wheelDirection : 0,
      wheelOffset,
      wheelSnapOffset: wheel ? (this.#gallery?.snapOffset ?? 0) : 0,
      opacity,
      closeOpacity,
      borderRadii,
      targetRadii: this.#thumbnailRadii,
      clipX: currentClip.x,
      clipY: currentClip.y,
      targetClipX: targetPose.x,
      targetClipY: targetPose.y,
      width,
      height,
      time: this.#gesture?.time ?? performance.now(),
    });
    delete this.#dialog!.dataset.filmstripRevealing;
    if (this.#transitionContent) delete this.#transitionContent.dataset.lightboxControlsRevealing;
    this.#dialog!.dataset.dismissing = "";
    this.#paintDrag(drag);
  }

  #paintDrag(drag: LightboxDragState) {
    const distance = dragDistance(drag);
    const progress = dragProgress(drag);
    this.#overlay?.style.setProperty("--lightbox-drag-x", `${drag.x}px`);
    this.#overlay?.style.setProperty("--lightbox-drag-y", `${drag.y}px`);
    this.#overlay?.style.setProperty("--lightbox-dismiss-progress", String(progress));
    if (!drag.wheelTarget) this.#syncOverlayEdges(progress);
    // Reverse past the open boundary with resistance, capped at 12% enlargement.
    const stretch = distance < 0 ? 1 + 0.12 * (1 - Math.exp(distance / 180)) : 1;
    const scale = 1 - progress * 0.3;
    const from = drag.wheelTarget
      ? new DOMMatrix().translate(drag.wheelSnapOffset * drag.wheelSnapProgress, 0)
      : drag.matrix;
    const to = drag.wheelTarget;
    const matrix =
      to && distance < 0
        ? from
            .translate((drag.width * (1 - stretch)) / 2, (drag.height * (1 - stretch)) / 2)
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
              .translate(drag.x, drag.y)
              .multiply(from)
              .translate((drag.width * (1 - scale)) / 2, (drag.height * (1 - scale)) / 2)
              .scale(scale);
    if (drag.wheelTarget) this.#sampleWheelPaint(matrix);
    const radiusProgress = drag.wheelTarget
      ? Math.min(1, progress / DISMISS_RADIUS_END)
      : dismissRadiusProgress(drag.x, drag.y);
    const pose = this.#applyCropPose(matrix, {
      x: drag.clipX + (drag.targetClipX - drag.clipX) * progress,
      y: drag.clipY + (drag.targetClipY - drag.clipY) * progress,
      radii: mapRadii(
        drag.borderRadii,
        (radius, index) => radius + (drag.targetRadii[index]! - radius) * radiusProgress,
      ),
    });
    this.#backdrop!.style.setProperty(
      "--lightbox-backdrop-opacity",
      String((drag.wheelTarget ? 1 : drag.opacity) * backdropVisibility(progress)),
    );
    this.#closeButton!.style.setProperty(
      "--lightbox-close-opacity",
      String((drag.wheelTarget ? 1 : drag.closeOpacity) * (1 - progress)),
    );
    if (this.#transitionLayer) {
      this.#paintTransitionLayer(this.#transitionLayer, progress, pose.frame);
    }
    if (drag.wheelTarget && drag.wheelDirection && Math.abs(distance) < 0.001) {
      this.#dragGesture.finish();
      this.#cancelAnimations();
      this.#applyPendingImage();
      this.#completeOpening();
    }
  }

  #sampleWheelPaint(matrix: DOMMatrix) {
    const now = performance.now();
    const previous = this.#wheelPaintSample;
    if (!previous) {
      this.#wheelPaintSample = {
        matrix,
        time: now,
        velocity: new DOMMatrix([0, 0, 0, 0, 0, 0]),
      };
      return;
    }
    const changed =
      Math.abs(matrix.a - previous.matrix.a) > 0.000001 ||
      Math.abs(matrix.d - previous.matrix.d) > 0.000001 ||
      Math.abs(matrix.e - previous.matrix.e) > 0.000001 ||
      Math.abs(matrix.f - previous.matrix.f) > 0.000001;
    const interval = now - previous.time;
    if (!changed || interval <= 0) return;
    this.#wheelPaintSample = {
      matrix,
      time: now,
      velocity: new DOMMatrix([
        (matrix.a - previous.matrix.a) / interval,
        0,
        0,
        (matrix.d - previous.matrix.d) / interval,
        (matrix.e - previous.matrix.e) / interval,
        (matrix.f - previous.matrix.f) / interval,
      ]),
    };
  }

  #syncOverlayEdges(progress: number) {
    if (progress >= BROWSER_CHROME_RELEASE_PROGRESS) this.#releaseOverlayEdges();
    else if (progress <= BROWSER_CHROME_RESTORE_PROGRESS) this.#restoreOverlayEdges();
  }

  #releaseOverlayEdges() {
    if (!this.#overlay || this.#overlay.hasAttribute("data-lightbox-edge-released")) return;
    this.#overlay.dataset.lightboxEdgeReleased = "";
  }

  #restoreOverlayEdges() {
    if (!this.#overlay?.hasAttribute("data-lightbox-edge-released")) return;
    delete this.#overlay.dataset.lightboxEdgeReleased;
  }

  #endDrag(cancel = false, wheel = false) {
    this.#gesture = undefined;
    this.#dialog?.removeAttribute("data-dragging");
    const release = this.#dragGesture.finish();
    if (!release) return;
    const { state: drag, velocityX, velocityY, inputDistance, inputSpeed } = release;
    this.#paintDrag(drag);
    const commit =
      !cancel &&
      (wheel
        ? drag.wheelOffset + drag.y * drag.wheelDirection >= wheelDismissDistance
        : inputDistance > TOUCH_DISMISS_DISTANCE ||
          (inputDistance > 30 &&
            inputSpeed > 0.6 &&
            velocityX * drag.inputX + velocityY * drag.inputY > 0));
    this.#settleVelocityX = wheel ? 0 : boundDismissVelocity(drag.x, velocityX, "x");
    this.#settleVelocityY = wheel ? 0 : boundDismissVelocity(drag.y, velocityY, "y");
    this.#settleMatrixVelocity = wheel ? this.#wheelPaintSample?.velocity : undefined;
    this.#wheelPaintSample = undefined;
    if (commit) {
      this.close();
    } else {
      // Keep neighboring slides hidden until #completeOpening swaps the
      // temporary offset for its selected snap point.
      const current = this.#readCropPose();
      this.#animate(true, {
        transform: current.transform.toString(),
        opacity: getComputedStyle(this.#backdrop!).opacity,
        closeOpacity: getComputedStyle(this.#closeButton!).opacity,
        clip: current.clip,
      });
    }
  }

  #onTouchStart = (event: TouchEvent) => {
    // A tap still reaches native video controls. We only take ownership after
    // the gesture resolves vertically, which lets a video itself start a drag
    // dismissal without making its controls unusable.
    if (this.#eventUsesNativeInteraction(event, false)) {
      this.#suppressClick = false;
      this.#gesture = undefined;
      return;
    }
    this.#suppressClick = event.touches.length !== 1;
    if (event.touches.length !== 1) {
      this.#endDrag(true);
      return;
    }
    if (this.#dragGesture.state?.wheelTarget) this.#endDrag(true, true);
    const touch = event.touches[0]!;
    this.#gesture = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      axis: "pending",
    };
  };

  #onTouchMove = (event: TouchEvent) => {
    const gesture = this.#gesture;
    if (!gesture || event.touches.length !== 1) return;
    const touch = event.touches[0]!;
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < touchAxisThreshold) return;
    this.#suppressClick = true;
    if (gesture.axis === "pending") {
      if (Math.abs(dx) > Math.abs(dy) * 1.3) {
        gesture.axis = "horizontal";
        if (this.#dragGesture.active) this.#endDrag(true);
      } else if (Math.abs(dy) > Math.abs(dx) * 1.3) gesture.axis = "vertical";
    }
    if (gesture.axis === "vertical") {
      if (event.cancelable) event.preventDefault();
      this.#beginDrag();
      this.#dialog!.dataset.dragging = "";
      this.#dragGesture.moveTouch(dx, dy);
    }
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length) return;
    this.#endDrag();
  };

  #onWheel = (event: WheelEvent) => {
    if (this.#eventUsesNativeInteraction(event, false)) return;
    if (event.ctrlKey) return;
    // Horizontal noise never changes the dismissal decision.
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.3) return;
    if (this.#phase === "closing") {
      if (this.#wheelHandoff && event.cancelable) event.preventDefault();
      return;
    }
    event.preventDefault();
    this.#beginDrag(true);
    const drag = this.#dragGesture.state;
    if (!drag) return;
    this.#dialog!.dataset.dragging = "";
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const inputDirection = Math.sign(-event.deltaY);
    if (!drag.wheelDirection) drag.wheelDirection = inputDirection;
    this.#wheelDirection = drag.wheelDirection;
    this.#dragGesture.moveWheel(event.deltaY * unit);
  };

  #beginWheelHandoff() {
    if (this.#wheelHandoff) return;
    const controller = new AbortController();
    const now = performance.now();
    const handoff = {
      controller,
      lastMagnitude: 0,
      lastTime: now,
      accelerationSamples: 0,
      timeout: setTimeout(() => this.#endWheelHandoff(), WHEEL_HANDOFF_TIMEOUT),
    };
    this.#wheelHandoff = handoff;
    window.addEventListener("wheel", this.#onWheelHandoff, {
      capture: true,
      passive: false,
      signal: controller.signal,
    });
  }

  #onWheelHandoff = (event: WheelEvent) => {
    const handoff = this.#wheelHandoff;
    if (!handoff || event.ctrlKey) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) * 1.3) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const magnitude = Math.abs(event.deltaY * unit);
    const now = performance.now();
    const elapsed = Math.max(1, now - handoff.lastTime);
    const quiet = elapsed >= WHEEL_HANDOFF_QUIET_GAP;
    const magnitudeIncreased =
      magnitude >= WHEEL_HANDOFF_MIN_DELTA &&
      handoff.lastMagnitude > 0 &&
      magnitude >= handoff.lastMagnitude * WHEEL_HANDOFF_ACCELERATION;
    handoff.accelerationSamples = magnitudeIncreased ? handoff.accelerationSamples + 1 : 0;
    const accelerating = handoff.accelerationSamples >= 2;
    if (quiet || accelerating) {
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

  #focus() {
    (this.#closeButton && !this.#closeButton.hidden ? this.#closeButton : this.#dialog)?.focus({
      preventScroll: true,
    });
  }

  #onKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (["+", "=", "-", "0"].includes(event.key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      if (event.key === "0") this.#zoom?.reset();
      else this.#zoom?.zoomBy(event.key === "-" ? 1 / 1.5 : 1.5);
    } else if (event.key === "Tab") {
      event.preventDefault();
      const controls = Array.from(
        this.#dialog!.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, video[controls], audio[controls], iframe, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (this.#transitionContent) {
        controls.push(
          ...this.#transitionContent.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
          ),
        );
      }
      const visibleControls = controls.filter(
        (control) =>
          !control.hasAttribute("hidden") &&
          !control.closest("[hidden], [aria-hidden=true]") &&
          getComputedStyle(control).pointerEvents !== "none" &&
          (this.#phase !== "closing" || !control.closest("[data-lightbox-slides]")),
      );
      const active = document.activeElement;
      const index = visibleControls.findIndex((control) => control === active);
      const nextIndex =
        index < 0
          ? event.shiftKey
            ? visibleControls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + visibleControls.length) % visibleControls.length;
      const next = visibleControls[nextIndex];
      if (next) next.focus({ preventScroll: true });
      else this.#focus();
    } else if (
      this.#gallery &&
      ["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      this.close();
    } else if (this.#gallery && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      if (this.#phase === "open") {
        this.#zoom?.suspend();
        this.#image?.style.removeProperty("--lightbox-media-transform");
        if (this.#dragGesture.active) {
          this.#endDrag(true);
          this.#revision++;
          this.#cancelAnimations();
        }
        this.#completeOpening();
        this.#gallery.navigate(event.key === "ArrowRight" ? 1 : -1, this.#prefersReducedMotion);
      }
    }
  };

  #onFocus = (event: FocusEvent) => {
    const path = event.composedPath();
    if (!path.includes(this.#dialog!) && !path.includes(this.#transitionContent!)) this.#focus();
  };

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

  #restoreLiveContentStyle() {
    if (!this.#image) return;
    if (this.#flightLiveStyle === null) this.#image.removeAttribute("style");
    else this.#image.setAttribute("style", this.#flightLiveStyle);
    this.#flightLiveStyle = null;
  }

  #mountPortableContent() {
    const previewProxy = this.#standaloneImage?.querySelector<HTMLImageElement>(
      "[data-lightbox-content-preview]",
    );
    const preview = this.#previewSource(this.#ownThumbnail);
    if (previewProxy && preview) previewProxy.src = preview;
    if (this.#portableContent && this.#standaloneImage) {
      if (
        this.#portableContent instanceof HTMLVideoElement &&
        this.#portableMarker?.parentNode &&
        !this.#portablePreviewProxy
      ) {
        const thumbnail = this.#ownThumbnail;
        const source = thumbnail?.currentSrc || thumbnail?.src || this.#portableContent.poster;
        if (source) {
          const proxy = new Image();
          proxy.dataset.lightboxPreviewProxy = "";
          proxy.src = source;
          proxy.alt = "";
          proxy.setAttribute("aria-hidden", "true");
          const style = getComputedStyle(this.#portableContent);
          proxy.style.objectFit = style.objectFit;
          proxy.style.objectPosition = style.objectPosition;
          this.#portableMarker.parentNode.insertBefore(proxy, this.#portableMarker);
          this.#portablePreviewProxy = proxy;
        }
      }
      this.#standaloneImage.append(this.#portableContent);
    }
  }

  #restorePortableContent() {
    if (this.#portableContent && this.#portableMarker?.parentNode) {
      this.#portableMarker.parentNode.insertBefore(this.#portableContent, this.#portableMarker);
    }
    this.#portablePreviewProxy?.remove();
    this.#portablePreviewProxy = null;
  }

  get #contentLabel() {
    const explicit = this.getAttribute("aria-label");
    if (explicit) return explicit;
    if (this.#image instanceof HTMLImageElement) return this.#image.alt || "Image viewer";
    const labelled = this.#image?.querySelector<HTMLElement>("[aria-label]");
    return labelled?.getAttribute("aria-label") || "Media viewer";
  }

  #onResize = () => {
    // Safari expands/collapses its toolbar during a swipe. Keep the session's
    // image geometry stable; a width change indicates a real layout/orientation change.
    if (window.innerWidth === this.#viewportWidth) return;
    if (this.#dragGesture.active) this.#endDrag(true);
    this.#viewportWidth = window.innerWidth;
    this.#overlay?.style.setProperty("--lightbox-height", `${window.innerHeight}px`);
    if (this.#phase === "closing") {
      // A resize can reflow the thumbnail. Re-measure only for this event.
      this.#updateCloseTarget();
      return;
    }
    if (this.#zoom?.zoomed) {
      this.#zoom.reset();
      return;
    }
    // Opening can settle at its new responsive position after a viewport resize.
    this.#revision++;
    this.#cancelAnimations();
    this.#applyPendingImage();
    this.#completeOpening();
  };

  #isolateBackground() {
    for (const element of document.body.children) {
      if (
        element === this.#overlay ||
        element === this.#transitionContent ||
        this.#inertElements.has(element)
      )
        continue;
      this.#inertElements.set(element, element.hasAttribute("inert"));
      element.setAttribute("inert", "");
    }
  }

  #cancelAnimations() {
    for (const animation of this.#animations) animation.cancel();
    this.#animations = [];
    this.#frame?.style.removeProperty("--lightbox-frame-transform");
    this.#frame?.style.removeProperty("--lightbox-frame-radius");
    this.#frame?.style.removeProperty("opacity");
    this.#image?.style.removeProperty("--lightbox-media-transform");
    this.#backdrop?.style.removeProperty("--lightbox-backdrop-opacity");
    this.#closeButton?.style.removeProperty("--lightbox-close-opacity");
  }

  #thumbnailPose(): ThumbnailPose {
    const thumbnail = this.#thumbnailImg;
    if (!thumbnail?.isConnected || !this.#image) return { transform: "none", ...emptyClip() };
    const from = thumbnail.getBoundingClientRect();
    // offset dimensions are unaffected by an in-flight transform.
    const current = this.#readCropPose();
    const imageRect = this.#image.getBoundingClientRect();
    const to = {
      left: imageRect.left - current.transform.e,
      top: imageRect.top - current.transform.f,
    };
    const width = this.#image.offsetWidth;
    const height = this.#image.offsetHeight;
    if (!from.width || !from.height || !width || !height)
      return { transform: "none", ...emptyClip() };
    const scale = Math.max(from.width / width, from.height / height);
    const x = Math.max(0, (width - from.width / scale) / 2);
    const y = Math.max(0, (height - from.height / scale) / 2);
    return {
      transform: `translate(${from.left - to.left - x * scale}px, ${from.top - to.top - y * scale}px) scale(${scale})`,
      x,
      y,
      radii: this.#thumbnailRadii,
    };
  }

  get #thumbnailRadii(): CornerRadii {
    const thumbnail = this.#thumbnailImg;
    if (!thumbnail?.isConnected) return emptyRadii();
    const style = getComputedStyle(thumbnail);
    return [
      Number.parseFloat(style.borderTopLeftRadius) || 0,
      Number.parseFloat(style.borderTopRightRadius) || 0,
      Number.parseFloat(style.borderBottomRightRadius) || 0,
      Number.parseFloat(style.borderBottomLeftRadius) || 0,
    ];
  }

  #readCropPose(
    frame: HTMLElement = this.#frame!,
    image: HTMLElement = this.#image!,
  ): { transform: DOMMatrix; clip: ImageClip } {
    const frameStyle = getComputedStyle(frame);
    const imageStyle = getComputedStyle(image);
    const frameTransform = new DOMMatrix(
      frameStyle.transform === "none" ? undefined : frameStyle.transform,
    );
    const imageTransform = new DOMMatrix(
      imageStyle.transform === "none" ? undefined : imageStyle.transform,
    );
    const transform = frameTransform.multiply(imageTransform);
    const crop = transform.inverse().multiply(frameTransform);
    const scale = Math.abs(frameTransform.a);
    const radii: CornerRadii = [
      (Number.parseFloat(frameStyle.borderTopLeftRadius) || 0) * scale,
      (Number.parseFloat(frameStyle.borderTopRightRadius) || 0) * scale,
      (Number.parseFloat(frameStyle.borderBottomRightRadius) || 0) * scale,
      (Number.parseFloat(frameStyle.borderBottomLeftRadius) || 0) * scale,
    ];
    return {
      transform,
      clip: {
        x: Math.max(0, crop.e),
        y: Math.max(0, crop.f),
        radii,
      },
    };
  }

  #applyCropPose(transform: DOMMatrix, clip: ImageClip) {
    const frame = this.#frame!;
    const image = this.#image!;
    const pose = cropPose(transform, clip, image.offsetWidth, image.offsetHeight);
    frame.style.setProperty("--lightbox-frame-transform", pose.frame.toString());
    frame.style.setProperty("--lightbox-frame-radius", pose.borderRadius);
    image.style.setProperty("--lightbox-media-transform", pose.image.toString());
    return pose;
  }

  #animate(
    opening: boolean,
    resume?: {
      transform: string;
      opacity: string;
      closeOpacity: string;
      clip: ImageClip;
    },
    paused = false,
  ) {
    if (opening) this.#restoreOverlayEdges();
    const revision = ++this.#revision;
    if (this.#prefersReducedMotion) {
      this.#settleVelocityX = 0;
      this.#settleVelocityY = 0;
      if (!opening) this.#finishClose();
      else {
        this.#applyPendingImage();
        this.#completeOpening();
      }
      return;
    }
    // Read once, before any style writes. There are no per-frame geometry reads.
    const current = resume
      ? {
          transform: new DOMMatrix(resume.transform === "none" ? undefined : resume.transform),
          clip: resume.clip,
        }
      : this.#readCropPose();
    const thumbnailRadii = this.#thumbnailRadii;
    const currentOpacity = resume?.opacity ?? getComputedStyle(this.#backdrop!).opacity;
    const closeOpacity = resume?.closeOpacity ?? getComputedStyle(this.#closeButton!).opacity;
    const thumbnailPose = this.#thumbnailPose();
    const transform = thumbnailPose.transform;
    const originlessSource = !!this.#gallery && !this.#thumbnailImg?.isConnected;
    const imageBounds = this.#image!.getBoundingClientRect();
    const bounds = {
      left: imageBounds.left - current.transform.e,
      top: imageBounds.top - current.transform.f,
      width: this.#image!.offsetWidth,
      height: this.#image!.offsetHeight,
    };
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    this.#cancelAnimations();
    if (resume) {
      this.#flight?.remove();
      this.#flight = undefined;
      this.#flightFrame = undefined;
      this.#flightImage = undefined;
      delete this.#image!.dataset.lightboxFlightSourceHidden;
      if (this.#gallery) delete this.#gallery.element.dataset.lightboxFlightSourceHidden;
    }
    let frame = this.#frame!;
    let image = this.#image!;
    if (!opening) {
      this.#closeStartTransform = current.transform.toString();
      this.#closeTarget = new DOMMatrix(transform);
      this.#closeStartClip = current.clip;
      this.#closeTargetClip = thumbnailPose;
      // An absolute document layer follows asynchronous native scrolling without
      // touching keyframes, reading scroll offsets, or chasing the compositor.
      this.#flight = document.createElement("div");
      this.#flight.dataset.lightboxFlight = "";
      this.#flight.setAttribute("aria-hidden", "true");
      this.#flight.style.setProperty("--lightbox-flight-height", `${documentHeight}px`);
      frame = document.createElement("div");
      frame.dataset.lightboxFrame = "";
      this.#flightOrigin = {
        x: bounds.left + scrollX,
        y: bounds.top + scrollY,
        width: bounds.width,
        height: bounds.height,
      };
      frame.style.setProperty("--lightbox-flight-left", `${this.#flightOrigin.x}px`);
      frame.style.setProperty("--lightbox-flight-top", `${this.#flightOrigin.y}px`);
      frame.style.setProperty("--lightbox-flight-width", `${bounds.width}px`);
      frame.style.setProperty("--lightbox-flight-item-height", `${bounds.height}px`);
      this.#flightUsesLiveContent = !(this.#image instanceof HTMLImageElement);
      if (this.#flightUsesLiveContent) this.#flightLiveStyle = this.#image!.getAttribute("style");
      image = this.#flightUsesLiveContent
        ? this.#image!
        : (this.#image!.cloneNode(true) as HTMLElement);
      frame.append(image);
      this.#flight.append(frame);
      // The body isolates stacking. Both image layers must share its context.
      document.body.append(this.#flight);
      this.#flightFrame = frame;
      this.#flightImage = image;
      if (!this.#flightUsesLiveContent) this.#image!.dataset.lightboxFlightSourceHidden = "";
      if (this.#gallery) this.#gallery.element.dataset.lightboxFlightSourceHidden = "";
    }
    const transitionLayer = this.#mountTransitionLayer(frame);
    // The flight is appended after the detached content plane. Move the content
    // to the end of the body so equal stacking levels still paint it above the
    // closing image instead of revealing it only after the flight is removed.
    if (!opening && this.#transitionContent) document.body.append(this.#transitionContent);
    const returningFromDismissal = opening && !!resume;
    const settlingDismissal = returningFromDismissal || !opening;
    const fallbackMatrix = new DOMMatrix()
      .translate(bounds.width * 0.02, bounds.height * 0.02)
      .scale(0.96);
    const from = new DOMMatrix(
      opening
        ? (resume?.transform ??
            (originlessSource
              ? fallbackMatrix.toString()
              : transform === "none"
                ? undefined
                : transform))
        : current.transform.toString(),
    );
    const to = new DOMMatrix(
      opening
        ? undefined
        : originlessSource
          ? fallbackMatrix.toString()
          : transform === "none"
            ? undefined
            : transform,
    );
    if (opening && resume) to.translateSelf(this.#gallery?.snapOffset ?? 0, 0);
    const closeTravel = Math.max(
      Math.abs(to.e - from.e),
      Math.abs(to.f - from.f),
      Math.abs(to.a - from.a) * bounds.width,
      Math.abs(to.d - from.d) * bounds.height,
    );
    const closeDuration = Math.min(480, 220 + Math.sqrt(Math.max(0, closeTravel - 240)) * 4);
    const duration = !opening ? closeDuration : settlingDismissal ? 220 : 300;
    const options: KeyframeAnimationOptions = {
      duration,
      easing: settlingDismissal
        ? "cubic-bezier(0.16, 1, 0.3, 1)"
        : "cubic-bezier(0.25, 0.1, 0.25, 1)",
      fill: "both",
    };
    const fromRadii = opening && !resume ? thumbnailRadii : current.clip.radii;
    const toRadii = opening ? emptyRadii() : thumbnailRadii;
    const fromClip = opening && !resume ? thumbnailPose : current.clip;
    const toClip = opening ? emptyClip() : thumbnailPose;
    const velocityX = this.#settleVelocityX;
    const velocityY = this.#settleVelocityY;
    const matrixVelocity = this.#settleMatrixVelocity;
    this.#settleVelocityX = 0;
    this.#settleVelocityY = 0;
    this.#settleMatrixVelocity = undefined;
    const hasVelocity = velocityX !== 0 || velocityY !== 0;
    const hasDismissVelocity =
      hasVelocity ||
      (!!matrixVelocity &&
        [matrixVelocity.a, matrixVelocity.d, matrixVelocity.e, matrixVelocity.f].some(
          (velocity) => velocity !== 0,
        ));
    const closeResponse = duration * (hasDismissVelocity ? 1.2 : 0.9);
    const springOpening = opening && !settlingDismissal && !hasVelocity;
    const openingResponse = matchMedia("(hover: none) and (pointer: coarse)").matches
      ? TOUCH_OPENING_SPRING_RESPONSE
      : OPENING_SPRING_RESPONSE;
    const frameMotion: Keyframe[] = [];
    const imageMotion: Keyframe[] = [];
    const radiusMotion: Keyframe[] = [];
    const backdropMotion: Keyframe[] = [];
    const closeButtonMotion: Keyframe[] = [];
    // Opening only needs roughly one sample per display frame. Settlement keeps
    // the denser spring sampling because it can overshoot and reverse direction.
    const steps = settlingDismissal ? 60 : 24;
    for (let index = 0; index <= steps; index++) {
      const offset = index / steps;
      const elapsed = offset * duration;
      const final = index === steps;
      const value = (fromValue: number, toValue: number, velocity = 0) => {
        if (final) return toValue;
        if (!opening)
          return dismissCloseValue(fromValue, toValue, velocity, elapsed, duration, closeResponse);
        if (settlingDismissal) return dismissReturnValue(fromValue, toValue, velocity, elapsed);
        if (hasVelocity) {
          const progress = offset * offset * (3 - 2 * offset);
          const tangent = offset * (1 - offset) * (1 - offset);
          return fromValue + (toValue - fromValue) * progress + velocity * duration * tangent;
        }
        if (springOpening)
          return dismissCloseValue(fromValue, toValue, 0, elapsed, duration, openingResponse);
        return fromValue + (toValue - fromValue) * offset;
      };
      const matrix = new DOMMatrix([
        value(from.a, to.a, matrixVelocity?.a ?? 0),
        0,
        0,
        value(from.d, to.d, matrixVelocity?.d ?? 0),
        value(from.e, to.e, matrixVelocity?.e ?? velocityX),
        value(from.f, to.f, matrixVelocity?.f ?? velocityY),
      ]);
      const clip = {
        x: value(fromClip.x, toClip.x),
        y: value(fromClip.y, toClip.y),
        radii: mapRadii(fromRadii, (radius, corner) => value(radius, toRadii[corner]!)),
      };
      const pose = cropPose(matrix, clip, bounds.width, bounds.height);
      frameMotion.push({
        offset,
        transform: pose.frame.toString(),
        ...(originlessSource ? { opacity: opening ? offset : 1 - offset } : {}),
      });
      imageMotion.push({ offset, transform: pose.image.toString() });
      radiusMotion.push({ offset, borderRadius: pose.borderRadius });
      if (springOpening || !opening) {
        const response = opening ? openingResponse : closeResponse;
        backdropMotion.push({
          offset,
          opacity: dismissCloseValue(
            Number(currentOpacity),
            opening ? 1 : 0,
            0,
            elapsed,
            duration,
            response,
          ),
        });
        closeButtonMotion.push({
          offset,
          opacity: dismissCloseValue(
            Number(closeOpacity),
            opening ? 1 : 0,
            0,
            elapsed,
            duration,
            response,
          ),
        });
      }
    }
    const transitionContentMotion = this.#transitionContentMotion(frameMotion);
    if (opening && !resume) {
      const backdropReady = backdropMotion.find((keyframe) => Number(keyframe.opacity) >= 0.85);
      const revealDelay = (backdropReady?.offset ?? 0.7) * duration;
      this.#openingControlsRevealDelay = revealDelay;
      if (this.#filmstrip) {
        this.#dialog!.style.setProperty("--lightbox-filmstrip-reveal-delay", `${revealDelay}ms`);
      }
    }
    if (paused) this.#preparedTransitionContentMotion = transitionContentMotion;
    const animate = (
      target: Element,
      keyframes: Keyframe[] | PropertyIndexedKeyframes,
      animationOptions: KeyframeAnimationOptions,
    ) => {
      if (!paused) return target.animate(keyframes, animationOptions);
      const animation = new Animation(
        new KeyframeEffect(target, keyframes, animationOptions),
        document.timeline,
      );
      animation.currentTime = 0;
      return animation;
    };
    // Keep an exact CSS fallback for time zero. A newly revealed overlay can
    // otherwise paint its uncropped image for one frame before Web Animations
    // applies the first sampled keyframe.
    const initialFrame = frameMotion[0];
    const initialImage = imageMotion[0];
    const initialRadius = radiusMotion[0];
    frame.style.setProperty(
      "--lightbox-frame-transform",
      String(initialFrame?.transform ?? "none"),
    );
    frame.style.setProperty(
      "--lightbox-frame-radius",
      String(initialRadius?.borderRadius ?? "0px"),
    );
    if (originlessSource) frame.style.opacity = String(opening ? 0 : 1);
    image.style.setProperty(
      "--lightbox-media-transform",
      String(initialImage?.transform ?? "none"),
    );
    this.#animations = [
      animate(frame, frameMotion, {
        ...options,
        easing: settlingDismissal || hasVelocity || springOpening ? "linear" : options.easing,
      }),
      animate(image, imageMotion, {
        ...options,
        easing: settlingDismissal || hasVelocity || springOpening ? "linear" : options.easing,
      }),
      animate(frame, radiusMotion, {
        ...options,
        easing: settlingDismissal || springOpening ? "linear" : options.easing,
      }),
      animate(
        this.#backdrop!,
        backdropMotion.length
          ? backdropMotion
          : [
              { opacity: opening ? (resume?.opacity ?? 0) : currentOpacity },
              { opacity: opening ? 1 : 0 },
            ],
        backdropMotion.length
          ? { ...options, easing: "linear" }
          : opening && !resume
            ? { ...options, easing: OPENING_BACKDROP_EASING }
            : options,
      ),
      animate(
        this.#closeButton!,
        closeButtonMotion.length
          ? closeButtonMotion
          : [
              { opacity: opening ? (resume?.closeOpacity ?? 0) : closeOpacity },
              { opacity: opening ? 1 : 0 },
            ],
        closeButtonMotion.length ? { ...options, easing: "linear" } : options,
      ),
    ];
    let transitionFrom = 0;
    const transitionTo = opening ? 0 : 1;
    if (transitionLayer) {
      this.#transitionOpenBounds = {
        left: bounds.left + scrollX,
        top: bounds.top + scrollY,
        width: bounds.width,
        height: bounds.height,
      };
      const computedProgress = Number.parseFloat(
        getComputedStyle(transitionLayer).getPropertyValue("--lightbox-progress"),
      );
      transitionFrom = Number.isFinite(computedProgress) ? computedProgress : opening ? 1 : 0;
      this.#setTransitionPhase(opening ? "opening" : "closing");
      transitionLayer.style.setProperty("--lightbox-progress", String(transitionTo));
      this.#animations.push(
        animate(transitionLayer, this.#transitionProgressMotion(transitionFrom, transitionTo), {
          ...options,
          easing: "linear",
        }),
      );
      if (this.#transitionContent) {
        const finalContentMotion = transitionContentMotion.at(-1);
        this.#transitionContent.style.setProperty("--lightbox-progress", String(transitionTo));
        this.#applyTransitionContentTransform(finalContentMotion);
        this.#animations.push(
          animate(
            this.#transitionContent,
            this.#transitionProgressMotion(transitionFrom, transitionTo),
            { ...options, easing: "linear" },
          ),
          animate(this.#transitionContent, transitionContentMotion, {
            ...options,
            easing: "linear",
          }),
        );
        const counterScaleMotion = this.#transitionCounterScaleMotion(frameMotion);
        for (const target of this.#transitionCounterScaleTargets()) {
          target.style.setProperty(
            "--lightbox-transition-counter-transform",
            String(counterScaleMotion.at(-1)?.transform ?? "none"),
          );
          this.#animations.push(
            animate(target, counterScaleMotion, {
              ...options,
              easing: "linear",
            }),
          );
        }
      }
    }
    this.#backdrop!.style.removeProperty("--lightbox-backdrop-opacity");
    this.#closeButton!.style.removeProperty("--lightbox-close-opacity");
    void Promise.allSettled(this.#animations.map((animation) => animation.finished)).then(
      async () => {
        const filmstripReveal =
          opening && !resume
            ? this.#filmstrip?.element
                .getAnimations()
                .find(
                  (animation) =>
                    (animation as CSSAnimation).animationName === "lightbox-filmstrip-appear",
                )
            : undefined;
        const controlsReveal =
          opening && !resume
            ? this.#transitionContent
                ?.querySelector("[data-lightbox-video-actions]")
                ?.getAnimations()
                .find(
                  (animation) =>
                    (animation as CSSAnimation).animationName === "lightbox-video-actions-reveal",
                )
            : undefined;
        await Promise.allSettled(
          [filmstripReveal, controlsReveal]
            .filter((animation): animation is Animation => !!animation)
            .map((animation) => animation.finished),
        );
        if (revision !== this.#revision) return;
        if (transitionLayer && this.#transitionLayer === transitionLayer) {
          transitionLayer.style.setProperty("--lightbox-progress", String(transitionTo));
          this.#transitionContent?.style.setProperty("--lightbox-progress", String(transitionTo));
        }
        this.#setTransitionPhase(opening ? "open" : "preview");
        if (!opening) {
          this.#cancelAnimations();
          this.#finishClose();
        } else {
          this.#applyPendingImage();
          this.#completeOpening();
          this.#cancelAnimations();
        }
      },
    );
    const synchronizePlayback = () => {
      // Assign the shared start immediately. Waiting for `ready` can let Safari
      // render time zero and then reset the animation to time zero a frame later.
      const timelineTime = Number(document.timeline.currentTime ?? 0);
      for (const animation of this.#animations) {
        animation.currentTime = 0;
        animation.startTime = timelineTime;
      }
    };
    if (!paused) synchronizePlayback();
  }

  #finishClose() {
    this.#zoom?.destroy();
    this.#zoom = undefined;
    this.#wheelDirection = 0;
    this.#restoreOverlayEdges();
    if (this.#dialog) {
      delete this.#dialog.dataset.dismissing;
      delete this.#dialog.dataset.dragging;
      delete this.#dialog.dataset.filmstripRevealing;
      this.#dialog.style.removeProperty("--lightbox-filmstrip-reveal-delay");
    }
    if (this.#transitionContent) {
      delete this.#transitionContent.dataset.lightboxControlsRevealing;
      this.#transitionContent.style.removeProperty("--lightbox-controls-reveal-delay");
    }
    for (const property of [
      "--lightbox-drag-x",
      "--lightbox-drag-y",
      "--lightbox-dismiss-progress",
    ]) {
      this.#overlay?.style.removeProperty(property);
    }
    this.#dragGesture.cancel();
    this.#gesture = undefined;
    this.#revision++;
    this.#cancelAnimations();
    this.#restoreThumbnail();
    this.#restoreTransitionLayer();
    clearTimeout(this.#prepareCleanup);
    this.#prepareCleanup = undefined;
    this.#preparedGallery?.gallery.destroy();
    this.#preparedGallery = undefined;
    this.#preparedOverlay = false;
    this.#preparedOpening = false;
    this.#modalController?.abort();
    this.#observer?.disconnect();
    this.#overlay?.remove();
    if (this.#flightUsesLiveContent && this.#image && this.#standaloneFrame) {
      this.#standaloneFrame.append(this.#image);
      this.#restoreLiveContentStyle();
    }
    this.#restorePortableContent();
    this.#flight?.remove();
    this.#flight = undefined;
    this.#flightFrame = undefined;
    this.#flightImage = undefined;
    this.#flightUsesLiveContent = false;
    this.#flightLiveStyle = null;
    if (this.#image) delete this.#image.dataset.lightboxFlightSourceHidden;
    if (this.#gallery) delete this.#gallery.element.dataset.lightboxFlightSourceHidden;
    this.#frame?.removeAttribute("style");
    if (this.#gallery) {
      this.#filmstrip?.destroy();
      this.#filmstrip = undefined;
      this.#filmstripDock?.remove();
      this.#filmstripDock = undefined;
      delete this.#dialog!.dataset.filmstrip;
      this.#gallery.destroy();
      this.#gallery = undefined;
      this.#galleryTrigger = null;
      this.#gallerySelectionIndex = -1;
      delete this.#dialog!.dataset.lightboxGallery;
      delete this.#dialog!.dataset.opening;
      this.#dialog!.prepend(this.#standaloneFrame!);
      this.#image = this.#standaloneImage;
      this.#frame = this.#standaloneFrame;
    }
    if (this.#image) {
      for (const property of ["width", "height", "max-width", "max-height"]) {
        this.#image.style.removeProperty(property);
      }
    }
    for (const [element, wasInert] of this.#inertElements) {
      element.toggleAttribute("inert", wasInert);
    }
    this.#inertElements.clear();
    this.#phase = "closed";
    this.#setPresentationState("closed");
    if (AppLightbox.#active === this) AppLightbox.#active = null;
    if (this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
    this.#returnFocus = null;
    this.#applyPendingImage();
  }

  #applyPendingImage() {
    this.#pendingImage?.();
    this.#pendingImage = undefined;
  }

  #loadImage(deferFullImage = false) {
    if (this.#imageLoaded || !(this.#image instanceof HTMLImageElement)) return;

    const target = this.#image;
    const src = this.getAttribute("src");
    const alt = this.getAttribute("alt") || "";
    const thumbnail = this.#thumbnailImg;

    if (!src) return;

    this.#image.alt =
      alt || (this.#thumbnailImg instanceof HTMLImageElement ? this.#thumbnailImg.alt : "");

    if (thumbnail instanceof HTMLImageElement) {
      // A lazy loader may already have assigned the full URL while the browser is
      // still painting the old preview. Keep that decoded preview for the handoff.
      this.#image.src = this.#previewSource(thumbnail);

      // Set dimensions from thumbnail so the lightbox image isn't 0x0 while loading
      const previewWidth = thumbnail.naturalWidth || this.#decodedPreviewWidth;
      const previewHeight = thumbnail.naturalHeight || this.#decodedPreviewHeight;
      if (previewWidth && previewHeight) {
        this.#image.width = previewWidth;
        this.#image.height = previewHeight;
        this.#image.style.setProperty(
          "--lightbox-media-aspect",
          `${previewWidth} / ${previewHeight}`,
        );
      }

      const fullImage = new Image();
      const applyFullImage = () => {
        if (target !== this.#standaloneImage) return;
        this.#pendingImage = () => {
          target.src = src;
          target.width = fullImage.naturalWidth;
          target.height = fullImage.naturalHeight;
          target.style.setProperty(
            "--lightbox-media-aspect",
            `${fullImage.naturalWidth} / ${fullImage.naturalHeight}`,
          );
        };
        if (!this.#animations.length && !this.#dragGesture.active) this.#applyPendingImage();
      };
      // Keep full-size decoding out of the opening frames. Eager images still
      // load ahead of interaction; lazy images upgrade after the animation.
      if (deferFullImage)
        this.#pendingImage = () => {
          fullImage.src = src;
          void fullImage
            .decode()
            .then(applyFullImage)
            .catch(() => {});
        };
      else {
        fullImage.src = src;
        void fullImage
          .decode()
          .then(applyFullImage)
          .catch(() => {});
      }
    } else {
      this.#image.src = src;
    }

    this.#imageLoaded = true;
  }
}

if (!customElements.get("app-lightbox")) {
  customElements.define("app-lightbox", AppLightbox);
}

export type { AppLightbox };
