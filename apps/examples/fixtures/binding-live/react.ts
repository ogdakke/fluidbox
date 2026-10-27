import type { FluidboxLabels } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { Fragment, StrictMode, createElement as h, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  album,
  countText,
  coverAlt,
  customViewerText,
  type LiveControls,
  type MountLive,
} from "./shared";

/** A `data-test` hook, which an object literal can't name as a prop type would. */
const test = (name: string) => ({ "data-test": name }) as {};

function Live({ ready }: { ready: (controls: LiveControls) => void }) {
  const [labels, setLabels] = useState<Partial<FluidboxLabels> | undefined>();
  const [viewer, setViewer] = useState(false);
  const [loop, setLoop] = useState(false);
  useLayoutEffect(() => ready({ setLabels, setViewer, setLoop }), [ready]);
  return h(
    Fluidbox.Root,
    { items: album, labels, loop },
    h(Fluidbox.Trigger, {
      value: album[0]!,
      className: "pattern-thumb pattern-album",
      ...test("trigger"),
      children: h(
        Fragment,
        null,
        h("img", { src: album[0]!.src, alt: coverAlt }),
        h(
          Fluidbox.Overlay,
          { flight: "live", className: "pattern-overlay", ...test("count") },
          h(Fluidbox.Overlay, { flight: "frame", className: "live-layer", ...test("layer") }),
          countText,
        ),
      ),
    }),
    h(Fluidbox.Thumbnails),
    viewer &&
      h(
        Fluidbox.Viewer,
        null,
        h("p", { className: "live-viewer", ...test("custom-viewer") }, customViewerText),
      ),
  );
}

export const mount: MountLive = (root) =>
  new Promise((resolve) => {
    createRoot(root).render(h(StrictMode, null, h(Live, { ready: resolve })));
  });
