type Pose = { readonly ty: number; readonly scale: number };
/** Where a photo sits with the panel away, relative to the top of the stage. */
type Rest = {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
};

export interface PhotoRoomVariables {
  /** `fit` shrinks the photo into the room left above the panel; `push` slides it up. */
  readonly photo: string;
  /** Space kept between the photo and the panel. */
  readonly gap: string;
  /**
   * In `fit`, how much the panel may cover, in pixels or a percentage of the
   * stage, before the photo stops shrinking and rises with it instead.
   */
  readonly limit: string;
}

/** A scroll timeline that moves the panel: from `from` on, each pixel scrolled covers one more. */
export interface PhotoRoomTrack {
  readonly timeline: AnimationTimeline;
  /** The timeline's scroll range in pixels. */
  readonly range: number;
  /** The scroll offset where the panel rests. Below it the panel covers its rest. */
  readonly from: number;
  /** How far below the bottom of the stage a panel at rest waits, as under the browser's bars. */
  readonly lead?: number;
}

/** How much the panel covers before a fitting photo stops shrinking, unless set. */
const DEFAULT_FIT_LIMIT = 0.55;
/** The least distance over which a photo eases into or out of its rest pose. */
const KNEE = 48;
/** The most distance short of the photo over which it starts to ease. */
const LONGEST_EASE = 200;
/** Covered pixels between samples of a tracked pose; collinear samples are dropped. */
const SAMPLE_STEP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Eases the panel's overlap with the photo, so the photo starts and stops
 * moving gently. `start` is the overlap with the panel at rest, mostly short of
 * the photo; the curve leaves 0 there, flat, and joins the overlap at slope 1
 * as far past the photo, so it never falls under it. The photo then comes to
 * rest only as the panel does, not while the panel is still moving fast.
 */
function ease(overlap: number, start: number) {
  const from = Math.max(start, -LONGEST_EASE);
  const to = Math.max(-from, from + 2 * KNEE);
  if (overlap <= from) return 0;
  if (overlap >= to) return overlap;
  // A cubic from (from, 0) flat to (to, to) at slope 1.
  const span = to - from;
  const t = (overlap - from) / span;
  return to * (3 * t * t - 2 * t ** 3) + span * (t ** 3 - t * t);
}

/**
 * Fits the photos in a viewer into the room above a panel covering the bottom of
 * the stage. Hand it the scroll timeline that moves the panel, and each photo
 * gets a scroll-driven animation sampled from its pose, so it follows on the
 * compositor with no script while the panel moves.
 */
export class PhotoRoom {
  readonly #dialog: HTMLElement;
  readonly #stage: HTMLElement;
  readonly #variables: PhotoRoomVariables;
  readonly #rests = new WeakMap<HTMLElement, Rest>();
  readonly #animations = new Map<HTMLElement, Animation>();
  readonly #observer: MutationObserver;
  #rest = 0;
  #track: PhotoRoomTrack | undefined;

  /** `stage` is the box the photos rest in, the dialog unless it moves. */
  constructor(dialog: HTMLElement, variables: PhotoRoomVariables, stage: HTMLElement = dialog) {
    this.#dialog = dialog;
    this.#stage = stage;
    this.#variables = variables;
    // Slides come and go as the strip scrolls; new ones take the current pose.
    this.#observer = new MutationObserver(() => this.#refresh());
    this.#observer.observe(stage, { childList: true, subtree: true });
  }

  /** Follow a scroll timeline, or let the photos rest with undefined. */
  track(track: PhotoRoomTrack | undefined, rest: number) {
    this.#rest = rest;
    this.#track = track;
    this.#cancel();
    this.#clearStyles();
    if (track) this.#animateSlides();
  }

  /**
   * Stop following the scroll and hold each photo where it is, so the viewer
   * can fly it from there while the panel goes on moving under it. The pose
   * moves from the slide onto its frame, whose transform the viewer reads as
   * the flight's start.
   */
  freeze() {
    this.#track = undefined;
    for (const [slide, animation] of this.#animations) {
      const { translate, scale } = getComputedStyle(slide);
      animation.cancel();
      const frame = slide.querySelector<HTMLElement>("[data-fluidbox-frame]");
      const rest = this.#rests.get(slide);
      if (!frame || !rest) continue;
      const ty = Number.parseFloat(translate.split(" ")[1] ?? "0") || 0;
      const factor = scale === "none" ? 1 : Number.parseFloat(scale) || 1;
      // The slide scales about its origin and then moves; the frame, at `at`
      // in the slide, scales about its own top left, so the difference moves it.
      const at = offsetWithin(frame, slide);
      const current = getComputedStyle(frame).transform;
      const pose = new DOMMatrix()
        .translate(
          (rest.originX - at.left) * (1 - factor),
          (rest.originY - at.top) * (1 - factor) + ty,
        )
        .scale(factor)
        .multiply(new DOMMatrix(current === "none" ? undefined : current));
      frame.style.transform = pose.toString();
    }
    this.#animations.clear();
    this.#clearStyles();
  }

  /** Measure the photos afresh, as after a resize. */
  forget() {
    this.#cancel();
    for (const slide of this.#slides()) this.#rests.delete(slide);
    this.#refresh();
  }

  destroy() {
    this.#observer.disconnect();
    this.#track = undefined;
    this.#cancel();
    this.#clearStyles();
    for (const slide of this.#slides()) this.#rests.delete(slide);
  }

  #refresh() {
    if (this.#track) this.#animateSlides();
  }

  #cancel() {
    for (const animation of this.#animations.values()) animation.cancel();
    this.#animations.clear();
  }

  #clearStyles() {
    for (const slide of this.#slides()) {
      slide.style.translate = slide.style.scale = slide.style.transformOrigin = "";
    }
  }

  #length(name: string) {
    return Number.parseFloat(getComputedStyle(this.#dialog).getPropertyValue(name)) || 0;
  }

  /** The fit limit in pixels, from a length or a percentage of the stage. */
  #limit(height: number) {
    const value = getComputedStyle(this.#dialog).getPropertyValue(this.#variables.limit).trim();
    if (!value) return height * DEFAULT_FIT_LIMIT;
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) return height * DEFAULT_FIT_LIMIT;
    return value.endsWith("%") ? (height * number) / 100 : number;
  }

  #slides() {
    return this.#stage.querySelectorAll<HTMLElement>("[data-fluidbox-slide]");
  }

  /** Where the photo in a slide sits with the panel away, from layout, so no transform counts. */
  #restOf(slide: HTMLElement): Rest | undefined {
    const cached = this.#rests.get(slide);
    if (cached) return cached;
    const media =
      slide.querySelector<HTMLElement>("[data-fluidbox-media]") ??
      slide.querySelector<HTMLElement>("[data-fluidbox-frame]");
    if (!media?.offsetHeight) return undefined;
    const at = offsetWithin(media, this.#stage);
    const box = offsetWithin(slide, this.#stage);
    const rest = {
      top: at.top,
      bottom: at.top + media.offsetHeight,
      height: media.offsetHeight,
      originX: at.left - box.left + media.offsetWidth / 2,
      originY: at.top - box.top,
    };
    this.#rests.set(slide, rest);
    return rest;
  }

  /** The photo shrinks (fit) or rises (push) into the room above a panel covering `covered`. */
  #pose(
    rest: Rest,
    covered: number,
    height: number,
    style: CSSStyleDeclaration,
    lead: number,
  ): Pose {
    const rising = Math.max(0, covered - this.#rest);
    const gap =
      (Number.parseFloat(style.getPropertyValue(this.#variables.gap)) || 0) *
      Math.min(1, rising / 48);
    // How far the panel's edge has come over the photo, eased; see ease().
    const atRest = rest.bottom - (height - this.#rest + lead);
    const overlap = ease(rest.bottom - (height - covered - gap), atRest);
    if (overlap <= 0) return { ty: 0, scale: 1 };
    const bottom = rest.bottom - overlap;
    const top = Math.min(rest.top, this.#length("--fluidbox-stage-top"));
    if (style.getPropertyValue(this.#variables.photo).trim() === "push") {
      // Rises with the panel until its top meets the stage; then the panel covers it.
      return { ty: clamp(bottom - rest.bottom, top - rest.top, 0), scale: 1 };
    }
    // Shrinks until the panel reaches the limit, then rises with it at that size.
    const beyond = Math.max(0, covered - Math.max(this.#rest, this.#limit(height)));
    const scale = clamp((bottom + beyond - top) / rest.height, 0.25, 1);
    return { ty: bottom - scale * rest.height - rest.top, scale };
  }

  /** One scroll-driven animation per slide, sampled from the pose at each scroll offset. */
  #animateSlides() {
    const track = this.#track!;
    if (track.range <= 0) return;
    const height = this.#stage.clientHeight;
    const style = getComputedStyle(this.#dialog);
    const lead = track.lead ?? 0;
    for (const slide of this.#slides()) {
      if (this.#animations.has(slide)) continue;
      const rest = this.#restOf(slide);
      if (!rest) continue;
      const points: [number, Pose][] = [[0, { ty: 0, scale: 1 }]];
      if (track.from > 0) points.push([track.from, { ty: 0, scale: 1 }]);
      for (let offset = track.from; ; offset += SAMPLE_STEP) {
        const at = Math.min(offset, track.range);
        const covered = this.#rest - lead + at - track.from;
        points.push([at, this.#pose(rest, covered, height, style, lead)]);
        if (at >= track.range) break;
      }
      const keyframes = collinearFree(points).map(([at, pose]) => ({
        offset: at / track.range,
        translate: `0 ${pose.ty}px`,
        scale: String(pose.scale),
      }));
      if (keyframes.every((frame) => frame.translate === "0 0px" && frame.scale === "1")) continue;
      slide.style.transformOrigin = `${rest.originX}px ${rest.originY}px`;
      const animation = slide.animate(keyframes, {
        timeline: track.timeline,
        fill: "both",
      } as KeyframeAnimationOptions);
      this.#animations.set(slide, animation);
    }
  }
}

/** An element's layout offset inside an ancestor, ignoring transforms. */
function offsetWithin(element: HTMLElement, ancestor: HTMLElement) {
  let top = 0;
  let left = 0;
  for (
    let node: Element | null = element;
    node instanceof HTMLElement && node !== ancestor;
    node = node.offsetParent
  ) {
    top += node.offsetTop;
    left += node.offsetLeft;
  }
  return { top, left };
}

/** Drop samples that lie on the line between their neighbours. */
function collinearFree(points: [number, Pose][]): [number, Pose][] {
  const kept: [number, Pose][] = [];
  for (const [index, point] of points.entries()) {
    const previous = kept.at(-1);
    const next = points[index + 1];
    if (previous && next && point[0] > previous[0]) {
      const t = (point[0] - previous[0]) / (next[0] - previous[0]);
      const ty = previous[1].ty + (next[1].ty - previous[1].ty) * t;
      const scale = previous[1].scale + (next[1].scale - previous[1].scale) * t;
      if (Math.abs(ty - point[1].ty) < 0.05 && Math.abs(scale - point[1].scale) < 0.0001) continue;
    }
    if (previous && point[0] === previous[0]) kept.pop();
    kept.push(point);
  }
  return kept;
}
