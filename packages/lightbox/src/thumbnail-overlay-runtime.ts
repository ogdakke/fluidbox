import type {
  LightboxDispose,
  LightboxItem,
  LightboxItemId,
  LightboxThumbnailOverlayRegistration,
} from "./public-api";

export type ThumbnailOverlayPhase = "preview" | "opening" | "open" | "dragging" | "closing";

interface ActiveOverlay<TItem extends LightboxItem> {
  readonly id: LightboxItemId;
  readonly item: TItem;
  readonly index: number;
  readonly registration: LightboxThumbnailOverlayRegistration<TItem>;
  readonly controller?: AbortController;
  readonly target?: HTMLDivElement;
  readonly dispose?: LightboxDispose;
  readonly frameLayer?: HTMLElement;
  readonly marker?: Comment;
  readonly previousStyles?: ReadonlyMap<string, string>;
  readonly layerAnimations: Animation[];
}

function counterScale(matrix: DOMMatrix) {
  return `scale(${1 / Math.max(0.0001, Math.abs(matrix.a))}, ${1 / Math.max(0.0001, Math.abs(matrix.d))})`;
}

/** The travelling copy follows the frame; its children undo the frame's scale. */
function targetMotion(frameMotion: Keyframe[]): Keyframe[] {
  return frameMotion.map(({ offset, transform }) => {
    const value = String(transform ?? "none");
    return {
      offset,
      transform: value,
      "--lightbox-transition-counter-transform": counterScale(
        new DOMMatrix(value === "none" ? undefined : value),
      ),
    };
  });
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
export class ThumbnailOverlayRuntime<TItem extends LightboxItem> {
  readonly #document: Document;
  readonly #registrations = new Map<LightboxItemId, LightboxThumbnailOverlayRegistration<TItem>>();
  #active: ActiveOverlay<TItem> | undefined;

  constructor(ownerDocument: Document) {
    this.#document = ownerDocument;
    const css = ownerDocument.defaultView?.CSS;
    if (!progressRegistered && css && "registerProperty" in css) {
      const properties: PropertyDefinition[] = [
        { name: "--lightbox-progress", syntax: "<number>", inherits: true, initialValue: "1" },
        // Renderers may mount content after the motion starts. An inherited,
        // interpolable counter transform reaches children that arrive late.
        {
          name: "--lightbox-transition-counter-transform",
          syntax: "<transform-list>",
          inherits: true,
          initialValue: "scale(1)",
        },
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

  register(id: LightboxItemId, registration: LightboxThumbnailOverlayRegistration<TItem>) {
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
          marker = this.#document.createComment("lightbox-frame-layer");
          frameLayer.before(marker);
          frameLayer.dataset.lightboxTravelLayer = "";
          this.#publish(frameLayer, phase, progress);
          previousStyles = new Map();
          const computed = getComputedStyle(frameLayer);
          for (const property of [
            "--lightbox-layer-color",
            "--lightbox-layer-mask-opacity",
            "--lightbox-transition-layer-opacity",
          ]) {
            previousStyles.set(property, frameLayer.style.getPropertyValue(property));
            frameLayer.style.setProperty(property, computed.getPropertyValue(property));
          }
          frame.append(frameLayer);
        }
        const target = this.#document.createElement("div");
        target.dataset.lightboxTransitionContent = "";
        target.setAttribute("aria-hidden", "true");
        this.#publish(target, phase, progress);
        const controller = new AbortController();
        this.#position(target, frame);
        this.#document.body.append(target);
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
      // target. Move the target after it so the content stays above the image.
      if (active.target.nextElementSibling) this.#document.body.append(active.target);
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
      return { offset, "--lightbox-progress": String(from + (to - from) * fade) };
    }) as Keyframe[];
    const targets = [
      ...new Set([active.registration.element, active.frameLayer, active.target]),
    ].filter((element): element is HTMLElement => !!element && element.isConnected);
    const animations = targets.map((target) => target.animate(progress, options));
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
    animations.push(active.target.animate(targetMotion(frameMotion), options));
    const counterMotion = frameMotion.map(({ offset, transform }) => {
      const value = String(transform ?? "none");
      const matrix = new DOMMatrix(value === "none" ? undefined : value);
      return {
        offset,
        transform: `scale(${1 / Math.max(0.0001, Math.abs(matrix.a))}, ${1 / Math.max(0.0001, Math.abs(matrix.d))})`,
      };
    });
    for (const target of this.#counterScaleTargets(active.target)) {
      animations.push(target.animate(counterMotion, options));
    }
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
    if (active.frameLayer?.dataset.lightboxTravelLayer !== undefined && frame) {
      Object.assign(active.frameLayer.style, travelLayerStyle(getComputedStyle(frame).transform));
    }
    if (!active.target) return;
    this.#publish(active.target, phase, progress);
    if (transform) {
      active.target.style.setProperty("--lightbox-transition-transform", transform.toString());
      const counter = counterScale(transform);
      active.target.style.setProperty("--lightbox-transition-counter-transform", counter);
      for (const target of this.#counterScaleTargets(active.target)) {
        target.style.setProperty("--lightbox-transition-counter-transform", counter);
      }
    }
  }

  currentProgress(fallback: number) {
    const target = this.#active?.target ?? this.#active?.registration.element;
    if (!target?.isConnected) return fallback;
    const value = Number.parseFloat(
      getComputedStyle(target).getPropertyValue("--lightbox-progress"),
    );
    return Number.isFinite(value) ? value : fallback;
  }

  prepareControlsReveal(delay: number) {
    const target = this.#active?.target;
    const actions = target?.querySelector<HTMLElement>("[data-lightbox-video-actions]");
    if (!target || !actions) return undefined;
    target.style.setProperty("--lightbox-controls-reveal-delay", `${delay}ms`);
    target.dataset.lightboxControlsRevealing = "";
    return actions
      .getAnimations()
      .find(
        (animation) =>
          (animation as CSSAnimation).animationName === "lightbox-video-actions-reveal",
      );
  }

  finishControlsReveal() {
    const target = this.#active?.target;
    if (!target) return;
    delete target.dataset.lightboxControlsRevealing;
    target.style.removeProperty("--lightbox-controls-reveal-delay");
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
    if (!target) return;
    const counterTargets = new Set(this.#counterScaleTargets(target));
    const counterMotion = frameMotion.map(({ offset, transform }) => {
      const value = String(transform ?? "none");
      const matrix = new DOMMatrix(value === "none" ? undefined : value);
      return {
        offset,
        transform: `scale(${1 / Math.max(0.0001, Math.abs(matrix.a))}, ${1 / Math.max(0.0001, Math.abs(matrix.d))})`,
      };
    });
    for (const animation of animations) {
      if (!(animation.effect instanceof KeyframeEffect)) continue;
      const effectTarget = animation.effect.target;
      if (
        effectTarget === target &&
        animation.effect.getKeyframes().some((frame) => frame.transform)
      ) {
        animation.effect.setKeyframes(targetMotion(frameMotion));
      } else if (effectTarget instanceof HTMLElement && counterTargets.has(effectTarget)) {
        animation.effect.setKeyframes(counterMotion);
      }
    }
  }

  preservePaint() {
    const active = this.#active;
    if (!active) return;
    for (const target of new Set([active.registration.element, active.frameLayer, active.target])) {
      if (!target?.isConnected) continue;
      const style = getComputedStyle(target);
      target.style.setProperty(
        "--lightbox-progress",
        style.getPropertyValue("--lightbox-progress"),
      );
    }
    if (active.frameLayer?.dataset.lightboxTravelLayer !== undefined) {
      const { transform, width, height } = getComputedStyle(active.frameLayer);
      Object.assign(active.frameLayer.style, { transform, width, height });
    }
    if (active.target) {
      const matrix = new DOMMatrix(getComputedStyle(active.target).transform);
      active.target.style.setProperty("--lightbox-transition-transform", matrix.toString());
      const counter = counterScale(matrix);
      active.target.style.setProperty("--lightbox-transition-counter-transform", counter);
      for (const target of this.#counterScaleTargets(active.target)) {
        target.style.setProperty("--lightbox-transition-counter-transform", counter);
      }
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
    target.dataset.lightboxPhase = phase;
    target.style.setProperty("--lightbox-progress", String(progress));
  }

  #position(target: HTMLElement, frame: HTMLElement) {
    const view = this.#document.defaultView!;
    const rect = frame.getBoundingClientRect();
    // The target receives the frame's transform animation. Position it at the
    // frame's layout box so the current transform is not applied twice.
    const transformValue = getComputedStyle(frame).transform;
    const transform = new DOMMatrix(transformValue === "none" ? undefined : transformValue);
    target.style.setProperty("--lightbox-transition-width", `${frame.offsetWidth}px`);
    target.style.setProperty("--lightbox-transition-height", `${frame.offsetHeight}px`);
    target.style.setProperty(
      "--lightbox-transition-left",
      `${rect.left - transform.e + view.scrollX}px`,
    );
    target.style.setProperty(
      "--lightbox-transition-top",
      `${rect.top - transform.f + view.scrollY}px`,
    );
  }

  #counterScaleTargets(target: HTMLElement) {
    return Array.from(target.children).flatMap((child) => {
      if (!(child instanceof HTMLElement)) return [];
      const marked = Array.from(
        child.querySelectorAll<HTMLElement>("[data-lightbox-counter-scale]"),
      );
      return marked.length ? marked : [child];
    });
  }

  #disposeActive() {
    const active = this.#active;
    if (!active) return;
    delete active.target?.dataset.lightboxControlsRevealing;
    active.target?.style.removeProperty("--lightbox-controls-reveal-delay");
    active.controller?.abort();
    active.dispose?.();
    active.target?.remove();
    for (const animation of active.layerAnimations) animation.cancel();
    if (active.frameLayer && active.marker?.isConnected) {
      delete active.frameLayer.dataset.lightboxTravelLayer;
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
    delete target.dataset.lightboxPhase;
    target.style.removeProperty("--lightbox-progress");
  }
}
