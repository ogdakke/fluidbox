import type { AppLightbox } from "./lightbox";
import type { LightboxGallerySource } from "./source";

/** DOM galleries and indexed sources share the same viewer. */
export class AppGallery extends HTMLElement {
  #source: LightboxGallerySource | null = null;
  #controller: AppLightbox | null = null;

  connectedCallback() {
    this.#ensureController();
  }

  get source(): LightboxGallerySource | null {
    return this.#source;
  }

  set source(source: LightboxGallerySource | null) {
    this.#source = source;
    if (source) {
      if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
      if (this.isConnected) this.#ensureController();
    } else {
      this.#controller?.remove();
      this.#controller = null;
    }
  }

  get itemCount(): number {
    return this.#source?.count ?? this.lightboxes.length;
  }

  get lightboxes(): AppLightbox[] {
    return Array.from(this.querySelectorAll<AppLightbox>("app-lightbox")).filter(
      (lightbox) => lightbox.closest("app-gallery") === this && lightbox !== this.#controller,
    );
  }

  /** Opens an indexed source without mounting its entire thumbnail collection. */
  open(index: number) {
    const source = this.#source;
    if (!source) throw new Error("app-gallery.open(index) requires a gallery source.");
    if (!Number.isInteger(index) || index < 0 || index >= source.count) {
      throw new RangeError(`Gallery index ${index} is out of range.`);
    }
    this.#ensureController();
    const controller = this.#controller!;
    if (controller.isOpen) {
      controller.select(index);
      return;
    }
    const item = source.getItem(index);
    controller.dataset.lightboxSourceIndex = String(index);
    controller.setAttribute("src", item.src);
    controller.setAttribute("alt", item.alt ?? "");
    controller.open();
  }

  #ensureController() {
    if (!this.#source || this.#controller) return;
    const controller = document.createElement("app-lightbox") as AppLightbox;
    controller.hidden = true;
    controller.dataset.lightboxSourceController = "";
    controller.setAttribute("close-button", "");
    this.#controller = controller;
    this.append(controller);
  }

  public scrollItemIntoView(lightbox: AppLightbox) {
    if (lightbox.closest("app-gallery") !== this) return;
    const target = lightbox.hasAttribute("data-lightbox-preview-hidden")
      ? (this.querySelector<HTMLElement>(":scope > [data-lightbox-preview-more]") ?? lightbox)
      : lightbox;
    target.scrollIntoView({ behavior: "instant", block: "center", inline: "nearest" });
  }
}

if (!customElements.get("app-gallery")) {
  customElements.define("app-gallery", AppGallery);
}
