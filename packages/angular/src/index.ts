/** The Angular binding: standalone `fluidbox*` directives and components, and `FluidboxModule`. */
import { NgModule } from "@angular/core";
import {
  FluidboxCaptionComponent,
  FluidboxCloseDirective,
  FluidboxCounterComponent,
  FluidboxDownloadDirective,
  FluidboxErrorDirective,
  FluidboxFullscreenDirective,
  FluidboxLoadingDirective,
  FluidboxNextDirective,
  FluidboxOverlayComponent,
  FluidboxPreviousDirective,
  FluidboxRetryDirective,
  FluidboxShareDirective,
  FluidboxSlideshowDirective,
  FluidboxSheetSnapDirective,
  FluidboxToolbarComponent,
  FluidboxTriggerDirective,
  FluidboxViewerDirective,
  FluidboxZoomControlsComponent,
  FluidboxZoomInDirective,
  FluidboxZoomOutDirective,
  FluidboxZoomResetDirective,
} from "./parts.js";
import { FluidboxRootDirective } from "./root.js";
import { FluidboxSheetDirective } from "./sheet.js";
import {
  FluidboxIframeComponent,
  FluidboxImageComponent,
  FluidboxMediaDirective,
  FluidboxSlideDirective,
  FluidboxVideoComponent,
} from "./slide.js";
import { FluidboxThumbnailsDirective } from "./thumbnails.js";

export type { FluidboxItemContext } from "./mount.js";
export {
  FluidboxCaptionComponent,
  FluidboxCloseDirective,
  FluidboxCounterComponent,
  FluidboxDownloadDirective,
  FluidboxErrorDirective,
  FluidboxFullscreenDirective,
  FluidboxLoadingDirective,
  FluidboxNextDirective,
  FluidboxOverlayComponent,
  FluidboxPreviousDirective,
  FluidboxRetryDirective,
  FluidboxShareDirective,
  FluidboxSlideshowDirective,
  FluidboxSheetSnapDirective,
  FluidboxToolbarComponent,
  FluidboxTriggerDirective,
  FluidboxViewerDirective,
  FluidboxZoomControlsComponent,
  FluidboxZoomInDirective,
  FluidboxZoomOutDirective,
  FluidboxZoomResetDirective,
  type FluidboxCounterContext,
  type FluidboxErrorContext,
} from "./parts.js";
export {
  FluidboxRootDirective,
  injectFluidbox,
  injectFluidboxSheet,
  type FluidboxApi,
  type FluidboxCommands,
  type FluidboxSheetApi,
} from "./root.js";
export { FluidboxSheetDirective } from "./sheet.js";
export {
  FluidboxIframeComponent,
  FluidboxImageComponent,
  FluidboxMediaDirective,
  FluidboxSlideDirective,
  FluidboxVideoComponent,
  injectFluidboxSlide,
  type FluidboxMediaAttributes,
  type FluidboxSlideApi,
} from "./slide.js";
export { FluidboxThumbnailsDirective, type FluidboxThumbnailContext } from "./thumbnails.js";

export {
  FluidboxMediaErrorEvent,
  FluidboxReachEndEvent,
  FluidboxSheetEvent,
  FluidboxValueChangeEvent,
  FluidboxZoomEvent,
} from "@ogdakke/fluidbox";
export type {
  Fluidbox,
  FluidboxCommandOptions,
  FluidboxCustomItemBase,
  FluidboxItemTypes,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItemListOptions,
  FluidboxLazyItemList,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOptions,
  FluidboxPreload,
  FluidboxReason,
  FluidboxSheetSnapPoint,
  FluidboxSlide,
  FluidboxSlideRenderer,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
  FluidboxValue,
  FluidboxValueChangeAction,
  FluidboxVideoItem,
  FluidboxZoomCommandOptions,
  FluidboxZoomPose,
  FluidboxZoomState,
} from "@ogdakke/fluidbox";
export type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

const parts = [
  FluidboxRootDirective,
  FluidboxTriggerDirective,
  FluidboxOverlayComponent,
  FluidboxSlideDirective,
  FluidboxMediaDirective,
  FluidboxImageComponent,
  FluidboxVideoComponent,
  FluidboxIframeComponent,
  FluidboxViewerDirective,
  FluidboxToolbarComponent,
  FluidboxZoomControlsComponent,
  FluidboxCloseDirective,
  FluidboxPreviousDirective,
  FluidboxNextDirective,
  FluidboxZoomInDirective,
  FluidboxZoomOutDirective,
  FluidboxZoomResetDirective,
  FluidboxFullscreenDirective,
  FluidboxDownloadDirective,
  FluidboxShareDirective,
  FluidboxSlideshowDirective,
  FluidboxCounterComponent,
  FluidboxCaptionComponent,
  FluidboxLoadingDirective,
  FluidboxErrorDirective,
  FluidboxRetryDirective,
  FluidboxThumbnailsDirective,
  FluidboxSheetDirective,
  FluidboxSheetSnapDirective,
];

/**
 * Every fluidbox part, for NgModule apps and quick starts. The thumbnails and
 * sheet runtimes load on demand, the first time a root uses them. The add-on
 * parts come from `@ogdakke/fluidbox/angular/{embed,model,spin}`.
 */
@NgModule({ imports: parts, exports: parts })
export class FluidboxModule {}
