export type ViewerMotionKind = "open" | "close" | "selection";

interface MotionWaiter {
  readonly resolve: () => void;
  readonly removeAbort?: () => void;
}

/** Resolves adapter commands at semantic motion boundaries without polling DOM state. */
export class ViewerMotionCompletion {
  readonly #waiters = new Map<ViewerMotionKind, Set<MotionWaiter>>();

  wait(kind: ViewerMotionKind, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        waiter.removeAbort?.();
        this.#waiters.get(kind)?.delete(waiter);
        resolve();
      };
      const waiter: MotionWaiter = {
        resolve: finish,
        removeAbort: signal
          ? (() => {
              signal.addEventListener("abort", finish, { once: true });
              return () => signal.removeEventListener("abort", finish);
            })()
          : undefined,
      };
      const waiters = this.#waiters.get(kind) ?? new Set<MotionWaiter>();
      waiters.add(waiter);
      this.#waiters.set(kind, waiters);
    });
  }

  complete(kind: ViewerMotionKind) {
    const waiters = this.#waiters.get(kind);
    if (!waiters) return;
    this.#waiters.delete(kind);
    for (const waiter of waiters) waiter.resolve();
  }

  clear() {
    for (const kind of this.#waiters.keys()) this.complete(kind);
  }
}

const motionByOwner = new WeakMap<object, ViewerMotionCompletion>();

function completionFor(owner: object) {
  let completion = motionByOwner.get(owner);
  if (!completion) {
    completion = new ViewerMotionCompletion();
    motionByOwner.set(owner, completion);
  }
  return completion;
}

export function waitForViewerMotion(owner: object, kind: ViewerMotionKind, signal?: AbortSignal) {
  return completionFor(owner).wait(kind, signal);
}

export function completeViewerMotion(owner: object, kind: ViewerMotionKind) {
  motionByOwner.get(owner)?.complete(kind);
}

export function clearViewerMotion(owner: object) {
  motionByOwner.get(owner)?.clear();
  motionByOwner.delete(owner);
}
