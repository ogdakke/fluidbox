// Importing this entry turns on the `filmstrip` option of createFluidbox and the
// bindings' Filmstrip part.
import { registerAddon } from "./addons";
import { createFilmstrip } from "./filmstrip-extension";

registerAddon("filmstrip", createFilmstrip);

export type { FluidboxFilmstripOptions } from "./public-api";
