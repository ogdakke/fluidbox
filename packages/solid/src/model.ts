/** The model add-on's part: `<Model load />` in a slide draws a `<model-viewer>`. */
import { createComponent, createMemo, type JSX } from "solid-js";
import { createModelSlide, type FluidboxModelSlideOptions } from "@ogdakke/fluidbox/model";
import { Fluidbox } from "./index";

export interface FluidboxModelProps extends FluidboxModelSlideOptions {}

/** Draw the slide's model item. Pass a stable `load`: a new one draws the model afresh. */
export function Model(props: FluidboxModelProps): JSX.Element {
  const render = createMemo(() => createModelSlide({ load: props.load }));
  return createComponent(Fluidbox.Media, {
    get render() {
      return render();
    },
  });
}
