/** The spin add-on's part: `<fluidbox-spin />` in a slide draws a 360° spin. */
import { Component, computed, input } from "@angular/core";
import { createSpinSlide, type FluidboxSpinSlideOptions } from "@ogdakke/fluidbox/spin";
import { FluidboxMediaDirective } from "./slide.js";

/**
 * Draw the slide's spin item: a slider that turns a frame per drag step or
 * arrow key.
 *
 * ```html
 * <ng-template fluidboxSlide="spin"><fluidbox-spin /></ng-template>
 * ```
 */
@Component({
  selector: "fluidbox-spin",
  standalone: true,
  imports: [FluidboxMediaDirective],
  host: { hidden: "" },
  template: `<ng-template fluidboxMedia [render]="render()" />`,
})
export class FluidboxSpin {
  /** Names each frame. @default (frame, count) => `Frame ${frame} of ${count}` */
  readonly label = input<FluidboxSpinSlideOptions["label"]>();
  /** Frames held decoded. @default 48, at least 2 */
  readonly keep = input<number>();
  /** Turns per full-width drag. @default 1 */
  readonly turns = input<number>();
  readonly #labelled = computed(() => !!this.label());
  protected readonly render = computed(() => {
    // The newest label names the frames, without drawing the spin again.
    const labelled = this.#labelled();
    return createSpinSlide({
      keep: this.keep(),
      turns: this.turns(),
      label: labelled ? (frame, count) => this.label()!(frame, count) : undefined,
    });
  });
}
