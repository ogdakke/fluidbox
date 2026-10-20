/** The Angular binding: standalone `fluidbox*` directives and `FluidboxModule`. */
import { NgModule } from "@angular/core";
import { FluidboxFilmstripDirective } from "./filmstrip.js";
import {
  FluidboxCloseDirective,
  FluidboxControlsComponent,
  FluidboxFrameLayerDirective,
  FluidboxNextDirective,
  FluidboxPreviousDirective,
  FluidboxSheetStopDirective,
  FluidboxThumbnailOverlayComponent,
  FluidboxTriggerDirective,
  FluidboxViewerDirective,
} from "./parts.js";
import { FluidboxRootDirective } from "./root.js";
import { FluidboxSheetDirective } from "./sheet.js";

export { FluidboxFilmstripDirective } from "./filmstrip.js";
export type { FluidboxContent, FluidboxItemContext } from "./mount.js";
export {
  FluidboxCloseDirective,
  FluidboxControlDirective,
  FluidboxControlsComponent,
  FluidboxFrameLayerDirective,
  FluidboxNextDirective,
  FluidboxPreviousDirective,
  FluidboxSheetStopDirective,
  FluidboxThumbnailOverlayComponent,
  FluidboxTriggerDirective,
  FluidboxViewerDirective,
} from "./parts.js";
export {
  FluidboxRootDirective,
  injectFluidbox,
  injectFluidboxSheet,
  type FluidboxApi,
  type FluidboxSheetApi,
} from "./root.js";
export { FluidboxSheetDirective } from "./sheet.js";

export {
  FluidboxItemChangeEvent,
  FluidboxSheetEvent,
  FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
export type {
  Fluidbox,
  FluidboxCommandOptions,
  FluidboxCustomItem,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItemListOptions,
  FluidboxItems,
  FluidboxLabels,
  FluidboxLoading,
  FluidboxOrigin,
  FluidboxOriginAdapter,
  FluidboxReason,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
  FluidboxVideoItem,
} from "@ogdakke/fluidbox";
export type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

const parts = [
  FluidboxRootDirective,
  FluidboxTriggerDirective,
  FluidboxThumbnailOverlayComponent,
  FluidboxFrameLayerDirective,
  FluidboxViewerDirective,
  FluidboxControlsComponent,
  FluidboxCloseDirective,
  FluidboxPreviousDirective,
  FluidboxNextDirective,
  FluidboxFilmstripDirective,
  FluidboxSheetDirective,
  FluidboxSheetStopDirective,
];

/**
 * Every fluidbox part, for NgModule apps and quick starts. The filmstrip and
 * sheet runtimes load on demand, the first time a root uses them.
 */
@NgModule({ imports: parts, exports: parts })
export class FluidboxModule {}
