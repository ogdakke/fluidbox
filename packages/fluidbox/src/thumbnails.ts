import type { FluidboxRenderer } from "./public-api";

/**
 * Turns on the thumbnails of its parent `<fluidbox-gallery>`. Set `render` to
 * fill each thumbnail button yourself.
 */
export class FluidboxThumbnailsElement extends HTMLElement {
  #render: FluidboxRenderer<any> | undefined;

  connectedCallback() {
    this.hidden = true;
  }

  get render(): FluidboxRenderer<any> | undefined {
    return this.#render;
  }

  set render(render: FluidboxRenderer<any> | undefined) {
    this.#render = render;
    this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }
}

/**
 * Turns on the sheet of its parent `<fluidbox-gallery>`, with `snap-points`
 * ("40% 90%", pixels or "content") and `dismiss-motion` ("flight" or
 * "scroll"). It shows each item's `<template slot="sheet">`, else its own
 * `<template>`, else what `render` draws.
 */
export class FluidboxSheetElement extends HTMLElement {
  static readonly observedAttributes = ["snap-points", "dismiss-motion"];
  #render: FluidboxRenderer<any> | undefined;

  connectedCallback() {
    this.hidden = true;
  }

  attributeChangedCallback(_name: string, previous: string | null, next: string | null) {
    if (previous !== next)
      this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }

  get render(): FluidboxRenderer<any> | undefined {
    return this.#render;
  }

  set render(render: FluidboxRenderer<any> | undefined) {
    this.#render = render;
    this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fluidbox-thumbnails": FluidboxThumbnailsElement;
    "fluidbox-sheet": FluidboxSheetElement;
  }
}

if (!customElements.get("fluidbox-thumbnails"))
  customElements.define("fluidbox-thumbnails", FluidboxThumbnailsElement);
if (!customElements.get("fluidbox-sheet"))
  customElements.define("fluidbox-sheet", FluidboxSheetElement);
