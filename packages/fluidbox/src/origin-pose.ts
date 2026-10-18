import type { CornerRadii } from "./fluidbox-gesture";
import type { ImageClip } from "./transition-geometry";

/** A pose for the media box: where it is drawn and which part of it shows. */
export interface OriginPose {
  readonly transform: DOMMatrix;
  readonly clip: ImageClip;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Corners {
  readonly box: Box;
  readonly radii: CornerRadii;
}

const EDGE = 0.75;

function boxOf(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function intersect(a: Box, b: Box): Box {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
}

function radiiOf(style: CSSStyleDeclaration, scale: number): CornerRadii {
  return [
    (Number.parseFloat(style.borderTopLeftRadius) || 0) * scale,
    (Number.parseFloat(style.borderTopRightRadius) || 0) * scale,
    (Number.parseFloat(style.borderBottomRightRadius) || 0) * scale,
    (Number.parseFloat(style.borderBottomLeftRadius) || 0) * scale,
  ];
}

/** The painted scale of an element, from its layout size to its client rect. */
function paintedScale(element: HTMLElement, rect: DOMRect) {
  return {
    x: element.offsetWidth ? rect.width / element.offsetWidth : 1,
    y: element.offsetHeight ? rect.height / element.offsetHeight : 1,
  };
}

/** The padding box of an element as painted: where its overflow is clipped. */
function paddingBox(element: Element, rect: DOMRect, style: CSSStyleDeclaration): Box {
  const scaleX = element instanceof HTMLElement ? paintedScale(element, rect).x : 1;
  const scaleY = element instanceof HTMLElement ? paintedScale(element, rect).y : 1;
  const left = rect.left + (Number.parseFloat(style.borderLeftWidth) || 0) * scaleX;
  const top = rect.top + (Number.parseFloat(style.borderTopWidth) || 0) * scaleY;
  return {
    left,
    top,
    right: Math.max(left, rect.right - (Number.parseFloat(style.borderRightWidth) || 0) * scaleX),
    bottom: Math.max(top, rect.bottom - (Number.parseFloat(style.borderBottomWidth) || 0) * scaleY),
  };
}

function contentBox(element: HTMLElement, rect: DOMRect, style: CSSStyleDeclaration): Box {
  const scale = paintedScale(element, rect);
  const padding = paddingBox(element, rect, style);
  const left = padding.left + (Number.parseFloat(style.paddingLeft) || 0) * scale.x;
  const top = padding.top + (Number.parseFloat(style.paddingTop) || 0) * scale.y;
  return {
    left,
    top,
    right: Math.max(left, padding.right - (Number.parseFloat(style.paddingRight) || 0) * scale.x),
    bottom: Math.max(top, padding.bottom - (Number.parseFloat(style.paddingBottom) || 0) * scale.y),
  };
}

/** Resolve one `object-position` component against the free space on its axis. */
function positionOffset(value: string | undefined, free: number, scale: number) {
  if (!value) return free / 2;
  if (value.endsWith("%")) return (free * Number.parseFloat(value)) / 100;
  if (value.endsWith("px")) return Number.parseFloat(value) * scale;
  return free / 2;
}

function naturalSize(element: HTMLElement) {
  if (element instanceof HTMLImageElement) return [element.naturalWidth, element.naturalHeight];
  if (element instanceof HTMLVideoElement) return [element.videoWidth, element.videoHeight];
  if (element instanceof HTMLCanvasElement) return [element.width, element.height];
  return [0, 0];
}

/**
 * Where a replaced element paints its picture, honouring `object-fit` and
 * `object-position`. The picture is assumed to have the media's aspect ratio.
 */
function paintedPicture(element: HTMLElement, aspect: number): Box {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const box = contentBox(element, rect, style);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const fit = element.matches("img, video, canvas, object, embed") ? style.objectFit : "fill";
  if (fit === "fill" || !width || !height) return box;
  const scale = paintedScale(element, rect);
  let paintedWidth: number;
  let paintedHeight: number;
  const cover = Math.max(width, height * aspect);
  const contain = Math.min(width, height * aspect);
  const [natural] = naturalSize(element);
  const own = natural ? natural * scale.x : contain;
  if (fit === "cover") paintedWidth = cover;
  else if (fit === "contain") paintedWidth = contain;
  else if (fit === "none") paintedWidth = own;
  else paintedWidth = Math.min(contain, own);
  paintedHeight = paintedWidth / aspect;
  const [x, y] = style.objectPosition.split(/\s+/);
  const left = box.left + positionOffset(x, width - paintedWidth, scale.x);
  const top = box.top + positionOffset(y, height - paintedHeight, scale.y);
  return { left, top, right: left + paintedWidth, bottom: top + paintedHeight };
}

/** Ancestors that clip the origin, innermost first, with their painted corners. */
function clippingAncestors(element: HTMLElement): Corners[] {
  const clips: Corners[] = [];
  for (let ancestor: Element | null = parentOf(element); ancestor; ancestor = parentOf(ancestor)) {
    if (
      ancestor === element.ownerDocument.documentElement ||
      ancestor === element.ownerDocument.body
    )
      continue;
    const style = getComputedStyle(ancestor);
    const clipX = style.overflowX !== "visible";
    const clipY = style.overflowY !== "visible";
    if (!clipX && !clipY) continue;
    const rect = ancestor.getBoundingClientRect();
    const padding = paddingBox(ancestor, rect, style);
    const scale = ancestor instanceof HTMLElement ? paintedScale(ancestor, rect).x : 1;
    clips.push({
      box: {
        left: clipX ? padding.left : -Infinity,
        right: clipX ? padding.right : Infinity,
        top: clipY ? padding.top : -Infinity,
        bottom: clipY ? padding.bottom : Infinity,
      },
      radii: radiiOf(style, scale),
    });
  }
  return clips;
}

function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * The radius of each visible corner. Every box that shares the corner clips
 * it, so the roundest of them is the one on screen.
 */
function visibleRadii(visible: Box, boxes: readonly Corners[]): CornerRadii {
  const corners: [keyof Box, keyof Box][] = [
    ["left", "top"],
    ["right", "top"],
    ["right", "bottom"],
    ["left", "bottom"],
  ];
  return corners.map(([x, y], index) => {
    let radius = 0;
    for (const { box, radii } of boxes) {
      if (Math.abs(box[x] - visible[x]) < EDGE && Math.abs(box[y] - visible[y]) < EDGE) {
        radius = Math.max(radius, radii[index]!);
      }
    }
    return radius;
  }) as CornerRadii;
}

export interface OriginPoseOptions {
  /** The card's visual box. */
  readonly origin: HTMLElement;
  /**
   * The element inside (or equal to) the origin that paints the item itself.
   * Without one, the media covers the origin's box, as a crossfade does.
   */
  readonly picture?: HTMLElement | null;
  /** The media box's layout size. */
  readonly width: number;
  readonly height: number;
  /** The viewport position of the media box when it is not transformed. */
  readonly left: number;
  readonly top: number;
}

/**
 * Describe what the origin paints as a pose of the media box: the transform
 * that lays the media over the origin's picture, and the insets and corners
 * of the part of it that is actually visible on the page.
 */
export function originPose({
  origin,
  picture,
  width,
  height,
  left,
  top,
}: OriginPoseOptions): OriginPose | null {
  if (!width || !height) return null;
  const aspect = width / height;
  const originRect = origin.getBoundingClientRect();
  if (!originRect.width || !originRect.height) return null;
  const originStyle = getComputedStyle(origin);
  const originCorners: Corners = {
    box: boxOf(originRect),
    radii: radiiOf(originStyle, paintedScale(origin, originRect).x),
  };
  let painted: Box;
  let visible = originCorners.box;
  const boxes: Corners[] = [originCorners];
  if (picture) {
    painted = paintedPicture(picture, aspect);
    const pictureRect = picture.getBoundingClientRect();
    const pictureStyle = getComputedStyle(picture);
    // A replaced element clips its picture to its content box.
    visible = intersect(visible, contentBox(picture, pictureRect, pictureStyle));
    if (picture !== origin) {
      boxes.push({
        box: boxOf(pictureRect),
        radii: radiiOf(pictureStyle, paintedScale(picture, pictureRect).x),
      });
    }
  } else {
    // Cover the origin's box from its centre.
    const scale = Math.max(originRect.width / width, originRect.height / height);
    const paintedWidth = width * scale;
    const paintedHeight = height * scale;
    const x = originRect.left + (originRect.width - paintedWidth) / 2;
    const y = originRect.top + (originRect.height - paintedHeight) / 2;
    painted = { left: x, top: y, right: x + paintedWidth, bottom: y + paintedHeight };
  }
  visible = intersect(visible, painted);
  for (const clip of clippingAncestors(origin)) {
    visible = intersect(visible, clip.box);
    boxes.push(clip);
  }
  if (visible.right - visible.left < 0.5 || visible.bottom - visible.top < 0.5) return null;
  const scaleX = (painted.right - painted.left) / width;
  const scaleY = (painted.bottom - painted.top) / height;
  return {
    transform: new DOMMatrix([scaleX, 0, 0, scaleY, painted.left - left, painted.top - top]),
    clip: {
      top: Math.max(0, (visible.top - painted.top) / scaleY),
      right: Math.max(0, (painted.right - visible.right) / scaleX),
      bottom: Math.max(0, (painted.bottom - visible.bottom) / scaleY),
      left: Math.max(0, (visible.left - painted.left) / scaleX),
      radii: visibleRadii(visible, boxes),
    },
  };
}

/** The element inside an origin that paints its picture, if any. */
export function originPicture(origin: HTMLElement): HTMLElement | null {
  if (origin.matches("img, video, canvas")) return origin;
  return origin.querySelector<HTMLElement>("img, video, canvas");
}
