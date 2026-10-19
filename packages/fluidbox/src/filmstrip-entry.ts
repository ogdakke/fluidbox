/**
 * The filmstrip add-on. Importing it turns on the `filmstrip` option and the
 * bindings' `Filmstrip` part. Its stylesheet is `@ogdakke/fluidbox/filmstrip.css`.
 */
import { registerAddon } from "./addons";
import { createFilmstrip } from "./filmstrip-extension";

registerAddon("filmstrip", createFilmstrip);

export type { FluidboxFilmstripOptions } from "./public-api";
