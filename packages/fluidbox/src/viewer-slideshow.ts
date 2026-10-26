import { idOf } from "./items";
import type { FluidboxItem, FluidboxSlideshowOptions } from "./public-api";
import type { SessionController } from "./runtime-types";

/** What the slideshow reads from the viewer it plays. */
export interface SlideshowViewer {
  controller(): SessionController<FluidboxItem> | undefined;
  /** Whether the gallery goes round, which the slideshow follows unless told otherwise. */
  loops(): boolean;
  /** Settles once the slide for an item is ready, after `cap` ms, or once `signal` aborts. */
  ready(index: number, cap: number, signal: AbortSignal): Promise<void> | undefined;
  /** The slide on show, whose videos hold the slideshow while they play. */
  slide(): Element | undefined;
  /** The dialog, where its videos' events pass. */
  readonly dialog: HTMLElement;
  /** The live region, quiet while the slideshow plays. */
  readonly status: HTMLElement;
}

/**
 * The slideshow's timer: after `interval` on a slide, it waits for the next
 * one to be ready, as long again at most, then moves to it with the reason
 * "slideshow". Any input pauses it, until `play()` or the control. A hidden
 * tab or a video playing in the slide only hold it: it stays playing, and its
 * interval starts again once they end. Nothing runs while it is paused or the
 * viewer is closed.
 */
export class ViewerSlideshow {
  #options: FluidboxSlideshowOptions | undefined;
  /** Whether it plays: the person's choice, which a hold leaves alone. */
  playing = false;
  /** The open has played once by `autoplay`. */
  #autoplayed = false;
  /** The interval under way, and then the wait and the move it ends in; undefined while none is. */
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Ends the interval's wait for its next slide, once a pause, a hold or a move overtakes it. */
  #run: AbortController | undefined;
  /** The id of the item the interval belongs to: items set around it, fresh objects or not, don't start it again. */
  #item: string | undefined;
  /** The listeners for the tab and the videos, while it plays. */
  #watching: AbortController | undefined;
  readonly #viewer: SlideshowViewer;

  constructor(viewer: SlideshowViewer) {
    this.#viewer = viewer;
  }

  set options(options: FluidboxSlideshowOptions | undefined) {
    this.#options = options;
  }

  /**
   * Play on an open or opening viewer that has a slide to move to. A hidden
   * tab or a playing video holds it from the start. Playing already, it
   * changes nothing.
   */
  play() {
    const state = this.#viewer.controller()?.state;
    if (
      !this.playing &&
      (state?.status === "open" || state?.status === "opening") &&
      this.#next() !== null
    ) {
      this.#item = state.item ? idOf(state.item) : undefined;
      this.#set(true);
    }
  }

  /** A pause that sticks: a person's input, `pause()` or the control. */
  pause() {
    if (this.playing) this.#set(false);
  }

  /**
   * A person's input to the viewer. A press on the Slideshow control, and
   * Enter or Space on it, are left to its click, which plays or pauses; any
   * other key on it, or a wheel, pauses as it does anywhere.
   */
  interaction(event?: Event) {
    const own =
      event?.type === "keydown"
        ? ["Enter", " "].includes((event as KeyboardEvent).key)
        : event?.type !== "wheel";
    const target = event?.target;
    if (own && target instanceof Element && target.closest("[data-fluidbox-slideshow]")) return;
    this.pause();
  }

  /** The viewer's status changed: opening, it may autoplay; closing stops it. */
  statusChanged(status: "closed" | "opening" | "open" | "closing") {
    if (status === "open") {
      if (this.#options?.autoplay && !this.#autoplayed) {
        this.#autoplayed = true;
        this.play();
      }
    } else if (status !== "opening") {
      this.#autoplayed = false;
      this.pause();
    }
  }

  /**
   * The viewer settled on a slide, by the slideshow or not: on another item,
   * the interval starts again, and on the last without a loop, it stops.
   */
  moved(item: FluidboxItem) {
    const id = idOf(item);
    if (id === this.#item) return;
    this.#item = id;
    this.#arm();
  }

  destroy() {
    this.pause();
  }

  #set(playing: boolean) {
    if (playing) this.#watch();
    else {
      this.#watching?.abort();
      this.#watching = undefined;
    }
    // Quiet while it plays, so a screen reader isn't interrupted at every slide.
    this.#viewer.status.setAttribute("aria-live", playing ? "off" : "polite");
    const changed = playing !== this.playing;
    this.playing = playing;
    this.#arm();
    if (changed) this.#viewer.controller()?.changed?.();
  }

  /** The slide after the one on show: null on the last without a loop, undefined before there is one. */
  #next() {
    const state = this.#viewer.controller()?.state;
    if (state?.index == null) return;
    const { index, count } = state;
    const loop = this.#options?.loop ?? this.#viewer.loops();
    return index + 1 < count ? index + 1 : loop && count > 1 ? 0 : null;
  }

  /** Start the interval on the slide on show, unless paused or held. */
  #arm() {
    this.#stop();
    if (!this.playing) return;
    // Without a loop it stops on the last slide, as soon as it is there.
    if (this.#next() === null) return this.pause();
    if (this.#held()) return;
    const run = (this.#run = new AbortController());
    const interval = this.#options?.interval ?? 5000;
    this.#timer = setTimeout(async () => {
      const controller = this.#viewer.controller()!;
      const next = this.#next();
      if (controller.state.status === "open" && next != null) {
        try {
          await this.#viewer.ready(next, interval, run.signal);
          if (run.signal.aborted) return;
          await controller.goTo({ index: next }, { reason: "slideshow" });
        } catch {}
      }
      // Still opening, or a move a listener prevented or that failed: another interval.
      if (!run.signal.aborted) this.#arm();
    }, interval);
  }

  #stop() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#run?.abort();
  }

  /** A hidden tab, or a video playing in the slide on show. */
  #held() {
    const slide = this.#viewer.slide();
    return (
      this.#viewer.dialog.ownerDocument.visibilityState === "hidden" ||
      (!!slide && [...slide.querySelectorAll("video")].some((video) => !video.paused))
    );
  }

  /** Hold and release as the tab hides and shows, and as a video in the slide plays and stops. */
  #watch() {
    if (this.#watching) return;
    const watching = (this.#watching = new AbortController());
    const { signal } = watching;
    // A hold stops the interval; its end starts it again.
    const check = () => {
      if (this.#held()) this.#stop();
      else if (!this.#timer) this.#arm();
    };
    this.#viewer.dialog.ownerDocument.addEventListener("visibilitychange", check, { signal });
    // Media events don't bubble, so the dialog catches them on their way down.
    for (const type of ["play", "pause", "ended"]) {
      this.#viewer.dialog.addEventListener(
        type,
        (event) => {
          if (this.#viewer.slide()?.contains(event.target as Node)) check();
        },
        { capture: true, signal },
      );
    }
  }
}
