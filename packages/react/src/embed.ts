/** The embed add-on's part: `<Embed />` in a slide draws a video that loads its player on Play. */
import {
  createElement,
  Fragment,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  readonly play?: ReactNode;
}

/** Draw the slide's embed item: its poster and a Play button, then the player. */
export function Embed({ providers, label, play }: FluidboxEmbedProps): ReactElement {
  const latest = useRef(label);
  latest.current = label;
  const labelled = !!label;
  const playable = play != null;
  // The Play button holds an element of ours, and the content renders into it.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const providersKey = providers?.map((provider) => provider.name).join(" ");
  const render = useMemo(
    () =>
      createEmbedSlide({
        providers,
        label: labelled ? (item) => latest.current!(item) : undefined,
        play: playable
          ? () => {
              const element = document.createElement("span");
              element.dataset.fluidboxMount = "";
              setHost(element);
              return element;
            }
          : undefined,
      }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [providersKey, labelled, playable],
  );
  return createElement(
    Fragment,
    null,
    createElement(Fluidbox.Media, { render }),
    host && playable ? createPortal(play, host) : null,
  );
}
