import type { FluidboxLabels } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { createApp, defineComponent, h, shallowRef } from "vue";
import { album, countText, coverAlt, customViewerText, type MountLive } from "./shared";

export const mount: MountLive = (root) => {
  const labels = shallowRef<Partial<FluidboxLabels> | undefined>();
  const viewer = shallowRef(false);
  const Live = defineComponent({
    setup: () => () =>
      h(
        Fluidbox.Root,
        { items: album, labels: labels.value },
        {
          default: () => [
            h(
              Fluidbox.Trigger,
              { item: album[0]!, class: "pattern-thumb pattern-album", "data-test": "trigger" },
              {
                default: () => [
                  h("img", { src: album[0]!.src, alt: coverAlt }),
                  h(
                    Fluidbox.ThumbnailOverlay,
                    { travel: true, class: "pattern-overlay", "data-test": "count" },
                    {
                      default: () => [
                        h(Fluidbox.FrameLayer, { class: "live-layer", "data-test": "layer" }),
                        countText,
                      ],
                    },
                  ),
                ],
              },
            ),
            viewer.value
              ? h(Fluidbox.Viewer, null, {
                  default: () =>
                    h(
                      "p",
                      { class: "live-viewer", "data-test": "custom-viewer" },
                      customViewerText,
                    ),
                })
              : null,
          ],
        },
      ),
  });
  createApp(Live).mount(root);
  return {
    setLabels: (next) => (labels.value = next),
    setViewer: (on) => (viewer.value = on),
  };
};
