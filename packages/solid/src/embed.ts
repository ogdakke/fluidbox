/** The embed add-on's part: `<Embed />` in a slide draws a video that loads its player on Play. */
import { createComponent, createMemo, type JSX } from "solid-js";
import { insert } from "solid-js/web";
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
  /** The Play button's content. The label then becomes its `aria-label`. */
  readonly play?: JSX.Element;
}

/** Draw the slide's embed item: its poster and a Play button, then the player. */
export function Embed(props: FluidboxEmbedProps): JSX.Element {
  const providersKey = createMemo(() =>
    props.providers?.map((provider) => provider.name).join(" "),
  );
  const labelled = createMemo(() => !!props.label);
  // Asked of the props, not read, so the content is made only for a slide.
  const playable = createMemo(() => "play" in props);
  const render = createMemo(() => {
    providersKey();
    return createEmbedSlide({
      providers: props.providers,
      // The newest label names the button, without drawing the slide again.
      label: labelled() ? (item) => props.label!(item) : undefined,
      // The slide asks for the content as it draws, under the Media part's
      // render, which disposes it with the drawing.
      play: playable()
        ? () => {
            const element = document.createElement("span");
            element.dataset.fluidboxMount = "";
            insert(element, () => props.play);
            return element;
          }
        : undefined,
    });
  });
  return createComponent(Fluidbox.Media, {
    get render() {
      return render();
    },
  });
}
