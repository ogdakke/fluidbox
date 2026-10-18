export interface FilmstripLayout {
  readonly size: number;
  readonly step: number;
  readonly visibleCount: number;
}

export function filmstripCommandOptions(settled: boolean) {
  return {
    reason: "filmstrip" as const,
    __fluidboxSettled: settled,
  };
}

interface FilmstripRuntimeOptions {
  readonly element: HTMLElement;
  readonly scroller: HTMLElement;
  readonly count: number;
  readonly index: number;
  readonly onSelect: (index: number, settled: boolean) => void;
  readonly onWindowChange: (center: number, layout: FilmstripLayout, force: boolean) => void;
  readonly deferActivation?: boolean;
}

type ScrollMode = "idle" | "user";

/** Native filmstrip scroll ownership shared by framework renderers. */
export class FilmstripRuntime {
  readonly #element: HTMLElement;
  readonly #scroller: HTMLElement;
  readonly #count: number;
  readonly #onSelect: FilmstripRuntimeOptions["onSelect"];
  readonly #onWindowChange: FilmstripRuntimeOptions["onWindowChange"];
  readonly #controller = new AbortController();
  readonly #observer: ResizeObserver;
  #index: number;
  #size = 52;
  #step = 57;
  #padding = 0;
  #viewportWidth = 0;
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
    this.#scroller.addEventListener("keydown", this.#onKeyDown, {
      capture: true,
      passive: true,
      signal,
    });
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

  choose(index: number, settled = true) {
    this.#index = index;
    this.#publishWindow(index);
    this.#center(index);
    this.#onSelect(index, settled);
  }

  get controlling() {
    return this.#mode === "user";
  }

  settle(index: number) {
    if (this.#initializing) return false;
    this.#index = index;
    this.#publishWindow(index);
    return true;
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

  #readGeometry() {
    this.#viewportWidth = this.#scroller.clientWidth;
    const elementStyle = getComputedStyle(this.#element);
    const scrollerStyle = getComputedStyle(this.#scroller);
    this.#size = parseFloat(elementStyle.getPropertyValue("--lightbox-filmstrip-item-size")) || 52;
    this.#step = this.#size + (parseFloat(scrollerStyle.columnGap) || 0);
    this.#padding = parseFloat(scrollerStyle.paddingLeft) || 0;
  }

  #publishWindow(center: number, force = false) {
    if (!force && center === this.#windowCenter) return;
    this.#windowCenter = center;
    this.#onWindowChange(
      center,
      {
        size: this.#size,
        step: this.#step,
        visibleCount: Math.ceil(this.#scroller.clientWidth / this.#step) * 2 + 9,
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
    const left =
      this.#padding + index * this.#step + this.#size / 2 - this.#scroller.clientWidth / 2;
    const target = Math.max(
      0,
      Math.min(left, this.#scroller.scrollWidth - this.#scroller.clientWidth),
    );
    this.#scroller.scrollTo({
      left: target,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  #nearestIndex() {
    const center = this.#scroller.scrollLeft + this.#scroller.clientWidth / 2;
    return Math.max(
      0,
      Math.min(this.#count - 1, Math.round((center - this.#padding - this.#size / 2) / this.#step)),
    );
  }

  #select(index: number, settled: boolean) {
    if (index !== this.#index) {
      this.#index = index;
      this.#publishWindow(index);
      this.#onSelect(index, false);
    }
    if (settled) this.#onSelect(index, true);
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
    if (this.#initializing || this.#mode !== "user") return;
    this.#userScrolled = true;
    this.#publishWindow(this.#nearestIndex());
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

  #takeControl = () => {
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

  #onKeyDown = (event: KeyboardEvent) => {
    if (!/^(Arrow(Left|Right)|Home|End|Page(Up|Down))$/.test(event.key)) return;
    this.#takeControl();
    this.#settleAfterFrame();
  };

  #onWheel = (event: WheelEvent) => {
    if (!event.deltaX && !event.deltaY) return;
    this.#takeControl();
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && event.cancelable) {
      event.preventDefault();
      this.#scroller.scrollLeft += event.deltaY;
    }
    this.#settleAfterFrame();
  };
}
