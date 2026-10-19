import type { FluidboxRenderer } from "./public-api";

/**
 * Turns on the filmstrip of its parent `<fluidbox-gallery>`. Set `render` to
 * fill each thumbnail button yourself.
 */
export class FluidboxFilmstripElement extends HTMLElement {
  #render: FluidboxRenderer<any> | undefined;

  connectedCallback() {
    this.hidden = true;
  }

  get render() {
    return this.#render;
  }

  set render(render: FluidboxRenderer<any> | undefined) {
    this.#render = render;
    this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }
}

/**
 * Turns on the sheet of its parent `<fluidbox-gallery>`, with `snap-points`
 * ("40% 90%", pixels or "content") and `dismiss` ("flight", "scroll" or
 * "none"). It shows each item's `<template slot="sheet">`, else its own
 * `<template>`, else what `render` draws.
 */
export class FluidboxSheetElement extends HTMLElement {
  static readonly observedAttributes = ["snap-points", "dismiss"];
  #render: FluidboxRenderer<any> | undefined;

  connectedCallback() {
    this.hidden = true;
  }

  attributeChangedCallback(_name: string, previous: string | null, next: string | null) {
    if (previous !== next)
      this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }

  get render() {
    return this.#render;
  }

  set render(render: FluidboxRenderer<any> | undefined) {
    this.#render = render;
    this.dispatchEvent(new Event("fluidbox-addon-change", { bubbles: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fluidbox-filmstrip": FluidboxFilmstripElement;
    "fluidbox-sheet": FluidboxSheetElement;
  }
}

if (!customElements.get("fluidbox-filmstrip"))
  customElements.define("fluidbox-filmstrip", FluidboxFilmstripElement);
if (!customElements.get("fluidbox-sheet"))
  customElements.define("fluidbox-sheet", FluidboxSheetElement);
