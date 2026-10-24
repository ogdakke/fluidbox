import { dismissCloseValue } from "./fluidbox-gesture";
import { fillContent, originPose, radiiOf } from "./origin-pose";
import { cropPose, emptyClip, mixClip, type ImageClip } from "./transition-geometry";

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
  const width = image.offsetWidth;
  const height = image.offsetHeight;
  return {
    transform,
    clip: {
      top: Math.max(0, crop.f),
      right: Math.max(0, width - crop.e - width * crop.a),
      bottom: Math.max(0, height - crop.f - height * crop.d),
      left: Math.max(0, crop.e),
      radii: radiiOf(frameStyle, Math.abs(frameTransform.a)),
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

/**
 * The pose that draws the media exactly as the origin paints it, relative to
 * where the media box sits when it is not transformed.
 */
export function originTransitionPose(
  origin: HTMLElement,
  picture: HTMLElement | null,
  image: HTMLElement,
  current: ImageTransitionPose,
): ImageTransitionPose | null {
  const imageRect = image.getBoundingClientRect();
  const width = image.offsetWidth;
  const height = image.offsetHeight;
  return originPose({
    origin,
    picture,
    width,
    height,
    left: imageRect.left - current.transform.e,
    top: imageRect.top - current.transform.f,
    content: fillContent(image, width, height, picture ?? origin),
  });
}

interface ImageTransitionMotionOptions {
  readonly opening: boolean;
  readonly from: ImageTransitionPose;
  readonly to: ImageTransitionPose;
  readonly width: number;
  readonly height: number;
  /** The backdrop's opacity at the start; it ends shown when opening and hidden when closing. */
  readonly backdropFrom: number;
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
    const clip = mixClip(from.clip, to.clip, value);
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
      opacity: value(backdropFrom, opening ? 1 : 0),
    });
    progress.push({ offset, opacity: value(0, 1) });
  }
  return { frame, image, radius, backdrop, progress, duration };
}

export function openImageTransitionPose(): ImageTransitionPose {
  return { transform: new DOMMatrix(), clip: emptyClip() };
}
