/** Register the browser custom elements after hydration or on a client-only page. */
export async function registerLightboxElements(): Promise<void> {
  if (typeof customElements === "undefined") return;
  await import("./elements");
}

export type { AppLightbox } from "./lightbox";
export type { GalleryItem } from "./gallery-strip";
