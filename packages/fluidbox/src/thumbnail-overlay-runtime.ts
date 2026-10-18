import type {
  FluidboxDispose,
  FluidboxItem,
  FluidboxItemId,
  FluidboxThumbnailOverlayRegistration,
} from "./public-api";

export type ThumbnailOverlayPhase = "preview" | "opening" | "open" | "dragging" | "closing";

interface ActiveOverlay<TItem extends FluidboxItem> {
  readonly id: FluidboxItemId;
  readonly item: TItem;
  readonly index: number;
  readonly registration: FluidboxThumbnailOverlayRegistration<TItem>;
  readonly controller?: AbortController;
  readonly target?: HTMLDivElement;
  readonly dispose?: FluidboxDispose;
  readonly frameLayer?: HTMLElement;
  readonly marker?: Comment;
  readonly previousStyles?: ReadonlyMap<string, string>;
  readonly layerAnimations: Animation[];
}

interface FrameBox {
  readonly width: number;
  readonly height: number;
}

/**
 * The travelling copy follows the frame's painted box without scaling: it is
 * moved and resized, so its content keeps its own size and offsets throughout
 * the flight and lands exactly where the thumbnail's copy sits.
 */
function targetStyle(transform: string | DOMMatrix | null | undefined, box: FrameBox) {
  const value = String(transform ?? "none");
  const matrix = new DOMMatrix(value === "none" ? undefined : value);
  return {
    transform: `translate(${matrix.e}px, ${matrix.f}px)`,
    width: `${box.width * Math.abs(matrix.a)}px`,
    height: `${box.height * Math.abs(matrix.d)}px`,
  };
}

function targetMotion(frameMotion: Keyframe[], box: FrameBox): Keyframe[] {
  return frameMotion.map(({ offset, transform }) => ({
    offset,
    ...targetStyle(transform as string | undefined, box),
  }));
}

/**
 * A travel layer sits inside the full-size media frame, so the frame's scale
 * would shrink it with the image. Lay it out at the frame's painted size and
 * scale it back up, so its content keeps the size it had on the thumbnail.
 */
function travelLayerStyle(transform: string | DOMMatrix | null | undefined) {
  const value = String(transform ?? "none");
  const matrix = new DOMMatrix(value === "none" ? undefined : value);
  const x = Math.max(0.0001, Math.abs(matrix.a));
  const y = Math.max(0.0001, Math.abs(matrix.d));
  return { transform: `scale(${1 / x}, ${1 / y})`, width: `${x * 100}%`, height: `${y * 100}%` };
}

let progressRegistered = false;
const opacityResponse = 0.65;

/** Publishes thumbnail-overlay motion without taking ownership of application DOM. */
export class ThumbnailOverlayRuntime<TItem extends FluidboxItem> {
  readonly #document: Document;
  readonly #registrations = new Map<FluidboxItemId, FluidboxThumbnailOverlayRegistration<TItem>>();
  #active: ActiveOverlay<TItem> | undefined;
  readonly #boxes = new WeakMap<HTMLElement, FrameBox>();

  constructor(ownerDocument: Document) {
    this.#document = ownerDocument;
    const css = ownerDocument.defaultView?.CSS;
    if (!progressRegistered && css && "registerProperty" in css) {
      const properties: PropertyDefinition[] = [
        { name: "--fluidbox-progress", syntax: "<number>", inherits: true, initialValue: "1" },
      ];
      for (const property of properties) {
        try {
          css.registerProperty(property);
        } catch {
          // A custom-element viewer or another direct viewer may have registered it.
        }
      }
      progressRegistered = true;
    }
  }

  register(id: FluidboxItemId, registration: FluidboxThumbnailOverlayRegistration<TItem>) {
    this.#registrations.set(id, registration);
    this.#publish(registration.element, "preview", 1);
    return () => {
      if (this.#registrations.get(id) !== registration) return;
      this.#registrations.delete(id);
      if (this.#active?.registration !== registration) this.#reset(registration.element);
    };
  }

  prepare(
    item: TItem,
    index: number,
    frame: HTMLElement,
    phase: ThumbnailOverlayPhase,
    progress: number,
  ) {
    const registration = this.#registrations.get(item.id);
    const active = this.#active;
    if (active?.registration !== registration || active?.id !== item.id) {
      this.#disposeActive();
      if (!registration) return;
      if (registration.behavior === "travel") {
        const frameLayer = registration.frameLayer;
        let marker: Comment | undefined;
        let previousStyles: Map<string, string> | undefined;
        if (frameLayer?.isConnected) {
          marker = this.#document.createComment("fluidbox-frame-layer");
          frameLayer.before(marker);
          frameLayer.dataset.fluidboxTravelLayer = "";
          this.#publish(frameLayer, phase, progress);
          previousStyles = new Map();
          const computed = getComputedStyle(frameLayer);
          for (const property of [
            "--fluidbox-layer-color",
            "--fluidbox-layer-mask-opacity",
            "--fluidbox-transition-layer-opacity",
          ]) {
            previousStyles.set(property, frameLayer.style.getPropertyValue(property));
            frameLayer.style.setProperty(property, computed.getPropertyValue(property));
          }
          frame.append(frameLayer);
        }
        const target = this.#document.createElement("div");
        target.dataset.fluidboxTransitionContent = "";
        target.setAttribute("aria-hidden", "true");
        const controller = new AbortController();
        // The target lives in document coordinates. Its host clips it to the
        // page so a growing target never widens the page, which mobile Safari
        // answers by zooming the whole page out.
        const host = this.#document.createElement("div");
        host.dataset.fluidboxTransitionHost = "";
        host.setAttribute("aria-hidden", "true");
        host.append(target);
        this.#publish(target, phase, progress);
        this.#position(target, frame);
        this.#document.body.append(host);
        const dispose = registration.renderer.mount({
          item,
          index,
          target,
          signal: controller.signal,
        });
        this.#active = {
          id: item.id,
          item,
          index,
          registration,
          controller,
          target,
          dispose: dispose ?? undefined,
          frameLayer,
          marker,
          previousStyles,
          layerAnimations: [],
        };
      } else {
        this.#active = { id: item.id, item, index, registration, layerAnimations: [] };
      }
    } else if (active.target) {
      if (active.frameLayer && active.frameLayer.parentElement !== frame)
        frame.append(active.frameLayer);
      this.#position(active.target, frame);
      // A close flight is appended to the body after the opening created this
      // target. Move the target's host after it so the content stays above the image.
      const host = active.target.parentElement;
      if (host?.nextElementSibling) this.#document.body.append(host);
    }
    this.set(phase, progress);
  }

  animations(
    frameMotion: Keyframe[],
    progressMotion: Keyframe[],
    duration: number,
    from: number,
    to: number,
  ): Animation[] {
    const active = this.#active;
    if (!active) return [];
    const options: KeyframeAnimationOptions = { duration, easing: "linear", fill: "both" };
    const progress = progressMotion.map(({ offset, opacity }) => {
      const traveled = Math.min(1, Math.max(0, Number(opacity)));
      const fade = to < from ? 1 - (1 - traveled) ** opacityResponse : traveled ** opacityResponse;
      return { offset, "--fluidbox-progress": String(from + (to - from) * fade) };
    }) as Keyframe[];
    const targets = [
      ...new Set([active.registration.element, active.frameLayer, active.target]),
    ].filter((element): element is HTMLElement => !!element && element.isConnected);
    const animations = targets.map((target) =>
      this.#progressHolder(target).animate(progress, options),
    );
    if (active.frameLayer?.isConnected) {
      const layer = active.frameLayer.animate(
        frameMotion.map(({ offset, transform }) => ({
          offset,
          ...travelLayerStyle(transform as string | undefined),
        })),
        options,
      );
      active.layerAnimations.push(layer);
      animations.push(layer);
    }
    if (!active.target) return animations;
    const box = this.#boxes.get(active.target);
    if (box) animations.push(active.target.animate(targetMotion(frameMotion, box), options));
    return animations;
  }

  set(phase: ThumbnailOverlayPhase, progress: number, transform?: DOMMatrix) {
    const active = this.#active;
    if (!active) return;
    this.#publish(active.registration.element, phase, progress);
    if (active.frameLayer && active.frameLayer !== active.registration.element) {
      this.#publish(active.frameLayer, phase, progress);
    }
    const frame = active.frameLayer?.parentElement;
    if (active.frameLayer?.dataset.fluidboxTravelLayer !== undefined && frame) {
      Object.assign(active.frameLayer.style, travelLayerStyle(getComputedStyle(frame).transform));
    }
    if (!active.target) return;
    this.#publish(active.target, phase, progress);
    const box = this.#boxes.get(active.target);
    if (transform && box) this.#placeTarget(active.target, targetStyle(transform, box));
  }

  #placeTarget(target: HTMLElement, style: { transform: string; width: string; height: string }) {
    target.style.setProperty("--fluidbox-transition-transform", style.transform);
    target.style.setProperty("--fluidbox-transition-width", style.width);
    target.style.setProperty("--fluidbox-transition-height", style.height);
  }

  currentProgress(fallback: number) {
    const target = this.#active?.target ?? this.#active?.registration.element;
    if (!target?.isConnected) return fallback;
    const value = Number.parseFloat(
      getComputedStyle(target).getPropertyValue("--fluidbox-progress"),
    );
    return Number.isFinite(value) ? value : fallback;
  }

  prepareControlsReveal(delay: number) {
    const target = this.#active?.target;
    const actions = target?.querySelector<HTMLElement>("[data-fluidbox-video-actions]");
    if (!target || !actions) return undefined;
    target.style.setProperty("--fluidbox-controls-reveal-delay", `${delay}ms`);
    target.dataset.fluidboxControlsRevealing = "";
    return actions
      .getAnimations()
      .find(
        (animation) =>
          (animation as CSSAnimation).animationName === "fluidbox-video-actions-reveal",
      );
  }

  finishControlsReveal() {
    const target = this.#active?.target;
    if (!target) return;
    delete target.dataset.fluidboxControlsRevealing;
    target.style.removeProperty("--fluidbox-controls-reveal-delay");
  }

  retarget(animations: readonly Animation[], frameMotion: Keyframe[]) {
    const target = this.#active?.target;
    const layer = this.#active?.frameLayer;
    for (const animation of animations) {
      if (
        layer &&
        animation.effect instanceof KeyframeEffect &&
        animation.effect.target === layer
      ) {
        if (!animation.effect.getKeyframes().some((frame) => frame.width)) continue;
        animation.effect.setKeyframes(
          frameMotion.map(({ offset, transform }) => ({
            offset,
            ...travelLayerStyle(transform as string | undefined),
          })),
        );
      }
    }
    const box = target && this.#boxes.get(target);
    if (!target || !box) return;
    for (const animation of animations) {
      if (
        animation.effect instanceof KeyframeEffect &&
        animation.effect.target === target &&
        animation.effect.getKeyframes().some((frame) => frame.transform)
      ) {
        animation.effect.setKeyframes(targetMotion(frameMotion, box));
      }
    }
  }

  preservePaint() {
    const active = this.#active;
    if (!active) return;
    for (const target of new Set([active.registration.element, active.frameLayer, active.target])) {
      if (!target?.isConnected) continue;
      const holder = this.#progressHolder(target);
      holder.style.setProperty(
        "--fluidbox-progress",
        getComputedStyle(holder).getPropertyValue("--fluidbox-progress"),
      );
    }
    if (active.frameLayer?.dataset.fluidboxTravelLayer !== undefined) {
      const { transform, width, height } = getComputedStyle(active.frameLayer);
      Object.assign(active.frameLayer.style, { transform, width, height });
    }
    if (active.target) {
      const { transform, width, height } = getComputedStyle(active.target);
      this.#placeTarget(active.target, { transform, width, height });
    }
  }

  finishClose() {
    this.#disposeActive();
  }

  destroy() {
    this.#disposeActive();
    for (const registration of this.#registrations.values()) this.#reset(registration.element);
    this.#registrations.clear();
  }

  #publish(target: HTMLElement, phase: ThumbnailOverlayPhase, progress: number) {
    target.dataset.fluidboxPhase = phase;
    this.#progressHolder(target).style.setProperty("--fluidbox-progress", String(progress));
  }

  /**
   * The element that carries an overlay's progress. The travelling target
   * inherits it from its host: WebKit stops applying the target's animated
   * width and height while the registered progress animates on the target.
   */
  #progressHolder(target: HTMLElement) {
    const host = target.parentElement;
    return target.dataset.fluidboxTransitionContent !== undefined &&
      host?.dataset.fluidboxTransitionHost !== undefined
      ? host
      : target;
  }

  #position(target: HTMLElement, frame: HTMLElement) {
    const view = this.#document.defaultView!;
    const rect = frame.getBoundingClientRect();
    // The target is placed at the frame's layout box and follows the frame's
    // transform as a translation and a resize, never as a scale.
    const transformValue = getComputedStyle(frame).transform;
    const transform = new DOMMatrix(transformValue === "none" ? undefined : transformValue);
    const box = { width: frame.offsetWidth, height: frame.offsetHeight };
    this.#boxes.set(target, box);
    target.parentElement?.style.setProperty(
      "--fluidbox-transition-host-height",
      `${this.#document.documentElement.scrollHeight}px`,
    );
    this.#placeTarget(target, targetStyle(transform, box));
    target.style.setProperty(
      "--fluidbox-transition-left",
      `${rect.left - transform.e + view.scrollX}px`,
    );
    target.style.setProperty(
      "--fluidbox-transition-top",
      `${rect.top - transform.f + view.scrollY}px`,
    );
  }

  #disposeActive() {
    const active = this.#active;
    if (!active) return;
    delete active.target?.dataset.fluidboxControlsRevealing;
    active.target?.style.removeProperty("--fluidbox-controls-reveal-delay");
    active.controller?.abort();
    active.dispose?.();
    (active.target?.parentElement ?? active.target)?.remove();
    for (const animation of active.layerAnimations) animation.cancel();
    if (active.frameLayer && active.marker?.isConnected) {
      delete active.frameLayer.dataset.fluidboxTravelLayer;
      for (const property of ["transform", "width", "height"] as const) {
        active.frameLayer.style[property] = "";
      }
      active.marker.replaceWith(active.frameLayer);
      for (const [property, value] of active.previousStyles ?? []) {
        if (value) active.frameLayer.style.setProperty(property, value);
        else active.frameLayer.style.removeProperty(property);
      }
      if (active.frameLayer !== active.registration.element) {
        this.#publish(active.frameLayer, "preview", 1);
      }
    }
    if (this.#registrations.get(active.id) === active.registration) {
      this.#publish(active.registration.element, "preview", 1);
    } else {
      this.#reset(active.registration.element);
    }
    this.#active = undefined;
  }

  #reset(target: HTMLElement) {
    delete target.dataset.fluidboxPhase;
    target.style.removeProperty("--fluidbox-progress");
  }
}
