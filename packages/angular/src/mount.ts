import {
  type ApplicationRef,
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

// The slots of Angular's view data a loading @defer is read from. They are the
// same from Angular 17.3 to 22: a view's TView is at 1, and its first child
// view or container at 12, each linking to the next at 4; a container marks
// its slot 1 `true` and holds its views from 10. A defer block's details sit
// in the TView's data, with its dependencies' loading state; in the view, its
// details hold the state it shows at 1 and the state it is headed for at 0.
const TVIEW = 1;
const CHILD_HEAD = 12;
const NEXT = 4;
const CONTAINER_HEADER = 10;
const DEFER_NEXT_STATE = 0;
const DEFER_STATE = 1;
/** DeferBlockState.Loading, and Complete: from there the block shows its content or its error. */
const DEFER_LOADING = 1;
const DEFER_DONE = 2;
/** DeferDependenciesLoadingState.IN_PROGRESS: the block's dependencies are loading. */
const DEPENDENCIES_LOADING = 1;

/**
 * What a view's `@defer` blocks are doing: one is loading; one shows its
 * placeholder and hasn't been triggered; all show their content or error, or
 * there is none; or "unknown", for view data of a shape this doesn't read.
 */
type DeferStatus = "loading" | "waiting" | "settled" | "unknown";
const rank: Record<DeferStatus, number> = { settled: 0, waiting: 1, loading: 2, unknown: 3 };

function deferStatus(views: Iterable<EmbeddedViewRef<unknown>>): DeferStatus {
  let status: DeferStatus = "settled";
  try {
    for (const view of views) {
      const own = statusIn((view as unknown as { _lView?: unknown })._lView, 0);
      if (rank[own] > rank[status]) status = own;
    }
  } catch {
    return "unknown";
  }
  return status;
}

function statusIn(lView: unknown, depth: number): DeferStatus {
  const tView = Array.isArray(lView) ? (lView[TVIEW] as { data?: unknown; type?: unknown }) : null;
  if (!tView || !Array.isArray(tView.data) || typeof tView.type !== "number") return "unknown";
  if (depth > 64) return "settled";
  let status: DeferStatus = "settled";
  const raise = (to: DeferStatus) => {
    if (rank[to] > rank[status]) status = to;
  };
  const data = tView.data as unknown[];
  for (let slot = 0; slot < data.length; slot++) {
    const entry = data[slot] as { primaryTmplIndex?: unknown; loadingState?: unknown } | null;
    if (!entry || typeof entry !== "object" || !("primaryTmplIndex" in entry)) continue;
    if (!("loadingState" in entry)) return "unknown";
    const details = (lView as unknown[])[slot];
    if (!Array.isArray(details)) return "unknown";
    const state = details[DEFER_STATE] as number;
    const next = details[DEFER_NEXT_STATE] as number | null;
    if (state >= DEFER_DONE) continue;
    raise(
      state === DEFER_LOADING ||
        (typeof next === "number" && next >= DEFER_LOADING) ||
        entry.loadingState === DEPENDENCIES_LOADING
        ? "loading"
        : "waiting",
    );
  }
  for (
    let child = (lView as unknown[])[CHILD_HEAD] as unknown[] | null;
    child;
    child = child[NEXT] as never
  ) {
    const views = child[TVIEW] === true ? child.slice(CONTAINER_HEADER) : [child];
    for (const inner of views) raise(statusIn(inner, depth + 1));
  }
  return status;
}

/** How many frames since a slide rendered a block that shows its placeholder may still be triggered, as `on immediate` and `when` are. */
const TRIGGER_FRAMES = 2;

let warned = false;

/** Warn once, in development, that a @defer in a slide can't hold the open. */
function warnUnreadable(): void {
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
}

/**
 * Hold a slide's open while a `@defer` block in its media content is loading,
 * through the slide's `waitUntil`, so the open waits as it does for the
 * slide's images, at most its three seconds. A block that still shows its
 * placeholder a frame or two after the slide rendered waits for something
 * else, an interaction or a condition, so the open doesn't wait for it.
 * Angular has no public way to know, so this reads Angular's view data;
 * content can always hold the open itself with
 * `injectFluidboxSlide().waitUntil()`, called outside the block with a
 * promise the deferred content settles.
 *
 * The views are checked once a frame, outside Angular's zone, only while the
 * slide is opening or on show, and no longer once nothing is loading.
 */
export function holdForDeferred(
  zone: NgZone,
  views: () => Iterable<EmbeddedViewRef<unknown>>,
  slide: FluidboxSlide<any>,
): void {
  const status = deferStatus(views());
  if (status === "unknown") return warnUnreadable();
  if (status === "settled") return;
  let shown!: () => void;
  slide.waitUntil(new Promise<void>((resolve) => (shown = resolve)));
  let frame = 0;
  let frames = 0;
  let done = false;
  const stop = () => {
    done = true;
    cancelAnimationFrame(frame);
    frame = 0;
    shown();
  };
  const poll = () => {
    frame = 0;
    frames += 1;
    if (done || slide.signal.aborted) return stop();
    const now = deferStatus(views());
    if (now === "unknown") {
      warnUnreadable();
      return stop();
    }
    if (now === "settled" || (now === "waiting" && frames > TRIGGER_FRAMES)) return stop();
    if (slide.active || slide.opening) schedule();
  };
  const schedule = () => {
    if (!frame && !done) zone.runOutsideAngular(() => (frame = requestAnimationFrame(poll)));
  };
  const stopActive = slide.onActiveChange((active) => {
    if (active) schedule();
  });
  slide.signal.addEventListener("abort", () => {
    stopActive();
    stop();
  });
  schedule();
}
