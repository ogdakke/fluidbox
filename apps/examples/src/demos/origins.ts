import type { LightboxOriginAdapter } from "@ogdakke/fluidbox";

/** Resolves origins from `[data-origin-id]` buttons inside `root` at the time the viewer asks. */
export function originsWithin(root: () => ParentNode | null | undefined): LightboxOriginAdapter {
  return {
    getOrigin(id) {
      const trigger = root()?.querySelector<HTMLElement>(`[data-origin-id="${CSS.escape(id)}"]`);
      if (!trigger) return null;
      const image = trigger.querySelector("img") ?? undefined;
      return { trigger, visual: image ?? trigger, thumbnail: image };
    },
  };
}
