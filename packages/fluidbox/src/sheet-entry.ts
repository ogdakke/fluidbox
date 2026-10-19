// Importing this entry turns on the `sheet` option of createFluidbox and the
// bindings' Sheet part. Its stylesheet is `@ogdakke/fluidbox/sheet.css`.
import { registerAddon } from "./addons";
import { createSheet } from "./sheet";

registerAddon("sheet", createSheet);

export type { FluidboxSheet, FluidboxSheetOptions, FluidboxSheetSnapPoint } from "./public-api";
