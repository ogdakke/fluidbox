/** The model add-on's part: `<Model :load />` in a slide draws a `<model-viewer>`. */
import { computed, defineComponent, h, type PropType } from "vue";
import { createModelSlide, type FluidboxModelSlideOptions } from "@ogdakke/fluidbox/model";
import { Fluidbox } from "./index";

export interface FluidboxModelProps extends FluidboxModelSlideOptions {}

/** Draw the slide's model item. Pass a stable `load`: a new one draws the model afresh. */
export const Model = defineComponent({
  name: "FluidboxModel",
  props: {
    load: Function as PropType<FluidboxModelSlideOptions["load"]>,
  },
  setup(props) {
    const render = computed(() => createModelSlide({ load: props.load }));
    return () => h(Fluidbox.Media, { render: render.value });
  },
});
