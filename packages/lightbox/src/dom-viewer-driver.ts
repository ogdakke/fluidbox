import { originIsVisible } from "./origin-geometry";
import type {
  LightboxController,
  LightboxDispose,
  LightboxImageMedia,
  LightboxItem,
  LightboxPortalRenderer,
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

const OPEN_DURATION = 260;
const CLOSE_DURATION = 220;
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
  #portalDispose: LightboxDispose | undefined;
  #animations: Animation[] = [];
  #interruptedPose: PaintedPose | undefined;
  #returnFocus: HTMLElement | null = null;
  #destroyed = false;

  constructor(ownerDocument: Document) {
    this.#portal = createViewerPortal(ownerDocument, { defaultCloseButton: false });
    this.#isolation = new ViewerModalIsolation(this.#portal.overlay);
    this.#portal.dialog.dataset.lightboxHeadless = "";
    this.#portal.container.addEventListener(
      "click",
      (event) => {
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

  async open(context: ViewerSessionMotionContext<TItem>) {
    this.#assertImage(context.item);
    this.#cancelAnimations(true);
    this.#render(context.item, context.index);
    this.#returnFocus =
      context.origin?.trigger ??
      (this.#portal.overlay.ownerDocument.activeElement instanceof HTMLElement
        ? this.#portal.overlay.ownerDocument.activeElement
        : null);
    if (!this.#portal.overlay.isConnected) {
      this.#portal.overlay.ownerDocument.body.append(this.#portal.overlay);
    }
    this.#isolation.activate();
    this.#setState("opening");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (context.signal.aborted) return;

    const interruptedPose = this.#takeInterruptedPose();
    const origin = context.origin?.visual;
    const target = this.#portal.frame.getBoundingClientRect();
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
        this.#portal.frame.animate(frameMotion, {
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
    this.#render(context.item, context.index);
    await this.#play(
      [
        this.#portal.media.animate([{ opacity: 0.35 }, { opacity: 1 }], {
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
    const frame = this.#portal.frame.getBoundingClientRect();
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
        this.#portal.frame.animate(frameMotion, {
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
    this.#cancelAnimations(false);
    this.#portalDispose?.();
    this.#portalDispose = undefined;
    this.#finishClose();
  }

  #render(item: TItem, index: number) {
    this.#assertImage(item);
    const media = item.media;
    this.#portal.media.src = media.src;
    this.#portal.media.alt = media.alt;
    this.#portal.media.width = media.width;
    this.#portal.media.height = media.height;
    this.#portal.media.style.setProperty(
      "--lightbox-media-aspect",
      `${media.width} / ${media.height}`,
    );
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
      const frame = getComputedStyle(this.#portal.frame);
      this.#interruptedPose = {
        transform: frame.transform,
        opacity: frame.opacity,
        borderTopLeftRadius: frame.borderTopLeftRadius,
        borderTopRightRadius: frame.borderTopRightRadius,
        borderBottomRightRadius: frame.borderBottomRightRadius,
        borderBottomLeftRadius: frame.borderBottomLeftRadius,
        backdropOpacity: getComputedStyle(this.#portal.backdrop).opacity,
      };
      Object.assign(this.#portal.frame.style, {
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
      this.#portal.frame.style.removeProperty(property);
    }
    this.#portal.backdrop.style.removeProperty("opacity");
    this.#portal.media.style.removeProperty("opacity");
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
}
