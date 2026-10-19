import type { FluidboxLabels } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { Show, createSignal, type Component, type JSX } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { album, countText, coverAlt, customViewerText, type MountLive } from "./shared";

/** An element with attributes and children, built without JSX. */
function element(tag: string, attributes: Record<string, string>, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

export const mount: MountLive = (root) => {
  const [labels, setLabels] = createSignal<Partial<FluidboxLabels> | undefined>();
  const [viewer, setViewer] = createSignal(false);
  render(
    () =>
      createComponent(Fluidbox.Root, {
        items: album,
        get labels() {
          return labels();
        },
        get children() {
          return [
            createComponent(Fluidbox.Trigger, {
              item: album[0]!,
              class: "pattern-thumb pattern-album",
              "data-test": "trigger",
              get children() {
                return [
                  element("img", { src: album[0]!.src, alt: coverAlt }),
                  createComponent(Fluidbox.ThumbnailOverlay, {
                    travel: true,
                    class: "pattern-overlay",
                    "data-test": "count",
                    get children() {
                      return [
                        createComponent(Fluidbox.FrameLayer, {
                          class: "live-layer",
                          "data-test": "layer",
                        }),
                        countText,
                      ];
                    },
                  }),
                ];
              },
            } as never),
            createComponent(Show as Component<{ when: boolean; children: JSX.Element }>, {
              get when() {
                return viewer();
              },
              get children() {
                return createComponent(Fluidbox.Viewer, {
                  get children() {
                    return element(
                      "p",
                      { class: "live-viewer", "data-test": "custom-viewer" },
                      customViewerText,
                    );
                  },
                });
              },
            }),
          ];
        },
      }),
    root,
  );
  return { setLabels: (next) => setLabels(() => next), setViewer };
};
