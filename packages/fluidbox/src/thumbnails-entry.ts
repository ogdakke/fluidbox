/**
 * The thumbnails add-on. Importing it turns on the `thumbnails` option and the
 * bindings' `Thumbnails` part. Its stylesheet is `@ogdakke/fluidbox/thumbnails.css`.
 */
import { registerAddon } from "./addons";
import { createThumbnails } from "./thumbnails-extension";

registerAddon("thumbnails", createThumbnails);

export type { FluidboxThumbnailsOptions } from "./public-api";
