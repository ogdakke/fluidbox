/**
 * A 360° spin: an object photographed all the way round, turned by a drag or
 * the arrow keys. Safe to import on the server.
 */
import { addStyles, paintPoster, posterStyles } from "./addon-styles";
import type {
  FluidboxCustomItemBase,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** A spin's frames, one full turn in order. Make one with `spinItem`. */
export interface FluidboxSpinItem extends FluidboxCustomItemBase<"spin"> {
  readonly id: string;
  /** The frames' URLs, a full turn in order. The first is the spin's poster. */
  readonly frames: readonly string[];
  /**
   * Turn by itself while on show, until someone turns it: `true`, or the
   * seconds a turn takes. Never with reduced motion.
   * @default false
   */
  readonly autoplay?: boolean | number;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    spin: FluidboxSpinItem;
  }
}

/** Frames numbered in their URLs, as `{ src: "/mug/{index}.webp", count: 36 }`. */
export interface FluidboxSpinFrameTemplate {
  /** The URL with `{index}` where the frame's number goes. */
  readonly src: string;
  readonly count: number;
  /** @default 0 */
  readonly start?: number;
  /** Pad the number with zeros to this many digits. @default 0 */
  readonly digits?: number;
}

/** What `spinItem` takes. */
export interface FluidboxSpinItemOptions extends Omit<
  FluidboxSpinItem,
  "type" | "id" | "frames" | "thumbnail"
> {
  readonly frames: readonly string[] | FluidboxSpinFrameTemplate;
  /** Defaults to the first frame's URL. */
  readonly id?: string;
  readonly thumbnail?: FluidboxThumbnail;
}

/** The frames' URLs from a list or a template. */
export function spinFrames(frames: readonly string[] | FluidboxSpinFrameTemplate): string[] {
  if (Array.isArray(frames)) return [...frames];
  const { src, count, start = 0, digits = 0 } = frames as FluidboxSpinFrameTemplate;
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`A spin needs a whole number of frames: ${count}`);
  }
  return Array.from({ length: count }, (_, index) =>
    src.replaceAll("{index}", String(start + index).padStart(digits, "0")),
  );
}

/** A spin item for the spin slide. */
export function spinItem(options: FluidboxSpinItemOptions): FluidboxSpinItem {
  const frames = spinFrames(options.frames);
  if (!frames.length) throw new RangeError("A spin needs at least one frame.");
  return {
    ...options,
    type: "spin",
    id: options.id ?? frames[0]!,
    frames,
  };
}

/** What `createSpinSlide` takes. */
export interface FluidboxSpinSlideOptions {
  /**
   * The spin's value as a slider reads it.
   * @default (frame, count) => `Frame ${frame} of ${count}`
   */
  readonly label?: (frame: number, count: number) => string;
  /**
   * The most frames held decoded at once. The rest stay in the browser's cache
   * and decode again on the way past.
   * @default 48
   */
  readonly keep?: number;
  /**
   * How many turns a drag across the whole spin makes.
   * @default 1
   */
  readonly turns?: number;
}

const spinStyles = `
:where([data-fluidbox-spin]) {
  touch-action: none;
  outline-offset: -2px;
}
:where([data-fluidbox-spin]) > [data-fluidbox-media-poster] {
  object-fit: contain;
}
`;

/** How fast a released spin slows: the share of its speed it keeps each millisecond. */
const FRICTION = 0.995;
/** Below this many frames a millisecond, a released spin settles. */
const REST = 0.004;

/**
 * Make the slide for spin items. Frame 0 shows at once and is what the
 * opening flight lands on; the other frames load at low priority once the slide
 * is first on show. A horizontal drag turns the spin and lets go with inertia
 * that settles on a frame. With the spin focused, the arrow keys step a frame,
 * Home and End go to the first and last. The spin owns its input, so neither
 * gesture nor keys move the viewer.
 */
export function createSpinSlide(
  options: FluidboxSpinSlideOptions = {},
): FluidboxSlideRenderer<FluidboxSpinItem> {
  const label = options.label ?? ((frame, count) => `Frame ${frame} of ${count}`);
  const keep = Math.max(2, options.keep ?? 48);
  const turns = options.turns ?? 1;
  return ({ item, media: target, signal, active, onActiveChange }) => {
    const ownerDocument = target.ownerDocument;
    const view = ownerDocument.defaultView!;
    addStyles(ownerDocument, "spin", posterStyles + spinStyles);
    const { frames } = item;
    const count = frames.length;
    const box = ownerDocument.createElement("div");
    box.dataset.fluidboxMediaAddon = "";
    box.dataset.fluidboxSpin = "";
    box.dataset.fluidboxOwnsInput = "";
    box.tabIndex = 0;
    box.setAttribute("role", "slider");
    box.setAttribute("aria-label", item.title);
    box.setAttribute("aria-valuemin", "1");
    box.setAttribute("aria-valuemax", String(count));
    // Frame 0 is the poster: over the thumbnail, or on its own.
    paintPoster(box, item.thumbnail, frames[0], signal);
    const screen = box.lastElementChild as HTMLImageElement;
    target.append(box);

    // Decoded frames, the newest last, at most `keep` of them.
    const decoded = new Map<number, HTMLImageElement>();
    const pending = new Map<number, Promise<boolean>>();
    const hold = (frame: number, image: HTMLImageElement) => {
      decoded.delete(frame);
      decoded.set(frame, image);
      for (const [old] of decoded) {
        if (decoded.size <= keep) break;
        if (old !== shown) decoded.delete(old);
      }
    };
    const decode = (frame: number, priority: "high" | "low") => {
      if (decoded.has(frame)) return Promise.resolve(true);
      let loading = pending.get(frame);
      if (!loading) {
        const image = new view.Image();
        image.decoding = "async";
        image.fetchPriority = priority;
        image.src = frames[frame]!;
        loading = image.decode().then(
          () => {
            pending.delete(frame);
            if (signal.aborted) return false;
            hold(frame, image);
            return true;
          },
          () => {
            pending.delete(frame);
            return false;
          },
        );
        pending.set(frame, loading);
      }
      return loading;
    };

    let position = 0;
    let shown = 0;
    const frameAt = (at: number) => ((Math.round(at) % count) + count) % count;
    const paint = () => {
      const frame = frameAt(position);
      box.setAttribute("aria-valuenow", String(frame + 1));
      box.setAttribute("aria-valuetext", label(frame + 1, count));
      if (frame === shown) return;
      if (!decoded.has(frame)) {
        // Shown once it has decoded, unless the spin has moved on by then.
        void decode(frame, "high").then((ready) => {
          if (ready && frameAt(position) === frame) paint();
        });
        return;
      }
      shown = frame;
      decoded.get(frame)!.decoding = "sync";
      screen.removeAttribute("srcset");
      screen.src = frames[frame]!;
      delete screen.dataset.fluidboxMediaPending;
      box.dataset.frame = String(frame);
    };
    box.dataset.frame = "0";
    paint();

    // The other frames load once the spin is first on show, spread round the
    // turn first, so an early drag already passes frames all the way round.
    let started = false;
    const loadAll = async () => {
      if (started) return;
      started = true;
      const order: number[] = [];
      const seen = new Set<number>([0]);
      for (let step = count; step >= 1; step = Math.floor(step / 2)) {
        for (let frame = 0; frame < count; frame += step) {
          if (!seen.has(frame)) order.push(frame);
          seen.add(frame);
        }
        if (step === 1) break;
      }
      // Frames past what the spin keeps only need fetching; they decode again later.
      const lanes = 4;
      await Promise.all(
        Array.from({ length: lanes }, async () => {
          while (order.length && !signal.aborted) await decode(order.shift()!, "low");
        }),
      );
      if (!signal.aborted) box.dataset.fluidboxSpinLoaded = "";
    };

    // Motion: a drag, the inertia after it, or the autoplay turn.
    let frameRequest = 0;
    let interacted = false;
    const stopMotion = () => {
      view.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    };
    const settle = () => {
      stopMotion();
      position = Math.round(position);
      paint();
    };
    const reduced = () => view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glide = (velocity: number) => {
      stopMotion();
      if (reduced()) return settle();
      let last = view.performance.now();
      const step = (now: number) => {
        const elapsed = Math.min(64, now - last);
        last = now;
        position += velocity * elapsed;
        velocity *= FRICTION ** elapsed;
        if (Math.abs(velocity) < REST) return settle();
        paint();
        frameRequest = view.requestAnimationFrame(step);
      };
      frameRequest = view.requestAnimationFrame(step);
    };
    const autoplay = () => {
      if (!item.autoplay || interacted || frameRequest || reduced()) return;
      const seconds = typeof item.autoplay === "number" ? item.autoplay : 6;
      let last = view.performance.now();
      const step = (now: number) => {
        position += ((now - last) / (seconds * 1000)) * count;
        last = now;
        paint();
        frameRequest = view.requestAnimationFrame(step);
      };
      frameRequest = view.requestAnimationFrame(step);
    };
    const interact = () => {
      interacted = true;
      stopMotion();
    };

    let drag:
      | { id: number; x: number; start: number; samples: { time: number; position: number }[] }
      | undefined;
    box.addEventListener(
      "pointerdown",
      (event) => {
        if (drag || !event.isPrimary || event.button !== 0) return;
        interact();
        box.setPointerCapture(event.pointerId);
        box.dataset.grabbing = "";
        drag = {
          id: event.pointerId,
          x: event.clientX,
          start: position,
          samples: [{ time: event.timeStamp, position }],
        };
      },
      { signal },
    );
    box.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== drag?.id) return;
        const width = Math.max(1, box.getBoundingClientRect().width);
        position = drag.start + ((event.clientX - drag.x) / width) * count * turns;
        drag.samples.push({ time: event.timeStamp, position });
        while (drag.samples.length > 2 && event.timeStamp - drag.samples[0]!.time > 100) {
          drag.samples.shift();
        }
        paint();
      },
      { signal },
    );
    const release = (event: PointerEvent) => {
      if (event.pointerId !== drag?.id) return;
      const first = drag.samples[0]!;
      const elapsed = event.timeStamp - first.time;
      // A pointer that rested before it lifted lets go without a throw.
      const velocity =
        event.type === "pointerup" &&
        elapsed > 0 &&
        event.timeStamp - drag.samples.at(-1)!.time < 60
          ? (position - first.position) / elapsed
          : 0;
      drag = undefined;
      delete box.dataset.grabbing;
      glide(velocity);
    };
    box.addEventListener("pointerup", release, { signal });
    box.addEventListener("pointercancel", release, { signal });
    box.addEventListener("lostpointercapture", release, { signal });
    box.addEventListener(
      "keydown",
      (event) => {
        const forward = ["ArrowRight", "ArrowUp"].includes(event.key);
        const back = ["ArrowLeft", "ArrowDown"].includes(event.key);
        if (!forward && !back && event.key !== "Home" && event.key !== "End") return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        interact();
        position =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : frameAt(position) + (forward ? 1 : -1);
        position = frameAt(position);
        paint();
      },
      { signal },
    );

    const follow = (now: boolean) => {
      if (now) {
        void loadAll();
        autoplay();
      } else {
        stopMotion();
        if (drag) drag = undefined;
      }
    };
    if (active) follow(true);
    const stop = onActiveChange(follow);
    return () => {
      stop();
      stopMotion();
      decoded.clear();
    };
  };
}
