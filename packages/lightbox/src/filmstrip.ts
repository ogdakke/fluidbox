export { FilmstripSession } from "./filmstrip-session";

/** Declarative marker that opts its parent gallery into the default filmstrip UI. */
export class AppFilmstrip extends HTMLElement {
  connectedCallback() {
    this.hidden = true;
  }
}

if (!customElements.get("app-filmstrip")) customElements.define("app-filmstrip", AppFilmstrip);
