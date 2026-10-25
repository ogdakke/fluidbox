import {
  ApplicationRef,
  PLATFORM_ID,
  inject,
  type EmbeddedViewRef,
  type Injector,
  type NgZone,
  type TemplateRef,
} from "@angular/core";
import type { FluidboxItem } from "@ogdakke/fluidbox";

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

/**
 * Whether a view holds a `@defer` block, at any depth, that hasn't shown its
 * content or its error yet. An unknown shape of Angular's view data counts as
 * nothing pending, so the slide commits as it renders.
 */
export function deferPending(view: EmbeddedViewRef<unknown>): boolean {
  try {
    return pendingIn((view as unknown as { _lView?: unknown })._lView, 0);
  } catch {
    return false;
  }
}

function pendingIn(lView: unknown, depth: number): boolean {
  if (!Array.isArray(lView) || depth > 64) return false;
  const data = (lView[TVIEW] as { data?: unknown } | undefined)?.data;
  if (Array.isArray(data)) {
    for (let slot = 0; slot < data.length; slot++) {
      const entry = data[slot] as Record<string, unknown> | null;
      if (
        entry &&
        typeof entry === "object" &&
        "primaryTmplIndex" in entry &&
        "loadingState" in entry
      ) {
        const state = (lView[slot] as unknown[] | undefined)?.[DEFER_STATE];
        if (!DEFER_DONE.includes(state as number)) return true;
      }
    }
  }
  for (let child = lView[CHILD_HEAD] as unknown[] | null; child; child = child[NEXT] as never) {
    if (child[TVIEW] === true) {
      for (let at = CONTAINER_HEADER; at < child.length; at++) {
        if (pendingIn(child[at], depth + 1)) return true;
      }
    } else if (pendingIn(child, depth + 1)) return true;
  }
  return false;
}

/** How long a slide's `@defer` is watched: past the open's three seconds, its commit counts for nothing. */
const DEFER_WATCH = 3500;

/**
 * Wait for a view's `@defer` blocks to show their content, checking once a
 * frame, then call `done`. Content in a `@defer` renders inside the slide,
 * as its placeholder did, and the open waits for it as it does for the rest.
 * A block that waits for an interaction stops being watched once the open
 * would no longer wait. Returns a function that stops waiting.
 */
export function whenDeferred(
  view: EmbeddedViewRef<unknown>,
  check: () => void,
  done: () => void,
): () => void {
  if (!deferPending(view)) {
    done();
    return () => {};
  }
  const until = performance.now() + DEFER_WATCH;
  let frame = 0;
  const poll = () => {
    if (deferPending(view) && performance.now() < until) {
      frame = requestAnimationFrame(poll);
      return;
    }
    // The block's content has its bindings once the view is checked.
    check();
    done();
  };
  frame = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(frame);
}
