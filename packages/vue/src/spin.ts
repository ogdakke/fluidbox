/** The spin add-on's part: `<Spin />` in a slide draws a 360° spin. */
import { defineComponent, h, shallowRef, watch, type PropType } from "vue";
import { createSpinSlide, type FluidboxSpinSlideOptions } from "@ogdakke/fluidbox/spin";
import { Fluidbox } from "./index";

export interface FluidboxSpinProps extends FluidboxSpinSlideOptions {}

/** Draw the slide's spin item. */
export const Spin = defineComponent({
  name: "FluidboxSpin",
  props: {
    label: Function as PropType<FluidboxSpinSlideOptions["label"]>,
    keep: Number,
    turns: Number,
  },
  setup(props) {
    // The newest label names the frames, without drawing the spin again.
    const make = () =>
      createSpinSlide({
        keep: props.keep,
        turns: props.turns,
        label: props.label ? (frame, count) => props.label!(frame, count) : undefined,
      });
    const render = shallowRef(make());
    watch([() => props.keep, () => props.turns, () => !!props.label], () => {
      render.value = make();
    });
    return () => h(Fluidbox.Media, { render: render.value });
  },
});
