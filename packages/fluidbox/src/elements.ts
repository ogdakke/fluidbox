/** The custom elements, `<fluidbox-gallery>` and its children, defined on import. Browser only. */
import "./item";
import "./filmstrip";
import { FluidboxGalleryElement } from "./gallery";

if (!customElements.get("fluidbox-gallery"))
  customElements.define("fluidbox-gallery", FluidboxGalleryElement);

export { FluidboxGalleryElement };
export type { FluidboxGalleryEventMap } from "./gallery";
export { FluidboxFilmstripElement, FluidboxSheetElement } from "./filmstrip";
export { FluidboxItemElement, type FluidboxPreviewChangeEvent } from "./item";
