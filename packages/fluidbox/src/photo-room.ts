type Pose = { readonly ty: number; readonly scale: number };
/** Where a photo sits with the panel away, relative to the top of the stage. */
type Rest = {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly width: number;
  readonly originX: number;
  readonly originY: number;
};

export interface PhotoRoomVariables {
  /**
   * `fit` shrinks the photo into the room left above the panel. With `push` the
   * panel's own layout pushes the stage, from where it meets the active photo,
   * see `hold`; the room moves the other photos to where their own push would
   * put them, and lifts a photo with less room under it than the gap.
   */
  readonly photo: string;
  /** Space kept between the photo and the panel. */
  readonly gap: string;
  /** In `fit`, space the photo keeps clear above and beside it as it shrinks. */
  readonly inset: string;
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
/** The panel rise over which a pushed photo short of the gap lifts by the rest of it. */
const KNEE = 48;
/** Covered pixels between samples of a tracked pose; collinear samples are dropped. */
const SAMPLE_STEP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

  /** Whether the photos are pushed by layout rather than fitted. */
  get pushes() {
    return getComputedStyle(this.#dialog).getPropertyValue(this.#variables.photo).trim() === "push";
  }

  /**
   * With `push`, how far the panel rises from rest before it comes within the
   * gap of the active photo: as far as the stage holds before the panel pushes it.
   */
  hold(lead: number, peek: number) {
    const slide = this.#active();
    const rest = slide && this.#restOf(slide);
    return rest ? this.#holdOf(rest, lead, peek) : 0;
  }

  #holdOf(rest: Rest, lead: number, peek: number) {
    const gap = this.#length(this.#variables.gap);
    return Math.max(0, Math.round(this.#stage.clientHeight - rest.bottom + lead - peek - gap));
  }

  #active() {
    return this.#stage.querySelector<HTMLElement>('[data-fluidbox-slide][aria-hidden="false"]');
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
      width: media.offsetWidth,
      originX: at.left - box.left + media.offsetWidth / 2,
      originY: at.top - box.top,
    };
    this.#rests.set(slide, rest);
    return rest;
  }

  /**
   * The photo shrinks into the room above a panel covering `covered`. It goes
   * from its rest pose to its pose centred in the room above the panel at `end`,
   * clear of the inset and the gap, with its scale and offset both linear in
   * the panel's rise, so each edge moves in a straight line and none crosses
   * the panel. Past `end` it rises with the panel at that size.
   */
  #pose(
    rest: Rest,
    covered: number,
    end: number,
    height: number,
    style: CSSStyleDeclaration,
  ): Pose {
    if (covered <= this.#rest || end <= this.#rest) return { ty: 0, scale: 1 };
    const length = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const inset = length(this.#variables.inset);
    const top = Math.max(Math.min(rest.top, this.#length("--fluidbox-stage-top")), inset);
    const room = height - end - length(this.#variables.gap) - top;
    const scale = clamp(
      Math.min(1, room / rest.height, (this.#stage.clientWidth - 2 * inset) / rest.width),
      0.25,
      1,
    );
    const ty = top + (room - scale * rest.height) / 2 - rest.top;
    const t = Math.min(1, (covered - this.#rest) / (end - this.#rest));
    return {
      ty: ty * t - Math.max(0, covered - end),
      scale: 1 + (scale - 1) * t,
    };
  }

  /** One scroll-driven animation per slide, sampled from the pose at each scroll offset. */
  /**
   * With `push`, the stage rises with the panel once it has risen `active`, the
   * active photo's hold; a photo whose own hold differs moves by the difference,
   * so each sits the gap above the panel. A photo with less room under it than
   * the gap is pushed from the start, touching the panel, and rises by the rest
   * of the gap, eased, over the panel's first KNEE pixels. Only the photos to
   * either side, and that lift of a few pixels, move by animation: neither
   * shows while the panel moves, so its lag can't either.
   */
  #pushed(rest: Rest, risen: number, height: number, lead: number, active: number): Pose {
    const own = this.#holdOf(rest, lead, this.#rest);
    const gap = this.#length(this.#variables.gap);
    const short = gap - (height - rest.bottom + lead - this.#rest);
    const t = clamp(risen / KNEE, 0, 1);
    const lift = short > 0 ? short * (3 * t * t - 2 * t ** 3) : 0;
    return { ty: Math.max(0, risen - active) - Math.max(0, risen - own) - lift, scale: 1 };
  }

  #animateSlides() {
    const track = this.#track!;
    if (track.range <= 0) return;
    const pushes = this.pushes;
    const height = this.#stage.clientHeight;
    const style = getComputedStyle(this.#dialog);
    const lead = track.lead ?? 0;
    const active = pushes ? this.hold(lead, this.#rest) : 0;
    // With fit, the photo shrinks until the panel is all the way up or covers the limit.
    const end = Math.min(
      this.#rest - lead + track.range - track.from,
      Math.max(this.#rest, this.#limit(height)),
    );
    for (const slide of this.#slides()) {
      if (this.#animations.has(slide)) continue;
      const rest = this.#restOf(slide);
      if (!rest) continue;
      const pose = (at: number) =>
        pushes
          ? this.#pushed(rest, at - track.from, height, lead, active)
          : this.#pose(rest, this.#rest - lead + at - track.from, end, height, style);
      const offsets = [0, track.from];
      for (let offset = track.from; offset < track.range; offset += SAMPLE_STEP)
        offsets.push(offset);
      // A push bends where the panel meets each hold; sample there exactly.
      if (pushes)
        offsets.push(track.from + active, track.from + this.#holdOf(rest, lead, this.#rest));
      else offsets.push(track.from + lead, track.from + lead + end - this.#rest);
      offsets.push(track.range);
      const points = [...new Set(offsets.map((at) => clamp(at, 0, track.range)))]
        .sort((a, b) => a - b)
        .map((at): [number, Pose] => [at, at < track.from ? { ty: 0, scale: 1 } : pose(at)]);
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
