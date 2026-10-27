/**
 * The custom elements' parts: placeholders in a gallery's viewer template and
 * slide templates, expanded into what the bindings' parts render. They are not
 * custom elements, so they cost no registration.
 */
import type { FluidboxLabels } from "./labels";
import type {
  Fluidbox,
  FluidboxControlName,
  FluidboxItem,
  FluidboxOptions,
  FluidboxSlide,
  FluidboxSlideRenderer,
} from "./public-api";

export interface FluidboxPartsContext {
  readonly fluidbox: Fluidbox<any>;
  readonly labels: FluidboxLabels;
  readonly icons: FluidboxOptions["icons"];
  /** Ends the parts' subscriptions. */
  readonly signal: AbortSignal;
  /** In a slide template: the slide its parts follow. Elsewhere they follow the item on show. */
  readonly slide?: FluidboxSlide<any>;
}

/**
 * Each control's attribute. The viewer's wiring gives a control its command,
 * state and name, so the parts draw only the element, and stay out of the
 * gallery's first chunk.
 */
const CONTROLS: Readonly<Record<FluidboxControlName, string>> = {
  previous: "data-fluidbox-previous",
  next: "data-fluidbox-next",
  close: "data-fluidbox-close",
  zoomIn: "data-fluidbox-zoom-in",
  zoomOut: "data-fluidbox-zoom-out",
  zoomReset: "data-fluidbox-zoom-reset",
  counter: "data-fluidbox-counter",
  fullscreen: "data-fluidbox-fullscreen",
  download: "data-fluidbox-download",
  share: "data-fluidbox-share",
  slideshow: "data-fluidbox-slideshow",
  retry: "data-fluidbox-retry",
};
const NAMES = Object.keys(CONTROLS) as FluidboxControlName[];
const CONTROL_SELECTOR = NAMES.map((name) => `[${CONTROLS[name]}]`).join();

/** Controls that stand as elements of their own, as `<fluidbox-share>`. */
const ELEMENT_CONTROLS: Readonly<Record<string, FluidboxControlName>> = {
  "FLUIDBOX-FULLSCREEN": "fullscreen",
  "FLUIDBOX-DOWNLOAD": "download",
  "FLUIDBOX-SHARE": "share",
  "FLUIDBOX-SLIDESHOW": "slideshow",
};

const PARTS =
  "fluidbox-toolbar, fluidbox-zoom-controls, fluidbox-counter, fluidbox-caption, fluidbox-loading, fluidbox-error, fluidbox-fullscreen, fluidbox-download, fluidbox-share, fluidbox-slideshow";

const nameOf = (element: Element) => NAMES.find((name) => element.hasAttribute(CONTROLS[name]))!;

/**
 * A control as the viewer draws a default one: a button, a link for
 * Download, text for the counter. Without an icon it is marked
 * `data-fluidbox-default`, and the wiring writes its label as its text.
 */
function drawControl(
  ownerDocument: Document,
  name: FluidboxControlName,
  icons: FluidboxOptions["icons"],
  content?: readonly Node[] | null,
): HTMLElement {
  const element =
    name === "counter"
      ? ownerDocument.createElement("span")
      : name === "download"
        ? ownerDocument.createElement("a")
        : Object.assign(ownerDocument.createElement("button"), { type: "button" });
  element.setAttribute(CONTROLS[name], "");
  const icon = content ? null : name === "counter" ? undefined : icons?.[name]?.();
  if (content) element.append(...content);
  else if (icon) element.append(icon);
  else element.setAttribute("data-fluidbox-default", "");
  if (name === "counter") element.setAttribute("aria-hidden", "true");
  return element;
}

const warned = new Set<string>();
/** Tell a developer once, in development builds only. */
function warnOnce(message: string) {
  try {
    if (process.env.NODE_ENV !== "production" && !warned.has(message)) {
      warned.add(message);
      console.warn(message);
    }
  } catch {}
}

/** Whether an element holds anything a reader would see or hear. */
const holds = (element: Element) => element.childElementCount > 0 || !!element.textContent?.trim();

/** An item field as text: strings and numbers, nothing else. */
const text = (item: FluidboxItem | null, field: string) => {
  const value = item ? (item as unknown as Record<string, unknown>)[field] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

/** Give a part the placeholder's attributes, which win over its own. */
function adopt(from: Element, to: HTMLElement) {
  for (const { name, value } of Array.from(from.attributes)) to.setAttribute(name, value);
  return to;
}

/**
 * Expand the parts in `root`: `<fluidbox-toolbar>`, `<fluidbox-zoom-controls>`,
 * `<fluidbox-counter>`, `<fluidbox-caption>`, `<fluidbox-loading>`,
 * `<fluidbox-error>`, and `<fluidbox-fullscreen>`, `<fluidbox-download>`,
 * `<fluidbox-share>` and `<fluidbox-slideshow>`. An empty control button shows its label as text, as
 * the defaults do, and `data-fluidbox-text="field"` shows that field of the
 * item. In a slide, the controls are bound here, since the viewer's layer
 * wires only its own.
 */
export function expandParts(root: ParentNode, context: FluidboxPartsContext): void {
  const { fluidbox, labels, icons, signal, slide } = context;
  const ownerDocument = (root as Node).ownerDocument!;
  const control = (name: FluidboxControlName, content?: readonly Node[] | null) =>
    drawControl(ownerDocument, name, icons, content);
  /** Parts that show the item: the slide's, or the one on show. */
  const follows: ((item: FluidboxItem | null) => void)[] = [];
  /** Parts that show while the slide is loading or failed. */
  const statuses: ((busy: boolean, error: boolean) => void)[] = [];

  // An empty control shows your icon, or its label as text, as a default one
  // does. It stays the element it is, with your listeners and references.
  for (const element of root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
    const name = nameOf(element);
    const tag = name === "download" ? "A" : "BUTTON";
    if (
      name === "counter" ||
      element.tagName !== tag ||
      holds(element) ||
      element.hasAttribute("aria-label") ||
      element.hasAttribute("aria-labelledby")
    )
      continue;
    const icon = icons?.[name]?.();
    if (icon) element.append(icon);
    else element.setAttribute("data-fluidbox-default", "");
  }

  if (root.querySelector("fluidbox-controls")) {
    warnOnce(
      "<fluidbox-controls> is gone: use <fluidbox-toolbar> and <fluidbox-zoom-controls>, or controls of your own.",
    );
  }

  /** Put `part` where the placeholder was, while `shown` says so. */
  const present = (placeholder: Element, part: HTMLElement) => {
    const anchor = ownerDocument.createComment("");
    placeholder.replaceWith(anchor);
    let shown = false;
    return (on: boolean) => {
      if (on === shown) return;
      shown = on;
      if (on) anchor.after(part);
      else part.remove();
    };
  };

  // Read before a part that is hidden for now leaves the tree.
  const texts = Array.from(root.querySelectorAll<HTMLElement>("[data-fluidbox-text]"));

  for (const placeholder of root.querySelectorAll(PARTS)) {
    const tag = placeholder.tagName;
    const own = holds(placeholder) ? Array.from(placeholder.childNodes) : null;
    const name = ELEMENT_CONTROLS[tag];
    if (name) {
      placeholder.replaceWith(adopt(placeholder, control(name, own)));
    } else if (tag === "FLUIDBOX-TOOLBAR" || tag === "FLUIDBOX-ZOOM-CONTROLS") {
      const toolbar = tag === "FLUIDBOX-TOOLBAR";
      const group = ownerDocument.createElement("div");
      group.setAttribute("role", "group");
      if (!toolbar) group.setAttribute("aria-label", labels.zoomed);
      adopt(placeholder, group);
      group.setAttribute(toolbar ? "data-fluidbox-toolbar" : "data-fluidbox-zoom-controls", "");
      const defaults: readonly FluidboxControlName[] = toolbar
        ? ["previous", "next", "close"]
        : ["zoomIn", "zoomOut", "zoomReset"];
      group.append(...(own ?? defaults.map((each) => control(each))));
      placeholder.replaceWith(group);
    } else if (tag === "FLUIDBOX-COUNTER") {
      if (own) warnOnce("<fluidbox-counter> shows the count; its children are dropped.");
      placeholder.replaceWith(adopt(placeholder, control("counter")));
    } else if (tag === "FLUIDBOX-CAPTION") {
      // Without content of yours, nothing and no description for an item without a caption.
      const caption = adopt(placeholder, ownerDocument.createElement("div"));
      caption.setAttribute("data-fluidbox-caption", "");
      caption.setAttribute("data-fluidbox-description", "");
      if (own) caption.append(...own);
      const show = present(placeholder, caption);
      follows.push((item) => {
        const shown = text(item, "caption");
        // Your own content shows whatever the item has.
        if (!own) caption.textContent = shown;
        show(!!own || !!shown);
      });
    } else {
      // Loading and Error: their children, while the slide is loading or failed.
      const loading = tag === "FLUIDBOX-LOADING";
      const part = adopt(placeholder, ownerDocument.createElement("div"));
      if (loading) part.setAttribute("aria-hidden", "true");
      part.setAttribute(loading ? "data-fluidbox-loading" : "data-fluidbox-error-content", "");
      if (own) part.append(...own);
      // Off the page while hidden, so its controls, as Retry, look after themselves.
      for (const element of part.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
        fluidbox.bindControl(element, nameOf(element), { signal });
      }
      const show = present(placeholder, part);
      statuses.push((busy, error) => show(loading ? busy : error));
    }
  }

  for (const element of texts) {
    const field = element.dataset.fluidboxText!;
    follows.push((item) => (element.textContent = text(item, field)));
  }

  if (follows.length) {
    const follow = (item: FluidboxItem | null) => {
      for (const each of follows) each(item);
    };
    if (slide) follow(slide.item);
    else {
      let shown: FluidboxItem | null | undefined;
      const update = ({ item }: { item: FluidboxItem | null }) => {
        // A closing viewer keeps showing the item it closes from.
        if (item === shown || !item) return;
        follow((shown = item));
      };
      update(fluidbox.state);
      signal.addEventListener("abort", fluidbox.subscribe(update), { once: true });
    }
  }

  if (statuses.length) watchStatus(root, context, statuses);

  // The viewer's layer wires the controls in it; a slide's are bound here.
  if (slide) {
    for (const element of root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)) {
      fluidbox.bindControl(element, nameOf(element), { signal });
    }
  }
}

/** Tell `statuses` whether the slide, or the one on show, is loading or failed. */
function watchStatus(
  root: ParentNode,
  { slide, signal }: FluidboxPartsContext,
  statuses: readonly ((busy: boolean, error: boolean) => void)[],
) {
  const start = () => {
    const host = slide
      ? slide.media.closest<HTMLElement>("[data-fluidbox-slide]")
      : (root as Element).closest?.<HTMLElement>("[data-fluidbox-dialog]");
    if (!host || signal.aborted) return;
    const read = () => {
      const shown = slide ? host : host.querySelector("[data-fluidbox-slide][data-active]");
      const busy = !!shown?.hasAttribute("data-busy");
      const error = !!shown?.hasAttribute("data-error");
      for (const status of statuses) status(busy, error);
    };
    const observer = new MutationObserver(read);
    observer.observe(host, {
      attributes: true,
      attributeFilter: ["data-busy", "data-error", "data-active"],
      subtree: !slide,
    });
    signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    read();
  };
  // A slide's content is stamped before it joins the slide.
  if (slide) queueMicrotask(start);
  else start();
}

/**
 * A slide from a `<template data-fluidbox-slide>`: each slide gets a copy.
 * `<fluidbox-media>`'s children go in the media box, and its attributes on
 * it; `<fluidbox-image>` draws the built-in image there, of the item or of
 * its `field`; everything else goes in the slide's layer.
 */
export function templateSlide(
  template: HTMLTemplateElement,
  context: () => Omit<FluidboxPartsContext, "signal" | "slide">,
): FluidboxSlideRenderer<any> {
  return (slide) => {
    const { media, signal } = slide;
    const content = media.ownerDocument.importNode(template.content, true);
    const disposers: (() => void)[] = [];
    const box = content.querySelector("fluidbox-media");
    let zoom: boolean | undefined;
    // Placed before anything joins the page, so an iframe or a video loads once.
    if (box) {
      for (const { name, value } of Array.from(box.attributes)) {
        if (name === "zoom") {
          zoom = value !== "false";
          continue;
        }
        const before = media.getAttribute(name);
        media.setAttribute(name, name === "class" && before ? `${before} ${value}` : value);
        disposers.push(() =>
          before === null ? media.removeAttribute(name) : media.setAttribute(name, before),
        );
      }
    }
    for (const image of content.querySelectorAll("fluidbox-image")) {
      const field = image.getAttribute("field");
      image.remove();
      const { item } = slide;
      // Without a field, the item's own image: a typed item keeps its content's.
      const source = field
        ? (item as never)[field]
        : item.type === "image"
          ? undefined
          : ({ ...item, type: "image" } as never);
      disposers.push(slide.drawImage(source));
    }
    expandParts(content, { ...context(), signal, slide });
    // Each <fluidbox-hotspot x y> in the box becomes the slide's hotspot
    // button in its place, with its attributes and children.
    for (const pin of box?.querySelectorAll("fluidbox-hotspot") ?? []) {
      const button = slide.hotspot({
        x: pin.getAttribute("x") as `${number}%`,
        y: pin.getAttribute("y") as `${number}%`,
        // Present reads true, and "false" false, as the box's zoom does.
        scaleWithZoom: (pin.getAttribute("scale-with-zoom") ?? "false") !== "false",
      });
      for (const { name, value } of Array.from(pin.attributes)) {
        if (!["x", "y", "scale-with-zoom"].includes(name)) button.setAttribute(name, value);
      }
      button.append(...pin.childNodes);
      pin.replaceWith(button);
    }
    if (box) {
      media.append(...box.childNodes);
      box.remove();
    }
    // Its explicit zoom wins over the image's.
    if (zoom !== undefined) slide.zoomable(zoom);
    if (
      Array.from(content.childNodes).some((node) => node.nodeType === 1 || node.textContent?.trim())
    )
      slide.layer.append(content);
    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  };
}
