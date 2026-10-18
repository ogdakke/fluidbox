import type { LightboxOriginAdapter } from "@ogdakke/fluidbox";

/** Resolves origins from `[data-origin-id]` buttons inside `root` at the time the viewer asks. */
export function originsWithin(root: () => ParentNode | null | undefined): LightboxOriginAdapter {
  return {
    getOrigin(id) {
      const trigger = root()?.querySelector<HTMLElement>(`[data-origin-id="${CSS.escape(id)}"]`);
      if (!trigger) return null;
      // The visual is the clipped box: its border radius is what the flight morphs from and to.
      const visual = trigger.querySelector<HTMLElement>("[data-lightbox-origin]") ?? trigger;
      const thumbnail = trigger.querySelector("img") ?? undefined;
      return { trigger, visual, thumbnail };
    },
  };
}
