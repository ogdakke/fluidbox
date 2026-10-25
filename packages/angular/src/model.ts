/** The model add-on's part: `<fluidbox-model [load] />` in a slide draws a `<model-viewer>`. */
import { Component, computed, input } from "@angular/core";
import { createModelSlide, type FluidboxModelSlideOptions } from "@ogdakke/fluidbox/model";
import { FluidboxMediaDirective } from "./slide.js";

/**
 * Draw the slide's model item, in a fresh `<model-viewer>` each time it shows.
 * Pass a stable `load`: a new one draws the model afresh.
 *
 * ```html
 * <ng-template fluidboxSlide="model"><fluidbox-model [load]="loadModelViewer" /></ng-template>
 * ```
 */
@Component({
  selector: "fluidbox-model",
  standalone: true,
  imports: [FluidboxMediaDirective],
  host: { hidden: "" },
  template: `<ng-template fluidboxMedia [render]="render()" />`,
})
export class FluidboxModel {
  /** Loads `<model-viewer>`, when a model first opens or comes on show. */
  readonly load = input<FluidboxModelSlideOptions["load"]>();
  protected readonly render = computed(() => createModelSlide({ load: this.load() }));
}
