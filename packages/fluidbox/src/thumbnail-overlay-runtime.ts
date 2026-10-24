import { idOf } from "./items";
import {
  overlayProgressHolder,
  publishOverlayPhase,
  resetOverlayPhase,
  type ThumbnailOverlayPhase,
} from "./overlay-phase";
import type {
  FluidboxDispose,
  FluidboxItem,
  FluidboxItemId,
  FluidboxRenderer,
  FluidboxThumbnailOverlayRegistration,
} from "./runtime-types";

/** The overlays on one item's trigger, as one flight carries them. */
interface OverlayGroup<TItem extends FluidboxItem> {
  /** Every overlay, each of which gets the phase and progress. */
  readonly elements: readonly HTMLElement[];
  /** The one whose progress the flight reads back: the live one, else the first. */
  readonly element: HTMLElement;
  /** Draws live content into the flying frame. */
  readonly renderer?: FluidboxRenderer<TItem>;
  /** Moves into the flying frame and scales with it, as a scrim does. */
  readonly frameLayer?: HTMLElement;
}

interface ActiveOverlay<TItem extends FluidboxItem> {
  readonly id: FluidboxItemId;
  readonly item: TItem;
  readonly index: number;
  readonly group: OverlayGroup<TItem>;
  readonly controller?: AbortController;
  readonly target?: HTMLDivElement;
  readonly dispose?: FluidboxDispose;
  readonly frameLayer?: HTMLElement;
  readonly marker?: Comment;
  /** A still copy of the frame layer that stays on the card until the flight paints. */
  ghost?: HTMLElement;
  readonly previousStyles?: ReadonlyMap<string, string>;
  /** Children the runtime counter-scales, with the inline styles they had. */
  readonly adopted: Map<HTMLElement, { transform: string; transformOrigin: string }>;
  readonly observer?: MutationObserver;
  /** The frame's current transform, for children that arrive between flights. */
  scale: string;
  /** The flight in progress, for children that arrive during it. */
  motion?: { keyframes: Keyframe[]; options: KeyframeAnimationOptions; reference: Animation };
  readonly childAnimations: Animation[];
}

interface FrameBox {
  readonly width: number;
  readonly height: number;
}

function matrixOf(transform: string | DOMMatrix | null | undefined) {
  if (transform instanceof DOMMatrix) return transform;
  const value = String(transform ?? "none");
  return new DOMMatrix(value === "none" ? undefined : value);
}

/**
 * The travelling copy is laid out at the frame's full size and takes the
 * frame's whole transform, so it moves and scales with the frame on the
 * compositor. Its children scale back by the inverse (see `counterScale`).
 */
function targetStyle(transform: string | DOMMatrix | null | undefined, box: FrameBox) {
  const { a, d, e, f } = matrixOf(transform);
  return {
    transform: `matrix(${a}, 0, 0, ${d}, ${e}, ${f})`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
}

function targetMotion(frameMotion: Keyframe[], box: FrameBox): Keyframe[] {
  return frameMotion.map(({ offset, transform }) => ({
    offset,
    transform: targetStyle(transform as string | undefined, box).transform,
  }));
}

/**
 * A frame layer and the travelling copy both scale with the frame, so their
 * boxes always match it. Their children scale back by the inverse, so they
 * keep the size they had on the thumbnail. Everything moves by transforms,
 * which keeps the overlay in step with the frame on the compositor.
 */
function counterScale(transform: string | DOMMatrix | null | undefined) {
  const matrix = matrixOf(transform);
  const x = Math.max(0.0001, Math.abs(matrix.a));
  const y = Math.max(0.0001, Math.abs(matrix.d));
  return `scale(${1 / x}, ${1 / y})`;
}

/**
 * The frame's scale moves linearly between its keyframes, and its inverse
 * does not. Extra keyframes keep the inverse on the frame between them.
 */
function counterMotion(frameMotion: Keyframe[]): Keyframe[] {
  const steps = 4;
  const keyframes: Keyframe[] = [];
  frameMotion.forEach(({ offset, transform }, index) => {
    const matrix = matrixOf(transform as string | undefined);
    const previous = frameMotion[index - 1];
    if (previous && typeof previous.offset === "number" && typeof offset === "number") {
      const from = matrixOf(previous.transform as string | undefined);
      for (let step = 1; step < steps; step++) {
        const t = step / steps;
        keyframes.push({
          offset: previous.offset + (offset - previous.offset) * t,
          transform: counterScale(
            new DOMMatrix([
              from.a + (matrix.a - from.a) * t,
              0,
              0,
              from.d + (matrix.d - from.d) * t,
              0,
              0,
            ]),
          ),
        });
      }
    }
    keyframes.push({ offset, transform: counterScale(matrix) });
  });
  return keyframes;
}

/**
 * A child scales back around the edge it is anchored to, or around the
 * centre, so it sits where it would in a box of the frame's painted size: a
 * badge in a corner stays in the corner and a centred label stays centred.
 */
function anchoredOrigin(child: HTMLElement, container: HTMLElement) {
  if (child.offsetParent !== container) return "50% 50%";
  const axis = (start: number, size: number, extent: number) => {
    const end = extent - start - size;
    // Offsets round to whole pixels, so a centred child can be a pixel off.
    const anchor = Math.abs(start - end) <= 2 ? extent / 2 : start < end ? 0 : extent;
    return `${anchor - start}px`;
  };
  return `${axis(child.offsetLeft, child.offsetWidth, container.offsetWidth)} ${axis(
    child.offsetTop,
    child.offsetHeight,
    container.offsetHeight,
  )}`;
}

function elementChildren(container: HTMLElement) {
  return [...container.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

let progressRegistered = false;
const opacityResponse = 0.65;

/** Publishes thumbnail-overlay motion without taking ownership of application DOM. */
export class ThumbnailOverlayRuntime<TItem extends FluidboxItem> {
  readonly #document: Document;
  readonly #registrations = new Map<
    FluidboxItemId,
    FluidboxThumbnailOverlayRegistration<TItem>[]
  >();
  readonly #groups = new Map<FluidboxItemId, OverlayGroup<TItem>>();
  #active: ActiveOverlay<TItem> | undefined;
  readonly #boxes = new WeakMap<HTMLElement, FrameBox>();

  constructor(ownerDocument: Document) {
    this.#document = ownerDocument;
    const css = ownerDocument.defaultView?.CSS;
    if (!progressRegistered && css && "registerProperty" in css) {
      const properties: PropertyDefinition[] = [
        { name: "--fluidbox-closed", syntax: "<number>", inherits: true, initialValue: "1" },
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

  /** Add an overlay to an item's trigger, beside the ones it has. */
  register(id: FluidboxItemId, registration: FluidboxThumbnailOverlayRegistration<TItem>) {
    const list = this.#registrations.get(id) ?? [];
    list.push(registration);
    this.#registrations.set(id, list);
    this.#groups.delete(id);
    this.#publish(registration.element, "idle", 1);
    return () => {
      const at = list.indexOf(registration);
      if (at < 0) return;
      list.splice(at, 1);
      if (!list.length && this.#registrations.get(id) === list) this.#registrations.delete(id);
      this.#groups.delete(id);
      const { element } = registration;
      if (this.#active?.group.elements.includes(element)) return;
      if (!this.#group(id)?.elements.includes(element)) this.#reset(element);
    };
  }

  /** The overlays on an item's trigger, combined: one live, one frame layer, any that stay. */
  #group(id: FluidboxItemId): OverlayGroup<TItem> | undefined {
    const cached = this.#groups.get(id);
    if (cached) return cached;
    const list = this.#registrations.get(id);
    if (!list?.length) return undefined;
    const live = list.find((registration) => registration.behavior === "travel");
    const frame = list.find((registration) => registration.behavior === "frame");
    const group: OverlayGroup<TItem> = {
      elements: [...new Set(list.map((registration) => registration.element))],
      element: (live ?? list[0]!).element,
      renderer: live?.renderer,
      frameLayer: frame?.element,
    };
    this.#groups.set(id, group);
    return group;
  }

  prepare(
    item: TItem,
    index: number,
    frame: HTMLElement,
    phase: ThumbnailOverlayPhase,
    progress: number,
  ) {
    const group = this.#group(idOf(item));
    const active = this.#active;
    if (active?.group !== group || active?.id !== idOf(item)) {
      this.#disposeActive();
      if (!group) return;
      if (group.renderer || group.frameLayer) {
        const frameLayer = group.frameLayer;
        let marker: Comment | undefined;
        let ghost: HTMLElement | undefined;
        let previousStyles: Map<string, string> | undefined;
        if (frameLayer?.isConnected) {
          marker = this.#document.createComment("fluidbox-frame-layer");
          frameLayer.before(marker);
          // The card stays painted until the opening's first frame covers it.
          if (phase === "opening") {
            ghost = frameLayer.cloneNode(true) as HTMLElement;
            ghost.dataset.fluidboxGhost = "";
            for (const element of [ghost, ...ghost.querySelectorAll("[id]")]) {
              element.removeAttribute("id");
            }
            ghost.setAttribute("aria-hidden", "true");
            ghost.inert = true;
            ghost.style.visibility = "visible";
            marker.after(ghost);
          }
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
        const dispose = group.renderer?.({
          item,
          index,
          target,
          signal: controller.signal,
        });
        const next: ActiveOverlay<TItem> = {
          id: idOf(item),
          item,
          index,
          group,
          controller,
          target,
          dispose: dispose ?? undefined,
          frameLayer,
          marker,
          ghost,
          previousStyles,
          adopted: new Map(),
          // A framework renderer can fill the target after this call.
          observer: new MutationObserver(() => this.#adoptChildren(next)),
          scale: getComputedStyle(frame).transform,
          childAnimations: [],
        };
        this.#active = next;
        for (const container of [frameLayer, target]) {
          if (container) next.observer!.observe(container, { childList: true });
        }
        this.#adoptChildren(next);
      } else {
        this.#active = {
          id: idOf(item),
          item,
          index,
          group,
          adopted: new Map(),
          scale: "none",
          childAnimations: [],
        };
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
      return { offset, "--fluidbox-closed": String(from + (to - from) * fade) };
    }) as Keyframe[];
    const targets = [
      ...new Set([...active.group.elements, active.frameLayer, active.target]),
    ].filter((element): element is HTMLElement => !!element && element.isConnected);
    const animations = targets.map((target) =>
      this.#progressHolder(target).animate(progress, options),
    );
    if (!active.target) return animations;
    const box = this.#boxes.get(active.target);
    if (!box) return animations;
    const reference = active.target.animate(targetMotion(frameMotion, box), options);
    animations.push(reference);
    this.#stopChildren(active);
    active.motion = { keyframes: counterMotion(frameMotion), options, reference };
    for (const child of active.adopted.keys()) {
      const animation = child.animate(active.motion.keyframes, options);
      active.childAnimations.push(animation);
      animations.push(animation);
    }
    return animations;
  }

  set(phase: ThumbnailOverlayPhase, progress: number, transform?: DOMMatrix) {
    const active = this.#active;
    if (!active) return;
    for (const element of active.group.elements) this.#publish(element, phase, progress);
    if (!active.target) return;
    this.#publish(active.target, phase, progress);
    const frame = active.frameLayer?.parentElement;
    const scale = transform ?? (frame ? getComputedStyle(frame).transform : undefined);
    if (scale !== undefined) {
      active.scale = String(scale);
      for (const child of active.adopted.keys()) child.style.transform = counterScale(scale);
    }
    const box = this.#boxes.get(active.target);
    if (transform && box) this.#placeTarget(active.target, targetStyle(transform, box));
  }

  #placeTarget(target: HTMLElement, style: { transform: string; width: string; height: string }) {
    target.style.setProperty("--fluidbox-transition-transform", style.transform);
    target.style.setProperty("--fluidbox-transition-width", style.width);
    target.style.setProperty("--fluidbox-transition-height", style.height);
  }

  currentProgress(fallback: number) {
    const target = this.#active?.target ?? this.#active?.group.element;
    if (!target?.isConnected) return fallback;
    const value = Number.parseFloat(getComputedStyle(target).getPropertyValue("--fluidbox-closed"));
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
    const active = this.#active;
    const target = active?.target;
    const box = target && this.#boxes.get(target);
    if (!active || !target || !box) return;
    const counter = counterMotion(frameMotion);
    if (active.motion) active.motion.keyframes = counter;
    for (const animation of [...animations, ...active.childAnimations]) {
      if (!(animation.effect instanceof KeyframeEffect) || !animation.effect.target) continue;
      const element = animation.effect.target as HTMLElement;
      if (element === target && animation.effect.getKeyframes().some((frame) => frame.transform)) {
        animation.effect.setKeyframes(targetMotion(frameMotion, box));
      } else if (active.adopted.has(element)) {
        animation.effect.setKeyframes(counter);
      }
    }
  }

  preservePaint() {
    const active = this.#active;
    if (!active) return;
    for (const target of new Set([...active.group.elements, active.frameLayer, active.target])) {
      if (!target?.isConnected) continue;
      const holder = this.#progressHolder(target);
      holder.style.setProperty(
        "--fluidbox-closed",
        getComputedStyle(holder).getPropertyValue("--fluidbox-closed"),
      );
    }
    for (const child of active.adopted.keys()) {
      child.style.transform = getComputedStyle(child).transform;
    }
    if (active.target) {
      const { transform, width, height } = getComputedStyle(active.target);
      this.#placeTarget(active.target, { transform, width, height });
    }
    this.#stopChildren(active);
  }

  finishClose() {
    this.#disposeActive();
  }

  /** The flight has painted over the card. Its still copy of the frame layer can go. */
  releaseGhost() {
    const active = this.#active;
    active?.ghost?.remove();
    if (active) active.ghost = undefined;
  }

  destroy() {
    this.#disposeActive();
    for (const list of this.#registrations.values()) {
      for (const registration of list) this.#reset(registration.element);
    }
    this.#registrations.clear();
    this.#groups.clear();
  }

  /** Counter-scale the children of the frame layer and the target, including late ones. */
  #adoptChildren(active: ActiveOverlay<TItem>) {
    if (this.#active !== active) return;
    for (const container of [active.frameLayer, active.target]) {
      if (!container) continue;
      for (const child of elementChildren(container)) {
        if (active.adopted.has(child)) continue;
        active.adopted.set(child, {
          transform: child.style.transform,
          transformOrigin: child.style.transformOrigin,
        });
        child.style.transformOrigin = anchoredOrigin(child, container);
        child.style.transform = counterScale(active.scale);
        const motion = active.motion;
        if (motion && motion.reference.playState !== "finished") {
          const animation = child.animate(motion.keyframes, motion.options);
          animation.startTime = motion.reference.startTime;
          animation.currentTime = motion.reference.currentTime;
          if (motion.reference.playState === "paused") animation.pause();
          active.childAnimations.push(animation);
        }
      }
    }
    for (const [child, previous] of active.adopted) {
      if (child.parentElement === active.frameLayer || child.parentElement === active.target) {
        continue;
      }
      child.style.transform = previous.transform;
      child.style.transformOrigin = previous.transformOrigin;
      active.adopted.delete(child);
    }
  }

  #stopChildren(active: ActiveOverlay<TItem>) {
    for (const animation of active.childAnimations) animation.cancel();
    active.childAnimations.length = 0;
    active.motion = undefined;
  }

  #publish(target: HTMLElement, phase: ThumbnailOverlayPhase, progress: number) {
    publishOverlayPhase(target, phase, progress);
  }

  /**
   * The element that carries an overlay's progress. The travelling target
   * inherits it from its host: WebKit stops applying the target's animated
   * transform while the registered progress animates on the target.
   */
  #progressHolder(target: HTMLElement) {
    return overlayProgressHolder(target);
  }

  #position(target: HTMLElement, frame: HTMLElement) {
    const view = this.#document.defaultView!;
    const rect = frame.getBoundingClientRect();
    // The target is placed at the frame's layout box and takes the frame's transform.
    const transform = matrixOf(getComputedStyle(frame).transform);
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
    this.#active = undefined;
    active.observer?.disconnect();
    this.#stopChildren(active);
    for (const [child, previous] of active.adopted) {
      child.style.transform = previous.transform;
      child.style.transformOrigin = previous.transformOrigin;
    }
    delete active.target?.dataset.fluidboxControlsRevealing;
    active.target?.style.removeProperty("--fluidbox-controls-reveal-delay");
    active.controller?.abort();
    active.dispose?.();
    (active.target?.parentElement ?? active.target)?.remove();
    active.ghost?.remove();
    if (active.frameLayer && active.marker?.isConnected) {
      delete active.frameLayer.dataset.fluidboxTravelLayer;
      active.marker.replaceWith(active.frameLayer);
      for (const [property, value] of active.previousStyles ?? []) {
        if (value) active.frameLayer.style.setProperty(property, value);
        else active.frameLayer.style.removeProperty(property);
      }
    }
    // The overlays still on the trigger rest; the ones that left let go.
    const kept = this.#group(active.id)?.elements ?? [];
    for (const element of active.group.elements) {
      if (kept.includes(element)) this.#publish(element, "idle", 1);
      else this.#reset(element);
    }
  }

  #reset(target: HTMLElement) {
    resetOverlayPhase(target);
  }
}
