import { CONTROL_ICON_PATHS, controlIcon, type ControlIconPart } from "./control-icons";
import { allControlNames, controlNames, fluidboxControls, zoomControlNames } from "./controls";
import { crossOrigin, downloadName } from "./file-actions";
import { fileOf } from "./item-file";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";
import type { FluidboxDispose, FluidboxViewerLayer } from "./runtime-types";

/** The controls the layer drew, whose label and text follow the state; your own keep theirs. */
const drawn = new WeakSet<Element>();

/**
 * A default control, with its icon, label and attribute: a button, a link for
 * Download, so "Save link as" works, and text for the counter.
 */
export function controlButton(
  ownerDocument: Document,
  name: FluidboxControlName,
  labels: FluidboxLabels,
): HTMLElement {
  const control = fluidboxControls[name];
  const element =
    name === "counter"
      ? ownerDocument.createElement("span")
      : name === "download"
        ? ownerDocument.createElement("a")
        : Object.assign(ownerDocument.createElement("button"), { type: "button" });
  element.setAttribute(control.attribute, "");
  // The dialog's name and the announcer already say where you are.
  if (name === "counter") element.setAttribute("aria-hidden", "true");
  else element.setAttribute("aria-label", control.label(labels));
  if (name in CONTROL_ICON_PATHS) {
    element.append(controlIcon(ownerDocument, name as ControlIconPart));
  }
  drawn.add(element);
  return element;
}

/** The buttons of `names`, with the zoom controls together in a group named like the zoomed image. */
function controlNodes(
  ownerDocument: Document,
  names: readonly FluidboxControlName[],
  labels: FluidboxLabels,
): HTMLElement[] {
  const button = (name: FluidboxControlName) => controlButton(ownerDocument, name, labels);
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
  { fluidbox, controls, viewer, labels }: FluidboxViewerLayer,
  target: HTMLElement,
  lifetime: AbortSignal,
): FluidboxDispose {
  // Drawn again on update, so it has a lifetime of its own.
  const scope = new AbortController();
  const { signal } = scope;
  lifetime.addEventListener("abort", () => scope.abort(), { once: true, signal });
  const buttons = controlNodes(target.ownerDocument, controls, labels);
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
  // A <fluidbox-controls> the content left, as a gallery's template does, stands
  // for the defaults, and with `zoom` for the zoom controls too.
  for (const placeholder of target.querySelectorAll("fluidbox-controls")) {
    const names = placeholder.hasAttribute("zoom")
      ? [...controlNames, ...zoomControlNames]
      : controlNames;
    const expanded = controlNodes(target.ownerDocument, names, labels);
    placeholder.replaceWith(...expanded);
    buttons.push(...expanded);
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
 * Make the control buttons in `target` work: a click on a button marked
 * `data-fluidbox-previous`, `-next`, `-close`, `-zoom-in`, `-zoom-out` or
 * `-zoom-reset` runs it, unless the click was prevented, and each one is
 * disabled while it can do nothing.
 */
export function wireControls(
  target: HTMLElement,
  fluidbox: Fluidbox<any>,
  labels: FluidboxLabels,
  signal: AbortSignal,
): void {
  target.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest?.(controlSelector);
      if (!button || !target.contains(button)) return;
      const name = allControlNames.find((each) =>
        button.hasAttribute(fluidboxControls[each].attribute),
      )!;
      if (name === "download" && button instanceof HTMLAnchorElement) {
        // The browser saves a same-origin file by itself; elsewhere it would
        // navigate, so the viewer fetches the file.
        if (!button.href || !crossOrigin(button.href) || event.defaultPrevented) return;
        event.preventDefault();
        void fluidbox.download();
        return;
      }
      // Frameworks that delegate events handle the click after this listener,
      // so look once the whole dispatch is over.
      setTimeout(() => {
        if (!event.defaultPrevented && !signal.aborted) {
          void fluidboxControls[name].run(fluidbox, event);
        }
      });
    },
    { signal },
  );
  const paint = (state: FluidboxState<any>) => {
    for (const name of allControlNames) {
      const control = fluidboxControls[name];
      // A framework part keeps its own disabled state, which may be overridden.
      const selector = `[${control.attribute}]:not([data-fluidbox-managed])`;
      for (const element of target.querySelectorAll<HTMLElement>(selector)) {
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
        if (!drawn.has(element)) continue;
        if (name === "counter") element.textContent = control.label(labels, state);
        else if (name === "fullscreen")
          element.setAttribute("aria-label", control.label(labels, state));
      }
    }
  };
  paint(fluidbox.state);
  const unsubscribe = fluidbox.subscribe(paint);
  signal.addEventListener("abort", unsubscribe, { once: true });
}
