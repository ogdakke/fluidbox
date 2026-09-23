import type { LightboxItem } from "./public-api";
import type {
  ViewerSessionCloseContext,
  ViewerSessionDriver,
  ViewerSessionMotionContext,
} from "./viewer-session";
import { clearViewerMotion, waitForViewerMotion } from "./viewer-motion-completion";

/** Minimal compatibility surface supplied by the current custom element. */
export interface ElementViewerTarget {
  open(): void;
  close(): void;
  select(index: number): void;
}

/** Keeps custom-element commands outside the plain session and future public factory. */
export class ElementViewerDriver<
  TItem extends LightboxItem = LightboxItem,
> implements ViewerSessionDriver<TItem> {
  readonly #target: ElementViewerTarget;

  constructor(target: ElementViewerTarget) {
    this.#target = target;
  }

  open(context: ViewerSessionMotionContext<TItem>) {
    const settled = waitForViewerMotion(this.#target, "open", context.signal);
    this.#target.open();
    return settled;
  }

  select(context: ViewerSessionMotionContext<TItem>) {
    const settled = waitForViewerMotion(this.#target, "selection", context.signal);
    this.#target.select(context.index);
    return settled;
  }

  close(context: ViewerSessionCloseContext) {
    const settled = waitForViewerMotion(this.#target, "close", context.signal);
    this.#target.close();
    return settled;
  }

  destroy() {
    clearViewerMotion(this.#target);
  }
}
