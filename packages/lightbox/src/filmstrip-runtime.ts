interface FilmstripLayout {
  readonly size: number;
  readonly step: number;
  readonly visibleCount: number;
}

export function filmstripCommandOptions(settled: boolean) {
  return {
    reason: "filmstrip" as const,
    __fluidboxFilmstripSettled: settled,
  };
}

interface FilmstripRuntimeOptions {
  readonly element: HTMLElement;
  readonly scroller: HTMLElement;
  readonly count: number;
  readonly index: number;
  readonly onSelect: (index: number, settled: boolean) => void;
  readonly onWindowChange: (center: number, layout: FilmstripLayout) => void;
}

type ScrollMode = "idle" | "commanded" | "user";

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
  #mode: ScrollMode = "commanded";
  #commandedLeft: number | null = null;
  #touching = false;
  #initializing = true;
  #scrollFrame = 0;
  #mountFrame = 0;
  #readyFrame = 0;
  #settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: FilmstripRuntimeOptions) {
    this.#element = options.element;
    this.#scroller = options.scroller;
    this.#count = options.count;
    this.#index = options.index;
    this.#onSelect = options.onSelect;
    this.#onWindowChange = options.onWindowChange;
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
    this.#scroller.addEventListener("keydown", this.#takeControl, {
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
      this.#publishWindow(this.#index);
      this.#center(this.#index);
      this.#readyFrame = requestAnimationFrame(() => {
        this.#initializing = false;
        this.#mode = "idle";
        this.#readyFrame = 0;
      });
      this.#mountFrame = 0;
    });
  }

  sync(index: number) {
    if (index === this.#index) return;
    this.#index = index;
    this.#publishWindow(index);
    if (!this.#initializing && this.#mode !== "user") this.#center(index);
  }

  choose(index: number) {
    this.#index = index;
    this.#publishWindow(index);
    this.#center(index);
    this.#onSelect(index, true);
  }

  destroy() {
    this.#controller.abort();
    this.#observer.disconnect();
    cancelAnimationFrame(this.#scrollFrame);
    cancelAnimationFrame(this.#mountFrame);
    cancelAnimationFrame(this.#readyFrame);
    clearTimeout(this.#settleTimer);
  }

  #readGeometry() {
    this.#viewportWidth = this.#scroller.clientWidth;
    const elementStyle = getComputedStyle(this.#element);
    const scrollerStyle = getComputedStyle(this.#scroller);
    this.#size = parseFloat(elementStyle.getPropertyValue("--lightbox-filmstrip-item-size")) || 52;
    this.#step = this.#size + (parseFloat(scrollerStyle.columnGap) || 0);
    this.#padding = parseFloat(scrollerStyle.paddingLeft) || 0;
  }

  #publishWindow(center: number) {
    this.#onWindowChange(center, {
      size: this.#size,
      step: this.#step,
      visibleCount: Math.ceil(this.#scroller.clientWidth / this.#step) * 2 + 9,
    });
  }

  #center(index: number) {
    const left =
      this.#padding + index * this.#step + this.#size / 2 - this.#scroller.clientWidth / 2;
    this.#commandedLeft = Math.max(
      0,
      Math.min(left, this.#scroller.scrollWidth - this.#scroller.clientWidth),
    );
    this.#mode = "commanded";
    this.#scroller.scrollTo({ left: this.#commandedLeft, behavior: "instant" });
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
    this.#publishWindow(this.#index);
    if (
      (previousStep !== this.#step || previousWidth !== this.#viewportWidth) &&
      this.#mode !== "user"
    ) {
      this.#center(this.#index);
    }
  };

  #onScroll = () => {
    if (this.#touching || this.#mode === "idle") this.#takeControl();
    if (!this.#scrollFrame) {
      this.#scrollFrame = requestAnimationFrame(() => {
        this.#scrollFrame = 0;
        if (!this.#initializing && this.#mode === "user") {
          this.#select(this.#nearestIndex(), false);
        }
      });
    }
    clearTimeout(this.#settleTimer);
    if (!this.#touching) this.#settleTimer = setTimeout(this.#onSettled, 160);
  };

  #onSettled = () => {
    clearTimeout(this.#settleTimer);
    if (this.#initializing || this.#touching) return;
    if (this.#mode === "commanded") {
      if (Math.abs(this.#scroller.scrollLeft - (this.#commandedLeft ?? 0)) > 1) {
        this.#settleTimer = setTimeout(this.#onSettled, 160);
        return;
      }
      this.#commandedLeft = null;
      this.#mode = "idle";
      return;
    }
    if (this.#mode !== "user") return;
    cancelAnimationFrame(this.#scrollFrame);
    this.#scrollFrame = 0;
    this.#select(this.#nearestIndex(), true);
    this.#mode = "idle";
  };

  #onTouchStart = () => {
    this.#touching = true;
    clearTimeout(this.#settleTimer);
    this.#takeControl();
  };

  #onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length) return;
    this.#touching = false;
    clearTimeout(this.#settleTimer);
    this.#settleTimer = setTimeout(this.#onSettled, 160);
  };

  #takeControl = () => {
    this.#commandedLeft = null;
    this.#mode = "user";
  };

  #onWheel = (event: WheelEvent) => {
    this.#takeControl();
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && event.cancelable) {
      event.preventDefault();
    }
  };
}
