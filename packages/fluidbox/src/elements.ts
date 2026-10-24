/** The custom elements, `<fluidbox-gallery>` and its children, defined on import. Browser only. */
import "./item";
import "./thumbnails";
import { FluidboxGalleryElement } from "./gallery";

if (!customElements.get("fluidbox-gallery"))
  customElements.define("fluidbox-gallery", FluidboxGalleryElement);

export { FluidboxGalleryElement };
export type { FluidboxGalleryEventMap } from "./gallery";
export { FluidboxThumbnailsElement, FluidboxSheetElement } from "./thumbnails";
export { FluidboxItemElement, type FluidboxPreviewChangeEvent } from "./item";
