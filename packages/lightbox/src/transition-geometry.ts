import type { CornerRadii } from "./lightbox-gesture";

export interface ImageClip {
  x: number;
  y: number;
  radii: CornerRadii;
}

export interface ThumbnailPose extends ImageClip {
  transform: string;
}

export interface CropPose {
  frame: DOMMatrix;
  image: DOMMatrix;
  borderRadius: string;
}

export const emptyRadii = (): CornerRadii => [0, 0, 0, 0];

export const emptyClip = (): ImageClip => ({ x: 0, y: 0, radii: emptyRadii() });

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
  const x = Math.min(Math.max(0, clip.x), Math.max(0, width / 2 - 0.01));
  const y = Math.min(Math.max(0, clip.y), Math.max(0, height / 2 - 0.01));
  const crop = new DOMMatrix()
    .translate(x, y)
    .scale(Math.max(0.0001, (width - x * 2) / width), Math.max(0.0001, (height - y * 2) / height));
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
