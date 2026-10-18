import { createApp, h, onMounted, ref, shallowRef } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";
import type { AppGallery } from "@ogdakke/fluidbox";
import { frameworkCollections } from "../art";
import { originsWithin } from "./origins";

const collections = frameworkCollections("vue");

export function mount(root: HTMLElement): void {
  createApp({
    setup() {
      const current = ref(0);
      const panel = shallowRef<HTMLElement | null>(null);
      const gallery = () => panel.value?.querySelector<AppGallery>("app-gallery") ?? null;
      const origins = originsWithin(gallery);
      onMounted(() => {
        const node = gallery();
        if (node) node.origins = origins;
      });
      return () => {
        const collection = collections[current.value]!;
        return h("article", { class: "framework-panel", ref: panel }, [
          h("header", { class: "framework-panel__head" }, [
            h("h3", "Vue"),
            h(
              "button",
              { type: "button", class: "chip", onClick: () => (current.value = 1 - current.value) },
              [
                "Switch source ",
                h("span", { "aria-hidden": "true" }, `→ ${collections[1 - current.value]!.label}`),
              ],
            ),
          ]),
          h(
            FluidboxGallery,
            {
              source: collection.source,
              class: "thumb-row",
              "aria-label": "Vue gallery",
            },
            () => [
              ...collection.items.map((item, index) =>
                h(
                  "button",
                  {
                    key: item.id,
                    type: "button",
                    class: "thumb",
                    "data-origin-id": item.id,
                    "aria-label": `Open ${item.media.type === "image" ? item.media.alt : item.id}`,
                    onClick: () => void gallery()?.open({ index }),
                  },
                  [h("img", { src: item.thumbnail?.src, alt: "" })],
                ),
              ),
              h("app-filmstrip"),
            ],
          ),
          h("code", { class: "framework-panel__api" }, "<FluidboxGallery :source>"),
        ]);
      };
    },
  }).mount(root);
}
