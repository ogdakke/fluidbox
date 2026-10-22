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

/**
 * What the viewer leaves usable while it is open, besides itself: elements you
 * mark `data-fluidbox-exempt`, and live regions, so a toast still speaks.
 */
const KEPT =
  "[data-fluidbox-exempt], [aria-live]:not([aria-live=off]), [role=status], [role=alert], [role=log]";

/** The modal `<dialog>` on top, if one is open. */
function openModal(ownerDocument: Document) {
  try {
    return Array.from(ownerDocument.querySelectorAll("dialog"))
      .filter((dialog) => dialog.matches(":modal"))
      .pop();
  } catch {
    // A browser without :modal has no modal dialog to escape either.
    return undefined;
  }
}

/**
 * Put the viewer at the end of the body. Over an open modal `<dialog>`, as a
 * quick view's, it goes inside the dialog, which leaves the rest of the page
 * inert, and into the top layer as a manual popover to show above it.
 */
export function mountViewerPortal(overlay: HTMLElement) {
  const modal = openModal(overlay.ownerDocument);
  (modal ?? overlay.ownerDocument.body).append(overlay);
  raise(overlay, !!modal);
}

/** Show a layer the viewer adds to the body, as a flight, above a viewer in the top layer. */
export function raiseWithViewer(layer: HTMLElement) {
  raise(layer, !!layer.ownerDocument.querySelector("[data-fluidbox-overlay][popover]"));
}

function raise(element: HTMLElement, topLayer: boolean) {
  if (!topLayer || !("showPopover" in element)) {
    element.removeAttribute("popover");
    return;
  }
  element.popover = "manual";
  element.showPopover();
}

/**
 * Makes the rest of the page inert while the viewer is open: what was there
 * when it opened, apart from what it keeps. What the page adds later, as a
 * popover or a drawer opened from the viewer's content, stays usable. It
 * gives back only the inert it set.
 */
export class ViewerModalIsolation {
  readonly #overlay: HTMLElement;
  /** Everything outside the viewer when it opened, apart from what it keeps. */
  readonly #outside = new Set<Element>();
  /** The part of that which this made inert. */
  readonly #inerted = new Set<Element>();

  constructor(overlay: HTMLElement) {
    this.#overlay = overlay;
  }

  activate() {
    if (this.#overlay.hasAttribute("data-fluidbox-modal")) return;
    this.#overlay.dataset.fluidboxModal = "";
    const kept = [this.#overlay, ...this.#overlay.ownerDocument.querySelectorAll(KEPT)];
    const isolate = (parent: Element) => {
      for (const element of parent.children) {
        if (kept.includes(element)) continue;
        // Go into a parent of something kept, and isolate what is beside it.
        if (kept.some((each) => element.contains(each))) {
          isolate(element);
          continue;
        }
        this.#outside.add(element);
        if (element.hasAttribute("inert")) continue;
        element.setAttribute("inert", "");
        this.#inerted.add(element);
      }
    };
    isolate(this.#overlay.ownerDocument.body);
  }

  deactivate() {
    delete this.#overlay.dataset.fluidboxModal;
    for (const element of this.#inerted) element.removeAttribute("inert");
    this.#inerted.clear();
    this.#outside.clear();
  }

  /** Whether a node was outside the viewer, and not kept, when it opened. */
  covers(node: Node) {
    for (const element of this.#outside) if (element.contains(node)) return true;
    return false;
  }
}
