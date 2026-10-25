import {
  ApplicationRef,
  PLATFORM_ID,
  VERSION,
  booleanAttribute,
  inject,
  type EmbeddedViewRef,
  type Injector,
  type NgZone,
  type TemplateRef,
} from "@angular/core";
import type { FluidboxItem, FluidboxSlide } from "@ogdakke/fluidbox";

// The package build leaves the NODE_ENV check for the app's bundler, which
// drops the warning in production. A page without a bundler has no process.
declare const process: { env: { NODE_ENV?: string } };

/**
 * What the sheet's, the thumbnails' and a slide's templates get: `{ item,
 * index }`, with the item also as `$implicit`, so `let-item let-index="index"`.
 */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  $implicit: TItem;
  item: TItem;
  index: number;
  /**
   * In a slide, whether it is the one on show; on a thumbnail, whether its
   * item is. Kept up to date, as `let-active="active"`.
   */
  active?: boolean;
}

/**
 * A boolean input that may be left unset: a bare attribute reads as true, as
 * `booleanAttribute` reads it, and undefined stays undefined, for the default.
 */
export const optionalBoolean = (value: unknown): boolean | undefined =>
  value === undefined ? undefined : booleanAttribute(value);

/** True in the browser, false while rendering on the server. */
export function injectIsBrowser(): boolean {
  return inject(PLATFORM_ID) === "browser";
}

/** A template rendered into an element the runtime owns. */
export interface Mounted<C> {
  readonly view: EmbeddedViewRef<C>;
  /** Check the view again, as after a change to its context. */
  check(): void;
  /** Destroy the view and take its nodes out. */
  dispose(): void;
}

/**
 * Render a template straight into a runtime target. The view is made on its
 * own, checked, and only then put in the target, so a custom element or an
 * iframe in it joins the page once, with its bindings set, and never moves.
 * The application checks it from then on. Its DI is the template's own,
 * where it is declared, plus `injector`.
 */
export function mountView<C>(
  zone: NgZone,
  app: ApplicationRef,
  template: TemplateRef<C>,
  context: C,
  target: Element,
  injector?: Injector,
): Mounted<C> {
  return zone.run(() => {
    const view = template.createEmbeddedView(context, injector);
    app.attachView(view);
    view.detectChanges();
    target.append(...(view.rootNodes as Node[]));
    let disposed = false;
    return {
      view,
      check: () => {
        if (!disposed) zone.run(() => view.detectChanges());
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        // A view of its own leaves its nodes in the page when destroyed.
        const nodes = view.rootNodes as Node[];
        zone.run(() => view.destroy());
        for (const node of nodes) (node as ChildNode).remove();
      },
    };
  });
}

/** The application, for parts that mount views of their own. */
export function injectApp(): ApplicationRef {
  return inject(ApplicationRef);
}

// The slots of Angular's view data a pending @defer is read from. They are the
// same from Angular 17 to 22: a view's TView is at 1, and its first child view
// or container at 12, each linking to the next at 4; a container marks its
// slot 1 `true` and holds its views from 10. A defer block's details sit in
// the TView's data, and its state at slot 1 of the details in the view.
const TVIEW = 1;
const CHILD_HEAD = 12;
const NEXT = 4;
const CONTAINER_HEADER = 10;
const DEFER_STATE = 1;
/** DeferBlockState.Complete and DeferBlockState.Error: the block shows its content or its error. */
const DEFER_DONE = [2, 3];

/** What a view's `@defer` blocks are doing, or "unknown" for view data of a shape this doesn't read. */
type DeferStatus = "pending" | "shown" | "unknown";

function deferStatus(view: EmbeddedViewRef<unknown>): DeferStatus {
  try {
    return statusIn((view as unknown as { _lView?: unknown })._lView, 0);
  } catch {
    return "unknown";
  }
}

function statusIn(lView: unknown, depth: number): DeferStatus {
  const tView = Array.isArray(lView) ? (lView[TVIEW] as { data?: unknown; type?: unknown }) : null;
  if (!tView || !Array.isArray(tView.data) || typeof tView.type !== "number") return "unknown";
  if (depth > 64) return "shown";
  const data = tView.data as unknown[];
  for (let slot = 0; slot < data.length; slot++) {
    const entry = data[slot];
    if (
      entry &&
      typeof entry === "object" &&
      "primaryTmplIndex" in entry &&
      "loadingState" in entry
    ) {
      const details = (lView as unknown[])[slot];
      if (!Array.isArray(details)) return "unknown";
      if (!DEFER_DONE.includes(details[DEFER_STATE] as number)) return "pending";
    }
  }
  for (
    let child = (lView as unknown[])[CHILD_HEAD] as unknown[] | null;
    child;
    child = child[NEXT] as never
  ) {
    const views = child[TVIEW] === true ? child.slice(CONTAINER_HEADER) : [child];
    for (const inner of views) {
      const status = statusIn(inner, depth + 1);
      if (status !== "shown") return status;
    }
  }
  return "shown";
}

let warned = false;

/**
 * Hold a slide's open while its view has a `@defer` block that hasn't shown
 * its content or its error, through the slide's `waitUntil`, so the open
 * waits as it does for the slide's images, at most its three seconds. Angular
 * has no public way to know, so this reads Angular's view data; content can
 * always hold the open itself with `injectFluidboxSlide().waitUntil()`, called
 * outside the block with a promise the deferred content settles. While
 * the slide is on show or opening, the view is checked once a frame until the
 * block shows, and it stops when the slide is disposed.
 */
export function holdForDeferred(
  view: EmbeddedViewRef<unknown>,
  slide: FluidboxSlide<any>,
  check: () => void,
): void {
  const status = deferStatus(view);
  if (status === "unknown") {
    // Development builds only: an Angular update that changes the view data
    // should fail the tests, not stop holding the open without a word.
    try {
      if (process.env.NODE_ENV !== "production" && !warned) {
        warned = true;
        console.warn(
          `Fluidbox can't read Angular ${VERSION.full}'s view data, so a slide with a @defer block won't hold the open until it shows. Hold it with injectFluidboxSlide().waitUntil() from outside the block, with a promise the deferred content settles.`,
        );
      }
    } catch {}
    return;
  }
  if (status === "shown") return;
  let shown!: () => void;
  slide.waitUntil(new Promise<void>((resolve) => (shown = resolve)));
  let frame = 0;
  const poll = () => {
    frame = 0;
    if (slide.signal.aborted) return;
    if (deferStatus(view) !== "pending") {
      // The block's content has its bindings once the view is checked.
      check();
      shown();
    } else if (slide.active || slide.opening) frame = requestAnimationFrame(poll);
  };
  slide.onActiveChange((active) => {
    if (active && !frame) frame = requestAnimationFrame(poll);
  });
  slide.signal.addEventListener("abort", () => {
    cancelAnimationFrame(frame);
    shown();
  });
  frame = requestAnimationFrame(poll);
}
