import { hostOf } from "./host";
import { crossOrigin, downloadName, fileOf } from "./item-file";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";
import { fluidboxControls } from "./controls";

/**
 * How a control is named as the state changes: by its text, by `aria-label`,
 * or not at all, as a control with a name of its own.
 */
export type ControlNaming = "text" | "label" | false;

/**
 * How a control the page made is named: the counter, and a control marked
 * `data-fluidbox-default`, by its text; one with an `aria-label`,
 * `aria-labelledby` or `data-fluidbox-label="content"` by what it has; and
 * the rest by `aria-label` from the labels.
 */
export function namingOf(element: Element, name: FluidboxControlName): ControlNaming {
  if (name === "counter" || element.hasAttribute("data-fluidbox-default")) return "text";
  return element.hasAttribute("aria-label") ||
    element.hasAttribute("aria-labelledby") ||
    element.getAttribute("data-fluidbox-label") === "content"
    ? false
    : "label";
}

/** Show a control as the state has it: disabled, hidden, its name, and for Download its file. */
export function paintControl(
  element: HTMLElement,
  name: FluidboxControlName,
  fluidbox: Fluidbox<any>,
  state: FluidboxState<any>,
  labels: FluidboxLabels,
  naming: ControlNaming,
) {
  const control = fluidboxControls[name];
  if (element instanceof HTMLButtonElement) element.disabled = control.disabled(state);
  if (control.hidden) element.hidden = control.hidden(fluidbox, state);
  if (name === "download" && element instanceof HTMLAnchorElement) {
    const file = state.item && fileOf(state.item);
    if (file) {
      element.href = file.src;
      element.download = downloadName(state.item!, file);
    } else {
      element.removeAttribute("href");
      element.removeAttribute("download");
    }
  }
  const label = control.label(labels, state);
  if (naming === "text") element.textContent = label;
  else if (naming === "label") element.setAttribute("aria-label", label);
}

/**
 * Run a control on its click, unless the click was prevented. Frameworks that
 * delegate events handle the click after the viewer's listener, so the
 * command waits for the whole dispatch. A Download link saves a same-origin
 * file by itself; elsewhere the browser would navigate, so the viewer fetches it.
 */
export function runControl(
  event: MouseEvent,
  element: Element,
  name: FluidboxControlName,
  fluidbox: Fluidbox<any>,
  signal: AbortSignal,
) {
  if (name === "download" && element instanceof HTMLAnchorElement) {
    if (!element.href || !crossOrigin(element.href) || event.defaultPrevented) return;
    event.preventDefault();
    void fluidbox.download();
    return;
  }
  setTimeout(() => {
    if (!event.defaultPrevented && !signal.aborted)
      void fluidboxControls[name].run(fluidbox, event);
  });
}

/** Elements made controls with `bindControl`, which the viewer's own wiring leaves alone. */
export const boundControls = new WeakSet<Element>();

/** Make your own element a control. Returns its cleanup. */
export function bindControl(
  fluidbox: Fluidbox<any>,
  element: HTMLElement,
  name: FluidboxControlName,
  signal?: AbortSignal,
): () => void {
  const control = fluidboxControls[name];
  const scope = new AbortController();
  signal?.addEventListener("abort", () => scope.abort(), { once: true, signal: scope.signal });
  element.setAttribute(control.attribute, "");
  boundControls.add(element);
  const naming = namingOf(element, name);
  element.addEventListener(
    "click",
    (event) => runControl(event, element, name, fluidbox, scope.signal),
    { signal: scope.signal },
  );
  const paint = (state: FluidboxState<any>) =>
    paintControl(element, name, fluidbox, state, hostOf(fluidbox).labels, naming);
  paint(fluidbox.state);
  const unsubscribe = fluidbox.subscribe(paint);
  scope.signal.addEventListener("abort", () => {
    unsubscribe();
    boundControls.delete(element);
  });
  if (signal?.aborted) scope.abort();
  return () => scope.abort();
}
