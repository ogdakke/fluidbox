export interface ViewerPortalElements {
  readonly overlay: HTMLDivElement;
  readonly container: HTMLDivElement;
  readonly backdrop: HTMLDivElement;
  readonly dialog: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly media: HTMLImageElement;
  readonly closeButton: HTMLButtonElement | null;
  readonly status: HTMLSpanElement;
  readonly portalTarget: HTMLDivElement;
}

function required<TElement extends Element>(root: ParentNode, selector: string): TElement {
  const element = root.querySelector<TElement>(selector);
  if (!element) throw new Error(`Viewer portal is missing ${selector}.`);
  return element;
}

/** Create the runtime-owned body portal without registering custom elements. */
export interface ViewerPortalOptions {
  readonly defaultCloseButton?: boolean;
}

export function createViewerPortal(
  ownerDocument: Document = document,
  options: ViewerPortalOptions = {},
): ViewerPortalElements {
  const defaultCloseButton = options.defaultCloseButton ?? true;
  const overlay = ownerDocument.createElement("div");
  overlay.dataset.fluidboxOverlay = "";
  overlay.innerHTML = `
    <div data-fluidbox-backdrop></div>
    <div data-fluidbox-container>
      <div data-fluidbox-dialog role="dialog" aria-modal="true"
           aria-label="Image viewer" tabindex="-1">
        <div data-fluidbox-frame><img data-fluidbox-media part="image" /></div>
        ${defaultCloseButton ? '<button type="button" data-fluidbox-close aria-label="Close">&times;</button>' : ""}
        <span data-fluidbox-status role="status" aria-live="polite" aria-atomic="true"></span>
        <div data-fluidbox-portal></div>
      </div>
    </div>
  `;
  return {
    overlay,
    container: required(overlay, "[data-fluidbox-container]"),
    backdrop: required(overlay, "[data-fluidbox-backdrop]"),
    dialog: required(overlay, "[data-fluidbox-dialog]"),
    frame: required(overlay, "[data-fluidbox-frame]"),
    media: required(overlay, "[data-fluidbox-media]"),
    closeButton: overlay.querySelector("[data-fluidbox-close]"),
    status: required(overlay, "[data-fluidbox-status]"),
    portalTarget: required(overlay, "[data-fluidbox-portal]"),
  };
}

/** Owns inert background state for one active body-level portal. */
export class ViewerModalIsolation {
  readonly #overlay: HTMLElement;
  readonly #additionalExempt: () => Element | null;
  readonly #inertElements = new Map<Element, boolean>();
  #observer: MutationObserver | undefined;

  constructor(overlay: HTMLElement, additionalExempt: () => Element | null = () => null) {
    this.#overlay = overlay;
    this.#additionalExempt = additionalExempt;
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
    const additionalExempt = this.#additionalExempt();
    for (const element of this.#overlay.ownerDocument.body.children) {
      if (
        element === this.#overlay ||
        element === additionalExempt ||
        this.#inertElements.has(element)
      )
        continue;
      this.#inertElements.set(element, element.hasAttribute("inert"));
      element.setAttribute("inert", "");
    }
  }
}
