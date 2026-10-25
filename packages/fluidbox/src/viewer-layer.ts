import { allControlNames, fluidboxControls, zoomControlNames } from "./controls";
import {
  boundControls,
  namingOf,
  paintControl,
  runControl,
  type ControlNaming,
} from "./control-wiring";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";
import type { FluidboxDispose, FluidboxViewerLayer } from "./runtime-types";

/** How each control in the layer is named as the state changes. */
const drawn = new WeakMap<Element, ControlNaming>();

/**
 * A default control: a button, a link for Download, so "Save link as" works,
 * and text for the counter. With no icon of yours it shows its label as text,
 * marked `data-fluidbox-default`; with one, the label names it.
 */
export function controlButton(
  ownerDocument: Document,
  name: FluidboxControlName,
  labels: FluidboxLabels,
  icons: FluidboxViewerLayer["icons"],
): HTMLElement {
  const control = fluidboxControls[name];
  const element =
    name === "counter"
      ? ownerDocument.createElement("span")
      : name === "download"
        ? ownerDocument.createElement("a")
        : Object.assign(ownerDocument.createElement("button"), { type: "button" });
  element.setAttribute(control.attribute, "");
  const icon = name === "counter" ? undefined : icons?.[name]?.();
  if (icon) {
    element.append(icon);
    element.setAttribute("aria-label", control.label(labels));
    drawn.set(element, "label");
  } else {
    element.dataset.fluidboxDefault = "";
    element.textContent = control.label(labels);
    // The dialog's name and the announcer already say where you are.
    if (name === "counter") element.setAttribute("aria-hidden", "true");
    drawn.set(element, "text");
  }
  return element;
}

/** The buttons of `names`, with the zoom controls together in a group named like the zoomed image. */
function controlNodes(
  ownerDocument: Document,
  names: readonly FluidboxControlName[],
  labels: FluidboxLabels,
  icons: FluidboxViewerLayer["icons"],
): HTMLElement[] {
  const button = (name: FluidboxControlName) => controlButton(ownerDocument, name, labels, icons);
  const zoom = (name: FluidboxControlName) =>
    (zoomControlNames as readonly string[]).includes(name);
  const nodes: HTMLElement[] = names.filter((name) => !zoom(name)).map(button);
  const zooms = names.filter(zoom);
  if (zooms.length) {
    const group = ownerDocument.createElement("div");
    group.dataset.fluidboxZoomControls = "";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", labels.zoomed);
    group.append(...zooms.map(button));
    nodes.push(group);
  }
  return nodes;
}

/** Draw the viewer's layer into `target`: the default buttons, then the viewer content. */
export function drawViewerLayer(
  { fluidbox, controls, viewer, labels, icons }: FluidboxViewerLayer,
  target: HTMLElement,
  lifetime: AbortSignal,
): FluidboxDispose {
  // Drawn again on update, so it has a lifetime of its own.
  const scope = new AbortController();
  const { signal } = scope;
  lifetime.addEventListener("abort", () => scope.abort(), { once: true, signal });
  const buttons = controlNodes(target.ownerDocument, controls, labels, icons);
  target.append(...buttons);
  const disposeViewer = viewer?.({ target, fluidbox, signal }) ?? undefined;
  const close = buttons.find((button) => button.hasAttribute(fluidboxControls.close.attribute));
  if (viewer && close) {
    // Your content's own Close, whenever it draws one, stands in for the default.
    const place = () => {
      const own = Array.from(target.querySelectorAll(`[${fluidboxControls.close.attribute}]`)).some(
        (button) => button !== close,
      );
      // By parent: the whole layer leaves the document while the viewer is closed.
      if (own && close.parentNode) close.remove();
      else if (!own && close.parentNode !== target) target.prepend(close);
    };
    const observer = new MutationObserver(place);
    observer.observe(target, { childList: true, subtree: true });
    signal.addEventListener("abort", () => observer.disconnect(), { once: true });
    place();
  }
  // Buttons marked as controls work wherever the viewer content puts them.
  wireControls(target, fluidbox, labels, signal);
  return () => {
    disposeViewer?.();
    scope.abort();
    for (const button of buttons) button.remove();
  };
}

/** The selector of every control button, default or your own. */
export const controlSelector = allControlNames
  .map((name) => `[${fluidboxControls[name].attribute}]`)
  .join();

/**
 * Make the controls in `target` work: a click on an element marked
 * `data-fluidbox-close`, `-next`, `-download` and the rest runs it, unless the
 * click was prevented, and each one is disabled or hidden while it can do
 * nothing. Elements made controls with `bindControl` look after themselves.
 */
export function wireControls(
  target: HTMLElement,
  fluidbox: Fluidbox<any>,
  labels: FluidboxLabels,
  signal: AbortSignal,
): void {
  const nameOf = (element: Element) =>
    allControlNames.find((each) => element.hasAttribute(fluidboxControls[each].attribute))!;
  target.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element | null)?.closest?.(controlSelector);
      if (!element || !target.contains(element) || boundControls.has(element)) return;
      runControl(event, element, nameOf(element), fluidbox, signal);
    },
    { signal },
  );
  const paint = (state: FluidboxState<any>) => {
    // A framework part keeps its own state, which may be overridden.
    for (const element of target.querySelectorAll<HTMLElement>(
      `:is(${controlSelector}):not([data-fluidbox-managed])`,
    )) {
      if (boundControls.has(element)) continue;
      const name = nameOf(element);
      // Markup's controls are named once, before a label of ours could look like their own.
      if (!drawn.has(element)) drawn.set(element, namingOf(element, name));
      paintControl(element, name, fluidbox, state, labels, drawn.get(element)!);
    }
  };
  paint(fluidbox.state);
  const unsubscribe = fluidbox.subscribe(paint);
  signal.addEventListener("abort", unsubscribe, { once: true });
}
