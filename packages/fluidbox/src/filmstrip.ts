export { FilmstripSession } from "./filmstrip-session";

/** Declarative marker that opts its parent gallery into the default filmstrip UI. */
export class FluidboxFilmstripElement extends HTMLElement {
  connectedCallback() {
    this.hidden = true;
  }
}

if (!customElements.get("fluidbox-filmstrip"))
  customElements.define("fluidbox-filmstrip", FluidboxFilmstripElement);
