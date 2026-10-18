import type { Page } from "@playwright/test";

export interface MotionHold {
  /**
   * Wait until a transition has been created and is painting, then pause it
   * and return the time it ends.
   */
  ready(): Promise<number>;
  /**
   * Pause every animation that exists now, CSS transitions included. Call it
   * in the task that changes state: a CSS transition starts with the style
   * change, and one stalled frame can play it to the end.
   */
  freeze(): void;
  /** Put every held animation, and any CSS animation, at one time. */
  seek(time: number): void;
  /** Let everything play on at its normal rate. */
  release(): void;
}

declare global {
  interface Window {
    __motion: MotionHold;
  }
}

/**
 * Hold every animation as it is created. A transition starts a frame or more
 * after the input that causes it, and a loaded browser can draw as few as one
 * frame of it, so waiting a fixed number of frames before pausing can find it
 * finished. A held transition can be measured at any time.
 */
export async function holdMotion(page: Page) {
  await page.evaluate(() => {
    const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!
      .value as Element["animate"];
    const held: Animation[] = [];
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const all = () => [...new Set([...held, ...document.getAnimations()])];
    Element.prototype.animate = function (this: Element, ...args) {
      const animation = animate.apply(this, args);
      animation.playbackRate = 1e-6;
      held.push(animation);
      return animation;
    };
    window.__motion = {
      freeze() {
        for (const animation of all()) animation.pause();
      },
      async ready() {
        for (let frames = 0; frames < 240; frames += 1) {
          if (held.length && !document.querySelector("[data-lightbox-prepared]")) break;
          await frame();
        }
        // Parts of a transition can start a frame after its first animation.
        await frame();
        await frame();
        Element.prototype.animate = animate;
        for (const animation of all()) animation.pause();
        return Math.max(
          ...held.map((animation) => Number(animation.effect!.getComputedTiming().endTime)),
        );
      },
      seek(time) {
        for (const animation of all()) {
          animation.pause();
          animation.currentTime = time;
        }
      },
      release() {
        Element.prototype.animate = animate;
        for (const animation of all()) {
          animation.playbackRate = 1;
          animation.play();
        }
      },
    };
  });
}
