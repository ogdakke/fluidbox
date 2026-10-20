export interface ViewerPortalElements {
  readonly overlay: HTMLDivElement;
  readonly container: HTMLDivElement;
  readonly backdrop: HTMLDivElement;
  readonly dialog: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly media: HTMLImageElement;
  readonly status: HTMLSpanElement;
  readonly portalTarget: HTMLDivElement;
  /** Where add-ons put what floats over the slides, apart from the content drawn into the layer. */
  readonly addons: HTMLDivElement;
}

/** Create the runtime-owned body portal without registering custom elements. */
export function createViewerPortal(ownerDocument: Document, label: string): ViewerPortalElements {
  const overlay = ownerDocument.createElement("div");
  overlay.dataset.fluidboxOverlay = "";
  overlay.innerHTML = `
    <div data-fluidbox-backdrop></div>
    <div data-fluidbox-container>
      <div data-fluidbox-dialog role="dialog" aria-modal="true"
           tabindex="-1">
        <div data-fluidbox-frame><img data-fluidbox-media part="image" /></div>
        <span data-fluidbox-announcer role="status" aria-live="polite" aria-atomic="true"></span>
        <div data-fluidbox-portal></div>
        <div data-fluidbox-addons></div>
      </div>
    </div>
  `;
  // The markup above is static, so every part is there.
  const part = <TElement extends Element>(name: string) =>
    overlay.querySelector<TElement>(`[data-fluidbox-${name}]`)!;
  const dialog = part<HTMLDivElement>("dialog");
  // The dialog's name until an item names it.
  dialog.setAttribute("aria-label", label);
  return {
    overlay,
    container: part("container"),
    backdrop: part("backdrop"),
    dialog,
    frame: part("frame"),
    media: part("media"),
    status: part("announcer"),
    portalTarget: part("portal"),
    addons: part("addons"),
  };
}

/** Owns inert background state for one active body-level portal. */
export class ViewerModalIsolation {
  readonly #overlay: HTMLElement;
  readonly #inertElements = new Map<Element, boolean>();
  #observer: MutationObserver | undefined;

  constructor(overlay: HTMLElement) {
    this.#overlay = overlay;
  }

  activate() {
    if (this.#observer) return;
    this.#isolate();
    const ownerWindow = this.#overlay.ownerDocument.defaultView;
    if (!ownerWindow) return;
    this.#observer = new ownerWindow.MutationObserver(() => this.#isolate());
    this.#observer.observe(this.#overlay.ownerDocument.body, { childList: true });
  }

  deactivate() {
    this.#observer?.disconnect();
    this.#observer = undefined;
    for (const [element, wasInert] of this.#inertElements) {
      element.toggleAttribute("inert", wasInert);
    }
    this.#inertElements.clear();
  }

  #isolate() {
    for (const element of this.#overlay.ownerDocument.body.children) {
      if (element === this.#overlay || this.#inertElements.has(element)) continue;
      this.#inertElements.set(element, element.hasAttribute("inert"));
      element.setAttribute("inert", "");
    }
  }
}
