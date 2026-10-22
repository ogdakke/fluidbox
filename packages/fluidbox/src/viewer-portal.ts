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
  // Built node by node, never from HTML, so Trusted Types has nothing to refuse.
  const part = <TName extends keyof HTMLElementTagNameMap>(
    tag: TName,
    name: string,
    ...children: Element[]
  ) => {
    const element = ownerDocument.createElement(tag);
    element.setAttribute(`data-fluidbox-${name}`, "");
    element.append(...children);
    return element;
  };
  const media = part("img", "media");
  media.setAttribute("part", "image");
  const frame = part("div", "frame", media);
  const status = part("span", "announcer");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const portalTarget = part("div", "portal");
  const addons = part("div", "addons");
  const dialog = part("div", "dialog", frame, status, portalTarget, addons);
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.tabIndex = -1;
  // The dialog's name until an item names it.
  dialog.setAttribute("aria-label", label);
  const backdrop = part("div", "backdrop");
  const container = part("div", "container", dialog);
  const overlay = part("div", "overlay", backdrop, container);
  return { overlay, container, backdrop, dialog, frame, media, status, portalTarget, addons };
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
