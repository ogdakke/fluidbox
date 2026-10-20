export interface FilmstripLayout {
  readonly size: number;
  readonly step: number;
  readonly visibleCount: number;
  /** The strip runs as a column, from --fluidbox-filmstrip-axis: y. */
  readonly vertical: boolean;
}

/** The input that moved the strip. */
export type FilmstripInput = "pointer" | "wheel" | "keyboard";

interface FilmstripRuntimeOptions {
  readonly element: HTMLElement;
  readonly scroller: HTMLElement;
  readonly count: number;
  readonly index: number;
  readonly onSelect: (index: number, settled: boolean, input: FilmstripInput) => void;
  readonly onWindowChange: (center: number, layout: FilmstripLayout, force: boolean) => void;
  /** The axis changed: mark the scroller, so its CSS lays it out that way. */
  readonly onAxisChange: (vertical: boolean) => void;
  readonly deferActivation?: boolean;
  /** Whether the arrows go round from one end to the other, as a looping gallery does. */
  readonly loops?: () => boolean;
}

type ScrollMode = "idle" | "user";

/** Native filmstrip scroll ownership shared by framework renderers. */
export class FilmstripRuntime {
  readonly #element: HTMLElement;
  readonly #scroller: HTMLElement;
  readonly #count: number;
  readonly #onSelect: FilmstripRuntimeOptions["onSelect"];
  readonly #onWindowChange: FilmstripRuntimeOptions["onWindowChange"];
  readonly #onAxisChange: FilmstripRuntimeOptions["onAxisChange"];
  readonly #loops: () => boolean;
  readonly #controller = new AbortController();
  readonly #observer: ResizeObserver;
  #index: number;
  #size = 52;
  #step = 57;
  #padding = 0;
  #viewportWidth = 0;
  #vertical = false;
  /** -1 for a right-to-left row, where `scrollLeft` counts down from 0. */
  #sign = 1;
  #input: FilmstripInput = "pointer";
  #mode: ScrollMode = "idle";
  #touching = false;
  #userScrolled = false;
  #windowCenter = -1;
  #initializing = true;
  readonly #deferActivation: boolean;
  #scrollFrame = 0;
  #centerFrame = 0;
  #mountFrame = 0;
  #readyFrame = 0;
  #settleFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: FilmstripRuntimeOptions) {
    this.#element = options.element;
    this.#scroller = options.scroller;
    this.#count = options.count;
    this.#index = options.index;
    this.#onSelect = options.onSelect;
    this.#onWindowChange = options.onWindowChange;
    this.#onAxisChange = options.onAxisChange;
    this.#loops = options.loops ?? (() => false);
    this.#deferActivation = options.deferActivation ?? false;
    const { signal } = this.#controller;
    this.#scroller.addEventListener("scroll", this.#onScroll, { passive: true, signal });
    this.#scroller.addEventListener("scrollend", this.#onSettled, { signal });
    this.#scroller.addEventListener("touchstart", this.#onTouchStart, {
      passive: true,
      signal,
    });
    this.#scroller.addEventListener("touchend", this.#onTouchEnd, { passive: true, signal });
    this.#scroller.addEventListener("touchcancel", this.#onTouchEnd, { passive: true, signal });
    this.#scroller.addEventListener("pointerdown", this.#takeControl, {
      capture: true,
      passive: true,
      signal,
    });
    this.#scroller.addEventListener("pointerup", this.#releaseControl, {
      capture: true,
      passive: true,
      signal,
    });
    this.#scroller.addEventListener("pointercancel", this.#releaseControl, {
      capture: true,
      passive: true,
      signal,
    });
    this.#scroller.addEventListener("keydown", this.#onKeyDown, { signal });
    this.#scroller.addEventListener("wheel", this.#onWheel, {
      capture: true,
      passive: false,
      signal,
    });
    this.#observer = new ResizeObserver(this.#onResize);
  }

  mount() {
    this.#readGeometry();
    this.#publishWindow(this.#index);
    this.#center(this.#index);
    this.#observer.observe(this.#scroller);
    this.#mountFrame = requestAnimationFrame(() => {
      this.#readGeometry();
      this.#publishWindow(this.#index, true);
      this.#center(this.#index);
      if (!this.#deferActivation) this.#queueActivation();
      this.#mountFrame = 0;
    });
  }

  activate(index = this.#index) {
    const previous = this.#index;
    this.#index = index;
    this.#publishWindow(index);
    if (index !== previous || this.#initializing) this.#center(index);
    this.#queueActivation();
  }

  sync(index: number, center = true, smooth = false) {
    if ((this.#initializing && this.#deferActivation) || index === this.#index) return false;
    this.#index = index;
    this.#publishWindow(index);
    if (!this.#initializing && center && this.#mode !== "user") this.#center(index, smooth);
    return true;
  }

  choose(index: number, settled = true, input: FilmstripInput = "pointer") {
    this.#index = index;
    this.#publishWindow(index);
    this.#center(index);
    this.#onSelect(index, settled, input);
  }

  settle(index: number) {
    if (this.#initializing) return false;
    this.#index = index;
    this.#publishWindow(index);
    return true;
  }

  /**
   * Read the strip's CSS again, as once the viewer is in the document: a
   * strip built before then could not see its axis or its sizes.
   */
  measure() {
    const vertical = this.#vertical;
    const step = this.#step;
    const extent = this.#viewportWidth;
    this.#readGeometry();
    if (vertical === this.#vertical && step === this.#step && extent === this.#viewportWidth)
      return;
    this.#publishWindow(this.#index, true);
    if (this.#mode !== "user") this.#center(this.#index);
  }

  scrollTo(index: number, smooth: boolean) {
    this.#publishWindow(index);
    this.#center(index, smooth);
  }

  destroy() {
    this.#controller.abort();
    this.#observer.disconnect();
    cancelAnimationFrame(this.#scrollFrame);
    cancelAnimationFrame(this.#centerFrame);
    cancelAnimationFrame(this.#mountFrame);
    cancelAnimationFrame(this.#readyFrame);
    this.#clearSettle();
  }

  #clearSettle() {
    cancelAnimationFrame(this.#settleFrame);
    this.#settleFrame = 0;
    clearTimeout(this.#settleTimer);
  }

  /**
   * Settle a while after input that scrolls on the next frame. That frame
   * delivers the scroll events, so a frame that stalls past the settle delay
   * cannot end the user's control before the browser reports their scroll.
   */
  #settleAfterFrame() {
    this.#clearSettle();
    this.#settleFrame = requestAnimationFrame(() => {
      this.#settleFrame = 0;
      this.#settleTimer = setTimeout(this.#onSettled, 160);
    });
  }

  /** The scroller's length along the strip. */
  get #extent() {
    return this.#vertical ? this.#scroller.clientHeight : this.#scroller.clientWidth;
  }

  get #scrolled() {
    return this.#vertical ? this.#scroller.scrollTop : this.#sign * this.#scroller.scrollLeft;
  }

  #readGeometry() {
    const elementStyle = getComputedStyle(this.#element);
    // Read from CSS, so a media query can turn the strip into a column.
    const vertical = elementStyle.getPropertyValue("--fluidbox-filmstrip-axis").trim() === "y";
    if (vertical !== this.#vertical) {
      this.#vertical = vertical;
      this.#onAxisChange(vertical);
    }
    const scrollerStyle = getComputedStyle(this.#scroller);
    this.#sign = !vertical && scrollerStyle.direction === "rtl" ? -1 : 1;
    this.#viewportWidth = this.#extent;
    this.#size = parseFloat(elementStyle.getPropertyValue("--fluidbox-filmstrip-item-size")) || 52;
    const gap = vertical ? scrollerStyle.rowGap : scrollerStyle.columnGap;
    this.#step = this.#size + (parseFloat(gap) || 0);
    this.#padding =
      parseFloat(vertical ? scrollerStyle.paddingTop : scrollerStyle.paddingLeft) || 0;
  }

  #publishWindow(center: number, force = false) {
    if (!force && center === this.#windowCenter) return;
    this.#windowCenter = center;
    this.#onWindowChange(
      center,
      {
        size: this.#size,
        step: this.#step,
        visibleCount: Math.ceil(this.#extent / this.#step) * 2 + 9,
        vertical: this.#vertical,
      },
      force,
    );
  }

  #queueActivation() {
    cancelAnimationFrame(this.#readyFrame);
    this.#readyFrame = requestAnimationFrame(() => {
      this.#initializing = false;
      this.#mode = "idle";
      this.#readyFrame = 0;
    });
  }

  #center(index: number, smooth = false) {
    this.#mode = "idle";
    this.#userScrolled = false;
    this.#position(index, smooth);
    cancelAnimationFrame(this.#centerFrame);
    if (!smooth) {
      // Rendering a new virtual thumbnail window can make the browser apply
      // scroll anchoring after the first position write. Reapply the known
      // selection after the renderer commits its window.
      this.#centerFrame = requestAnimationFrame(() => {
        this.#centerFrame = 0;
        if (this.#mode === "idle") this.#position(this.#index, false);
      });
    }
  }

  #position(index: number, smooth: boolean) {
    const start = this.#padding + index * this.#step + this.#size / 2 - this.#extent / 2;
    const length = this.#vertical ? this.#scroller.scrollHeight : this.#scroller.scrollWidth;
    const target = Math.max(0, Math.min(start, length - this.#extent));
    this.#scroller.scrollTo({
      [this.#vertical ? "top" : "left"]: this.#sign * target,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  #nearestIndex() {
    const center = this.#scrolled + this.#extent / 2;
    return Math.max(
      0,
      Math.min(this.#count - 1, Math.round((center - this.#padding - this.#size / 2) / this.#step)),
    );
  }

  #select(index: number, settled: boolean) {
    if (index !== this.#index) {
      this.#index = index;
      this.#publishWindow(index);
      this.#onSelect(index, false, this.#input);
    }
    if (settled) this.#onSelect(index, true, this.#input);
  }

  #onResize = () => {
    const previousStep = this.#step;
    const previousWidth = this.#viewportWidth;
    this.#readGeometry();
    this.#publishWindow(
      this.#index,
      previousStep !== this.#step || previousWidth !== this.#viewportWidth,
    );
    if (
      (previousStep !== this.#step || previousWidth !== this.#viewportWidth) &&
      this.#mode !== "user"
    ) {
      this.#center(this.#index);
    }
  };

  #onScroll = () => {
    // A scroll event is not proof of user intent. WebKit can deliver delayed
    // events for an earlier instant/programmatic scroll after activation. If
    // those events take control here, the passing thumbnail becomes a new
    // selection and starts a center -> select -> center feedback loop.
    // Touch, pointer, wheel, and keyboard input claim ownership explicitly.
    if (this.#mode !== "user") return;
    this.#publishWindow(this.#nearestIndex());
    // Input during the opening scrolls the strip, but selects only once it is ready.
    if (this.#initializing) return;
    this.#userScrolled = true;
    if (!this.#scrollFrame) {
      this.#scrollFrame = requestAnimationFrame(() => {
        this.#scrollFrame = 0;
        if (!this.#initializing && this.#mode === "user") this.#select(this.#nearestIndex(), false);
      });
    }
    this.#clearSettle();
    if (!this.#touching) this.#settleTimer = setTimeout(this.#onSettled, 160);
  };

  #onSettled = () => {
    this.#clearSettle();
    if (this.#initializing || this.#touching) return;
    if (this.#mode !== "user") return;
    cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = 0;
    if (this.#userScrolled) this.#select(this.#nearestIndex(), true);
    this.#mode = "idle";
    this.#userScrolled = false;
  };

  #onTouchStart = () => {
    this.#touching = true;
    this.#clearSettle();
    this.#takeControl();
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length) return;
    this.#touching = false;
    this.#clearSettle();
    this.#settleTimer = setTimeout(this.#onSettled, 160);
  };

  #takeControl = (event?: Event) => {
    this.#input = event?.type === "wheel" ? "wheel" : "pointer";
    this.#clearSettle();
    if (this.#mode !== "user") this.#userScrolled = false;
    this.#mode = "user";
  };

  #releaseControl = () => {
    if (this.#touching) return;
    this.#clearSettle();
    if (!this.#userScrolled) {
      this.#mode = "idle";
      return;
    }
    this.#settleTimer = setTimeout(this.#onSettled, 160);
  };

  /** A listbox's keys: the arrows along the strip step, Home and End go to the ends. */
  #onKeyDown = (event: KeyboardEvent) => {
    const rtl = this.#sign < 0;
    const back = this.#vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
    const forward = this.#vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
    const target =
      event.key === back
        ? this.#index - 1
        : event.key === forward
          ? this.#index + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? this.#count - 1
              : null;
    if (target === null || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const count = this.#count;
    const index = this.#loops()
      ? (target + count) % count
      : Math.max(0, Math.min(count - 1, target));
    if (index !== this.#index) this.choose(index, true, "keyboard");
  };

  #onWheel = (event: WheelEvent) => {
    if (!event.deltaX && !event.deltaY) return;
    this.#takeControl(event);
    // A wheel turned across the strip scrolls it along; one turned along it
    // scrolls it natively.
    const across = this.#vertical ? event.deltaX : event.deltaY;
    const along = this.#vertical ? event.deltaY : event.deltaX;
    if (Math.abs(across) > Math.abs(along) && event.cancelable) {
      event.preventDefault();
      if (this.#vertical) this.#scroller.scrollTop += across;
      else this.#scroller.scrollLeft += this.#sign * across;
    }
    this.#settleAfterFrame();
  };
}
