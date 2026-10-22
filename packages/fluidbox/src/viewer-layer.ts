import { controlIcon, type ControlIconPart } from "./control-icons";
import { allControlNames, controlNames, fluidboxControls, zoomControlNames } from "./controls";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";
import type { FluidboxDispose, FluidboxViewerLayer } from "./runtime-types";

/** A default control button, with its icon, label and attribute. */
export function controlButton(
  ownerDocument: Document,
  name: FluidboxControlName,
  labels: FluidboxLabels,
): HTMLButtonElement {
  const control = fluidboxControls[name];
  const button = ownerDocument.createElement("button");
  button.type = "button";
  button.setAttribute(control.attribute, "");
  button.setAttribute("aria-label", control.label(labels));
  button.append(controlIcon(ownerDocument, name as ControlIconPart));
  return button;
}

/** The buttons of `names`, with the zoom controls together in a group named like the zoomed image. */
function controlNodes(
  ownerDocument: Document,
  names: readonly FluidboxControlName[],
  labels: FluidboxLabels,
): HTMLElement[] {
  const button = (name: FluidboxControlName) => controlButton(ownerDocument, name, labels);
  const nodes: HTMLElement[] = names.filter((name) => !zoomControlNames.includes(name)).map(button);
  const zooms = names.filter((name) => zoomControlNames.includes(name));
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
  wireControls(target, fluidbox, signal);
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
      for (const button of target.querySelectorAll<HTMLButtonElement>(selector)) {
        button.disabled = control.disabled(state);
      }
    }
  };
  paint(fluidbox.state);
  const unsubscribe = fluidbox.subscribe(paint);
  signal.addEventListener("abort", unsubscribe, { once: true });
}
