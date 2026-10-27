/** The model add-on's part: `<Model load />` in a slide draws a `<model-viewer>`. */
import { createElement, useMemo, type ReactElement } from "react";
import { createModelSlide, type FluidboxModelSlideOptions } from "@ogdakke/fluidbox/model";
import { Fluidbox } from "./index";

export interface FluidboxModelProps extends FluidboxModelSlideOptions {}

/** Draw the slide's model item. Pass a stable `load`: a new one draws the model afresh. */
export function Model({ load }: FluidboxModelProps): ReactElement {
  const render = useMemo(() => createModelSlide({ load }), [load]);
  return createElement(Fluidbox.Media, { render });
}
