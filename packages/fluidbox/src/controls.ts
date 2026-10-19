import { hostOf } from "./host";
import { controlIcon, type ControlIconPart } from "./control-icons";
import type { FluidboxLabels } from "./labels";
import type { Fluidbox, FluidboxControlName, FluidboxState } from "./public-api";

/** The label, disabled state and command of each default viewer control. */
export interface FluidboxControl {
  /** The data attribute the viewer styles and finds the control by. */
  readonly attribute: `data-fluidbox-${FluidboxControlName}`;
  readonly label: (labels: FluidboxLabels) => string;
  readonly disabled: (state: FluidboxState<any>) => boolean;
  /** Run the command. Pass the click, so its events tell a key from a pointer. */
  readonly run: (fluidbox: Fluidbox<any>, click?: { readonly detail: number }) => Promise<boolean>;
}

const command = (
  fluidbox: Fluidbox<any>,
  name: FluidboxControlName,
  click: { readonly detail: number } | undefined,
) =>
  hostOf(fluidbox).command(
    name,
    undefined,
    click ? (click.detail === 0 ? "keyboard" : "pointer") : "api",
  );

export const fluidboxControls: Readonly<Record<FluidboxControlName, FluidboxControl>> = {
  previous: {
    attribute: "data-fluidbox-previous",
    label: (labels) => labels.previous,
    disabled: (state) => !state.hasPrevious,
    run: (fluidbox, click) => command(fluidbox, "previous", click),
  },
  next: {
    attribute: "data-fluidbox-next",
    label: (labels) => labels.next,
    disabled: (state) => !state.hasNext,
    run: (fluidbox, click) => command(fluidbox, "next", click),
  },
  close: {
    attribute: "data-fluidbox-close",
    label: (labels) => labels.close,
    disabled: (state) => state.status === "closed",
    run: (fluidbox, click) => command(fluidbox, "close", click),
  },
};

export const controlNames: readonly FluidboxControlName[] = ["previous", "next", "close"];

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

/** The selector of every control button, default or your own. */
export const controlSelector = controlNames
  .map((name) => `[${fluidboxControls[name].attribute}]`)
  .join();

/**
 * Make the control buttons in `target` work: a click on a button marked
 * `data-fluidbox-previous`, `-next` or `-close` runs it, unless the click was
 * prevented, and each one is disabled while it can do nothing.
 */
export function wireControls(
  target: HTMLElement,
  fluidbox: Fluidbox<any>,
  signal: AbortSignal,
  run: (name: FluidboxControlName, event: MouseEvent) => void,
): void {
  target.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest?.(controlSelector);
      if (!button || !target.contains(button)) return;
      const name = controlNames.find((each) =>
        button.hasAttribute(fluidboxControls[each].attribute),
      )!;
      // Frameworks that delegate events handle the click after this listener,
      // so look once the whole dispatch is over.
      setTimeout(() => {
        if (!event.defaultPrevented && !signal.aborted) run(name, event);
      });
    },
    { signal },
  );
  const paint = (state: FluidboxState<any>) => {
    for (const name of controlNames) {
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
