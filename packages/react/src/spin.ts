/** The spin add-on's part: `<Spin />` in a slide draws a 360° spin. */
import { createElement, useMemo, useRef, type ReactElement } from "react";
import { createSpinSlide, type FluidboxSpinSlideOptions } from "@ogdakke/fluidbox/spin";
import { Fluidbox } from "./index";

export interface FluidboxSpinProps extends FluidboxSpinSlideOptions {}

/** Draw the slide's spin item. */
export function Spin({ label, keep, turns }: FluidboxSpinProps): ReactElement {
  // The newest label names the frames, without drawing the spin again.
  const latest = useRef(label);
  latest.current = label;
  const labelled = !!label;
  const render = useMemo(
    () =>
      createSpinSlide({
        keep,
        turns,
        label: labelled ? (frame, count) => latest.current!(frame, count) : undefined,
      }),
    [keep, turns, labelled],
  );
  return createElement(Fluidbox.Media, { render });
}
