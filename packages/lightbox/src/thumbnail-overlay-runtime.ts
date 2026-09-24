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
}

let progressRegistered = false;

/** Publishes thumbnail-overlay motion without taking ownership of application DOM. */
export class ThumbnailOverlayRuntime<TItem extends LightboxItem> {
  readonly #document: Document;
  readonly #registrations = new Map<LightboxItemId, LightboxThumbnailOverlayRegistration<TItem>>();
  #active: ActiveOverlay<TItem> | undefined;

  constructor(ownerDocument: Document) {
    this.#document = ownerDocument;
    const css = ownerDocument.defaultView?.CSS;
    if (!progressRegistered && css && "registerProperty" in css) {
      try {
        css.registerProperty({
          name: "--lightbox-progress",
          syntax: "<number>",
          inherits: true,
          initialValue: "1",
        });
      } catch {
        // A custom-element viewer or another direct viewer may have registered it.
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
        const target = this.#document.createElement("div");
        target.dataset.lightboxTransitionContent = "";
        target.setAttribute("aria-hidden", "true");
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
        };
      } else {
        this.#active = { id: item.id, item, index, registration };
      }
    } else if (active.target) {
      this.#position(active.target, frame);
    }
    this.set(phase, progress);
  }

  animations(frameMotion: Keyframe[], duration: number, from: number, to: number): Animation[] {
    const active = this.#active;
    if (!active) return [];
    const options: KeyframeAnimationOptions = { duration, easing: "linear", fill: "both" };
    const progress = [
      { "--lightbox-progress": String(from) },
      { "--lightbox-progress": String(to) },
    ] as Keyframe[];
    const targets = [active.registration.element, active.target].filter(
      (element): element is HTMLElement => !!element && element.isConnected,
    );
    const animations = targets.map((target) => target.animate(progress, options));
    if (!active.target) return animations;
    animations.push(
      active.target.animate(
        frameMotion.map(({ offset, transform }) => ({ offset, transform })),
        options,
      ),
    );
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
    if (!active.target) return;
    this.#publish(active.target, phase, progress);
    if (transform) {
      active.target.style.setProperty("--lightbox-transition-transform", transform.toString());
      const counter = `scale(${1 / Math.max(0.0001, Math.abs(transform.a))}, ${1 / Math.max(0.0001, Math.abs(transform.d))})`;
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
        animation.effect.setKeyframes(
          frameMotion.map(({ offset, transform }) => ({ offset, transform })),
        );
      } else if (effectTarget instanceof HTMLElement && counterTargets.has(effectTarget)) {
        animation.effect.setKeyframes(counterMotion);
      }
    }
  }

  preservePaint() {
    const active = this.#active;
    if (!active) return;
    for (const target of [active.registration.element, active.target]) {
      if (!target?.isConnected) continue;
      const style = getComputedStyle(target);
      target.style.setProperty(
        "--lightbox-progress",
        style.getPropertyValue("--lightbox-progress"),
      );
    }
    if (active.target) {
      const matrix = new DOMMatrix(getComputedStyle(active.target).transform);
      active.target.style.setProperty("--lightbox-transition-transform", matrix.toString());
      const counter = `scale(${1 / Math.max(0.0001, Math.abs(matrix.a))}, ${1 / Math.max(0.0001, Math.abs(matrix.d))})`;
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
    target.style.setProperty("--lightbox-transition-width", `${rect.width}px`);
    target.style.setProperty("--lightbox-transition-height", `${rect.height}px`);
    target.style.setProperty("--lightbox-transition-left", `${rect.left + view.scrollX}px`);
    target.style.setProperty("--lightbox-transition-top", `${rect.top + view.scrollY}px`);
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
