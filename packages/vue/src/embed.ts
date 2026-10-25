/** The embed add-on's part: `<Embed />` in a slide draws a video that loads its player on Play. */
import { Teleport, defineComponent, h, shallowRef, watch, type PropType } from "vue";
import {
  createEmbedSlide,
  type FluidboxEmbedItem,
  type FluidboxEmbedProvider,
} from "@ogdakke/fluidbox/embed";
import { Fluidbox } from "./index";

export interface FluidboxEmbedProps {
  /** The providers the slide plays. Compared by name. @default [youtube, vimeo] */
  readonly providers?: readonly FluidboxEmbedProvider[];
  /** The Play button's name, and its text when it has no content. */
  readonly label?: (item: FluidboxEmbedItem) => string;
}

/**
 * Draw the slide's embed item: its poster and a Play button, then the player.
 * The default slot is the Play button's content; the label then becomes its `aria-label`.
 */
export const Embed = defineComponent({
  name: "FluidboxEmbed",
  props: {
    providers: Array as PropType<readonly FluidboxEmbedProvider[]>,
    label: Function as PropType<(item: FluidboxEmbedItem) => string>,
  },
  setup(props, { slots }) {
    // The Play button holds an element of ours, and the slot renders into it.
    const host = shallowRef<HTMLElement | null>(null);
    // Whether the Play button holds the slot, checked on each render.
    let playable = !!slots.default;
    const make = () =>
      createEmbedSlide({
        providers: props.providers,
        // The newest label names the button, without drawing the slide again.
        label: props.label ? (item) => props.label!(item) : undefined,
        play: playable
          ? () => {
              const element = document.createElement("span");
              element.dataset.fluidboxMount = "";
              host.value = element;
              return element;
            }
          : undefined,
      });
    let render = make();
    const made = shallowRef(0);
    watch(
      [() => props.providers?.map((provider) => provider.name).join(" "), () => !!props.label],
      () => {
        render = make();
        made.value++;
      },
    );
    return () => {
      void made.value;
      if (playable !== !!slots.default) {
        playable = !playable;
        render = make();
      }
      return [
        h(Fluidbox.Media, { render }),
        host.value && slots.default ? h(Teleport, { to: host.value }, slots.default()) : null,
      ];
    };
  },
});
