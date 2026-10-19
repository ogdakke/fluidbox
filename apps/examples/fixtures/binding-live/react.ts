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
  useLayoutEffect(() => ready({ setLabels, setViewer }), [ready]);
  return h(
    Fluidbox.Root,
    { items: album, labels },
    h(Fluidbox.Trigger, {
      item: album[0]!,
      className: "pattern-thumb pattern-album",
      ...test("trigger"),
      children: h(
        Fragment,
        null,
        h("img", { src: album[0]!.src, alt: coverAlt }),
        h(
          Fluidbox.ThumbnailOverlay,
          { travel: true, className: "pattern-overlay", ...test("count") },
          h(Fluidbox.FrameLayer, { className: "live-layer", ...test("layer") }),
          countText,
        ),
      ),
    }),
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
