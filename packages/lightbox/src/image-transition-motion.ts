import { dismissCloseValue, type CornerRadii } from "./lightbox-gesture";
import {
  cropPose,
  emptyClip,
  emptyRadii,
  mapRadii,
  type ImageClip,
  type ThumbnailPose,
} from "./transition-geometry";

export interface ImageTransitionPose {
  readonly transform: DOMMatrix;
  readonly clip: ImageClip;
}

export interface ImageTransitionMotion {
  readonly frame: Keyframe[];
  readonly image: Keyframe[];
  readonly radius: Keyframe[];
  readonly backdrop: Keyframe[];
  readonly progress: Keyframe[];
  readonly duration: number;
}

export function readImageTransitionPose(
  frame: HTMLElement,
  image: HTMLElement,
): ImageTransitionPose {
  const frameStyle = getComputedStyle(frame);
  const imageStyle = getComputedStyle(image);
  const frameTransform = new DOMMatrix(
    frameStyle.transform === "none" ? undefined : frameStyle.transform,
  );
  const imageTransform = new DOMMatrix(
    imageStyle.transform === "none" ? undefined : imageStyle.transform,
  );
  const transform = frameTransform.multiply(imageTransform);
  const crop = transform.inverse().multiply(frameTransform);
  const scale = Math.abs(frameTransform.a);
  const radii: CornerRadii = [
    (Number.parseFloat(frameStyle.borderTopLeftRadius) || 0) * scale,
    (Number.parseFloat(frameStyle.borderTopRightRadius) || 0) * scale,
    (Number.parseFloat(frameStyle.borderBottomRightRadius) || 0) * scale,
    (Number.parseFloat(frameStyle.borderBottomLeftRadius) || 0) * scale,
  ];
  return {
    transform,
    clip: {
      x: Math.max(0, crop.e),
      y: Math.max(0, crop.f),
      radii,
    },
  };
}

export function applyImageTransitionPose(
  frame: HTMLElement,
  image: HTMLElement,
  pose: ImageTransitionPose,
  size?: { readonly width: number; readonly height: number },
) {
  const crop = cropPose(
    pose.transform,
    pose.clip,
    size?.width ?? image.offsetWidth,
    size?.height ?? image.offsetHeight,
  );
  frame.style.transform = crop.frame.toString();
  frame.style.borderRadius = crop.borderRadius;
  image.style.transform = crop.image.toString();
  return crop;
}

export function thumbnailTransitionPose(
  origin: HTMLElement,
  frame: HTMLElement,
  image: HTMLElement,
  current: ImageTransitionPose = readImageTransitionPose(frame, image),
): ThumbnailPose {
  const from = origin.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  const to = {
    left: imageRect.left - current.transform.e,
    top: imageRect.top - current.transform.f,
  };
  const width = image.offsetWidth;
  const height = image.offsetHeight;
  if (!from.width || !from.height || !width || !height) {
    return { transform: "none", ...emptyClip() };
  }
  const scale = Math.max(from.width / width, from.height / height);
  const x = Math.max(0, (width - from.width / scale) / 2);
  const y = Math.max(0, (height - from.height / scale) / 2);
  const style = getComputedStyle(origin);
  const radii: CornerRadii = [
    Number.parseFloat(style.borderTopLeftRadius) || 0,
    Number.parseFloat(style.borderTopRightRadius) || 0,
    Number.parseFloat(style.borderBottomRightRadius) || 0,
    Number.parseFloat(style.borderBottomLeftRadius) || 0,
  ];
  return {
    transform: `translate(${from.left - to.left - x * scale}px, ${from.top - to.top - y * scale}px) scale(${scale})`,
    x,
    y,
    radii,
  };
}

interface ImageTransitionMotionOptions {
  readonly opening: boolean;
  readonly from: ImageTransitionPose;
  readonly to: ImageTransitionPose;
  readonly width: number;
  readonly height: number;
  readonly backdropFrom: number;
  readonly backdropTo: number;
  readonly duration: number;
  readonly response: number;
  readonly samples: number;
  readonly fadeFrame?: boolean;
  /** The origin looks different from the media: fade the frame over the origin near the origin. */
  readonly crossfade?: boolean;
}

/** Share of the motion, nearest the origin, over which a crossfading frame fades. */
const CROSSFADE_SPAN = 0.4;

export function createImageTransitionMotion({
  opening,
  from,
  to,
  width,
  height,
  backdropFrom,
  backdropTo,
  duration,
  response,
  samples,
  fadeFrame = false,
  crossfade = false,
}: ImageTransitionMotionOptions): ImageTransitionMotion {
  const frame: Keyframe[] = [];
  const image: Keyframe[] = [];
  const radius: Keyframe[] = [];
  const backdrop: Keyframe[] = [];
  const progress: Keyframe[] = [];
  for (let index = 0; index <= samples; index++) {
    const offset = index / samples;
    const elapsed = offset * duration;
    const value = (start: number, end: number) =>
      index === samples ? end : dismissCloseValue(start, end, 0, elapsed, duration, response);
    const matrix = new DOMMatrix([
      value(from.transform.a, to.transform.a),
      0,
      0,
      value(from.transform.d, to.transform.d),
      value(from.transform.e, to.transform.e),
      value(from.transform.f, to.transform.f),
    ]);
    const clip = {
      x: value(from.clip.x, to.clip.x),
      y: value(from.clip.y, to.clip.y),
      radii: mapRadii(from.clip.radii, (start, corner) => value(start, to.clip.radii[corner]!)),
    };
    const rendered = cropPose(matrix, clip, width, height);
    frame.push({
      offset,
      transform: rendered.frame.toString(),
      ...(fadeFrame
        ? { opacity: opening ? offset : 1 - offset }
        : crossfade
          ? { opacity: Math.min(1, (opening ? offset : 1 - offset) / CROSSFADE_SPAN) }
          : {}),
    });
    image.push({ offset, transform: rendered.image.toString() });
    radius.push({ offset, borderRadius: rendered.borderRadius });
    backdrop.push({
      offset,
      opacity: value(backdropFrom, backdropTo),
    });
    progress.push({ offset, opacity: value(0, 1) });
  }
  return { frame, image, radius, backdrop, progress, duration };
}

export function openImageTransitionPose(): ImageTransitionPose {
  return { transform: new DOMMatrix(), clip: { ...emptyClip(), radii: emptyRadii() } };
}

export function poseFromThumbnail(pose: ThumbnailPose): ImageTransitionPose {
  return {
    transform: new DOMMatrix(pose.transform === "none" ? undefined : pose.transform),
    clip: { x: pose.x, y: pose.y, radii: pose.radii },
  };
}
