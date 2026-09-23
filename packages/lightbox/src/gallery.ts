import type { AppLightbox } from "./lightbox";

/** Gallery membership is read when opening, so dynamically added images work too. */
export class AppGallery extends HTMLElement {
  get lightboxes(): AppLightbox[] {
    return Array.from(this.querySelectorAll<AppLightbox>("app-lightbox")).filter(
      (lightbox) => lightbox.closest("app-gallery") === this,
    );
  }

  public scrollItemIntoView(lightbox: AppLightbox) {
    if (lightbox.closest("app-gallery") !== this) return;
    const target = lightbox.hasAttribute("data-lightbox-preview-hidden")
      ? (this.querySelector<HTMLElement>(":scope > [data-lightbox-preview-more]") ?? lightbox)
      : lightbox;
    target.scrollIntoView({
      behavior: "instant",
      block: "center",
      inline: "nearest",
    });
  }
}

if (!customElements.get("app-gallery")) {
  customElements.define("app-gallery", AppGallery);
}
