// Where a slide's zoom is, in its item's pixels: for the few slides that follow it.
import type { FluidboxItem, FluidboxZoomPose } from "./public-api";
import type { ViewerZoomPose } from "./viewer-strip";

/** A zoom pose as a slide's `onZoom` has it: the part of the item that shows. */
export function shownPose(item: FluidboxItem, pose: ViewerZoomPose): FluidboxZoomPose {
  // In the item's own pixels, as its width and height count them.
  const width = item.width ?? pose.width;
  const height = item.height ?? pose.height;
  const { viewport } = pose;
  const shownWidth = pose.width * pose.scale;
  const shownHeight = pose.height * pose.scale;
  const left = pose.left + pose.x;
  const top = pose.top + pose.y;
  const from = (start: number, extent: number, size: number, total: number) =>
    shownWidth && shownHeight ? Math.max(0, Math.min(total, ((start - extent) / size) * total)) : 0;
  // What of the item shows through the zoom viewport, the stage.
  const x = from(viewport.left, left, shownWidth, width);
  const y = from(viewport.top, top, shownHeight, height);
  const right = from(viewport.left + viewport.width, left, shownWidth, width);
  const bottom = from(viewport.top + viewport.height, top, shownHeight, height);
  const visible = new DOMRectReadOnly(x, y, right - x, bottom - y);
  return {
    scale: pose.scale,
    x: pose.x,
    y: pose.y,
    visible,
    moving: pose.moving,
  };
}
