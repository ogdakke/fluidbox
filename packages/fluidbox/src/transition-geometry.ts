import type { CornerRadii } from "./fluidbox-gesture";

/** Insets from each edge of the media box, in the media's own pixels. */
export interface ClipInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ImageClip extends ClipInsets {
  radii: CornerRadii;
}

export interface CropPose {
  frame: DOMMatrix;
  image: DOMMatrix;
  borderRadius: string;
}

export const emptyRadii = (): CornerRadii => [0, 0, 0, 0];

export const emptyClip = (): ImageClip => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  radii: emptyRadii(),
});

type Mix = (start: number, end: number) => number;

export function mixInsets(from: ClipInsets, to: ClipInsets, value: Mix): ClipInsets {
  return {
    top: value(from.top, to.top),
    right: value(from.right, to.right),
    bottom: value(from.bottom, to.bottom),
    left: value(from.left, to.left),
  };
}

export function mixClip(from: ImageClip, to: ImageClip, value: Mix): ImageClip {
  return {
    ...mixInsets(from, to, value),
    radii: mapRadii(from.radii, (start, corner) => value(start, to.radii[corner]!)),
  };
}

export function mapRadii(
  radii: CornerRadii,
  map: (radius: number, index: number) => number,
): CornerRadii {
  return [map(radii[0], 0), map(radii[1], 1), map(radii[2], 2), map(radii[3], 3)];
}

export function cropPose(
  transform: DOMMatrix,
  clip: ImageClip,
  width: number,
  height: number,
): CropPose {
  const left = Math.max(0, clip.left);
  const top = Math.max(0, clip.top);
  const visibleWidth = Math.max(0.01, width - left - Math.max(0, clip.right));
  const visibleHeight = Math.max(0.01, height - top - Math.max(0, clip.bottom));
  const crop = new DOMMatrix()
    .translate(Math.min(left, width - 0.01), Math.min(top, height - 0.01))
    .scale(visibleWidth / width, visibleHeight / height);
  const frame = transform.multiply(crop);
  const image = frame.inverse().multiply(transform);
  const radiiX = mapRadii(clip.radii, (radius) => radius / Math.max(0.0001, Math.abs(frame.a)));
  const radiiY = mapRadii(clip.radii, (radius) => radius / Math.max(0.0001, Math.abs(frame.d)));
  return {
    frame,
    image,
    borderRadius: `${radiiX.join("px ")}px / ${radiiY.join("px ")}px`,
  };
}
