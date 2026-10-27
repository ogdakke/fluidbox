/** The spin add-on's part: `<Spin />` in a slide draws a 360° spin. */
import { createComponent, createMemo, type JSX } from "solid-js";
import { createSpinSlide, type FluidboxSpinSlideOptions } from "@ogdakke/fluidbox/spin";
import { Fluidbox } from "./index";

export interface FluidboxSpinProps extends FluidboxSpinSlideOptions {}

/** Draw the slide's spin item. */
export function Spin(props: FluidboxSpinProps): JSX.Element {
  const labelled = createMemo(() => !!props.label);
  // The newest label names the frames, without drawing the spin again.
  const render = createMemo(() =>
    createSpinSlide({
      keep: props.keep,
      turns: props.turns,
      label: labelled() ? (frame, count) => props.label!(frame, count) : undefined,
    }),
  );
  return createComponent(Fluidbox.Media, {
    get render() {
      return render();
    },
  });
}
