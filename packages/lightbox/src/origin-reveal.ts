import type { LightboxGallerySource } from "./source";

export type OriginRevealReason = "open" | "selection";

/** Owns the single host-reveal request for an active viewer session. */
export class OriginRevealCoordinator {
  #controller: AbortController | undefined;

  abort() {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  request(source: LightboxGallerySource, id: string, index: number, reason: OriginRevealReason) {
    this.abort();
    const controller = new AbortController();
    this.#controller = controller;

    try {
      if (source.revealOrigin) {
        void Promise.resolve(
          source.revealOrigin(id, index, { signal: controller.signal, reason }),
        ).catch(() => {});
        return;
      }

      const origin = source.getOrigin?.(id);
      if (origin?.isConnected) {
        origin.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
      }
    } catch {
      // A host scroll failure must not strand the viewer.
    }
  }
}
