import type { FluidboxItem, FluidboxSlideshowOptions } from "./public-api";
import type { SessionController } from "./runtime-types";

/** What the slideshow reads from the viewer it plays. */
export interface SlideshowViewer {
  controller(): SessionController<FluidboxItem> | undefined;
  /** Whether the gallery goes round, which the slideshow follows unless told otherwise. */
  loops(): boolean;
  /** Settles once the slide for an item is ready, or after `cap` ms. */
  ready(index: number, cap: number): Promise<void> | undefined;
  /** The slide on show, whose videos pause the slideshow while they play. */
  slide(): Element | undefined;
  /** The dialog, where its videos' events pass. */
  readonly dialog: HTMLElement;
  /** The live region, quiet while the slideshow plays. */
  readonly status: HTMLElement;
}

/**
 * The slideshow's timer: after `interval` on a slide, it waits for the next
 * one to be ready, as long again at most, then moves to it with the reason
 * "slideshow". Any input pauses it for good; a hidden tab or a playing video
 * pause it until they end. Nothing runs while it is paused or the viewer is
 * closed.
 */
export class ViewerSlideshow {
  #options: FluidboxSlideshowOptions | undefined;
  #playing = false;
  /** The tab or a video paused it, so their ending plays it again. */
  #resume = false;
  /** The open has played once by `autoplay`. */
  #autoplayed = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Counts the timer's runs, so a wait that a pause or a move overtook moves nothing. */
  #run = 0;
  /** The listeners for the tab and the videos, while playing or paused by them. */
  #watching: AbortController | undefined;
  readonly #viewer: SlideshowViewer;

  constructor(viewer: SlideshowViewer) {
    this.#viewer = viewer;
  }

  set options(options: FluidboxSlideshowOptions | undefined) {
    this.#options = options;
  }

  /** Play on an open or opening viewer, even over a video playing now: the person asked. */
  play() {
    const status = this.#viewer.controller()?.state.status;
    if (status !== "open" && status !== "opening") return;
    this.#resume = false;
    this.#set(true);
  }

  /** A pause that sticks: a person's input, `pause()` or the control. */
  pause() {
    this.#resume = false;
    this.#set(false);
  }

  /**
   * A person's input to the viewer. The Slideshow control's own press is
   * left to its click, which plays or pauses.
   */
  interaction(event?: Event) {
    const target = event?.target;
    if (target instanceof Element && target.closest("[data-fluidbox-slideshow]")) return;
    if (this.#playing || this.#resume) this.pause();
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

  /** The viewer settled on another slide, by the slideshow or not: the interval starts again. */
  moved() {
    if (!this.#playing) return;
    if (this.#videoPlaying()) this.#suspend();
    else this.#arm();
  }

  destroy() {
    this.pause();
  }

  #set(playing: boolean) {
    if (playing || this.#resume) this.#watch();
    else this.#unwatch();
    // Quiet while it plays, so a screen reader isn't interrupted at every slide.
    this.#viewer.status.setAttribute("aria-live", playing ? "off" : "polite");
    const changed = playing !== this.#playing;
    this.#playing = playing;
    if (playing) this.#arm();
    else {
      clearTimeout(this.#timer);
      this.#run += 1;
    }
    if (changed) this.#viewer.controller()?.playingChanged?.(playing);
  }

  /** Paused by the tab or a video, until they end. */
  #suspend() {
    this.#resume = true;
    this.#set(false);
  }

  #wake() {
    if (!this.#resume || this.#hidden() || this.#videoPlaying()) return;
    this.#resume = false;
    this.#set(true);
  }

  #arm() {
    clearTimeout(this.#timer);
    const run = ++this.#run;
    const interval = this.#options?.interval ?? 5000;
    this.#timer = setTimeout(async () => {
      const controller = this.#viewer.controller();
      const state = controller?.state;
      if (!state || state.status !== "open" || state.index === null) return;
      const { index, count } = state;
      const loop = this.#options?.loop ?? this.#viewer.loops();
      const next = index + 1 < count ? index + 1 : loop && count > 1 ? 0 : null;
      // Without a loop it stops on the last slide.
      if (next === null) return this.pause();
      await this.#viewer.ready(next, interval);
      if (run !== this.#run) return;
      await controller.goTo({ index: next }, { reason: "slideshow" });
      // A move a listener prevented, or one that settled nowhere new, waits another interval.
      if (run === this.#run && this.#playing) this.#arm();
    }, interval);
  }

  #watch() {
    if (this.#watching) return;
    const watching = (this.#watching = new AbortController());
    const { signal } = watching;
    const ownerDocument = this.#viewer.dialog.ownerDocument;
    ownerDocument.addEventListener(
      "visibilitychange",
      () => {
        if (!this.#hidden()) this.#wake();
        else if (this.#playing) this.#suspend();
      },
      { signal },
    );
    // Media events don't bubble, so the dialog catches them on their way down.
    const media = (event: Event) => {
      const slide = this.#viewer.slide();
      if (!(event.target instanceof HTMLVideoElement) || !slide?.contains(event.target)) return;
      if (event.type === "play") {
        if (this.#playing) this.#suspend();
      } else this.#wake();
    };
    for (const type of ["play", "pause", "ended"]) {
      this.#viewer.dialog.addEventListener(type, media, { capture: true, signal });
    }
  }

  #unwatch() {
    this.#watching?.abort();
    this.#watching = undefined;
  }

  #hidden() {
    return this.#viewer.dialog.ownerDocument.visibilityState === "hidden";
  }

  #videoPlaying() {
    const slide = this.#viewer.slide();
    return !!slide && [...slide.querySelectorAll("video")].some((video) => !video.paused);
  }
}
