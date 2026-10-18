import { computed, createApp, h, nextTick, onMounted, ref, shallowRef } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";
import type { AppGallery } from "@ogdakke/fluidbox";
import {
  artSrc,
  formatCount,
  frameworkCollections,
  indexedArt,
  windowSize,
  windowStart,
} from "../art";
import { originsWithin } from "./origins";

const collections = frameworkCollections("vue");

/** Wire the rendered `<app-gallery>` inside `panel` to resolve origins from its cards. */
function useGalleryElement() {
  const panel = shallowRef<HTMLElement | null>(null);
  const gallery = () => panel.value?.querySelector<AppGallery>("app-gallery") ?? null;
  onMounted(() => {
    const node = gallery();
    if (node) node.origins = originsWithin(gallery);
  });
  return { panel, gallery };
}

export function mount(root: HTMLElement): void {
  createApp({
    setup() {
      const current = ref(0);
      const { panel, gallery } = useGalleryElement();
      return () => {
        const collection = collections[current.value]!;
        return h("article", { class: "framework-panel", ref: panel }, [
          h("header", { class: "framework-panel__head" }, [
            h("h3", "Vue"),
            h(
              "button",
              {
                type: "button",
                class: "fb-button fb-button--small",
                onClick: () => (current.value = 1 - current.value),
              },
              [
                "Switch source ",
                h("span", { "aria-hidden": "true" }, `→ ${collections[1 - current.value]!.label}`),
              ],
            ),
          ]),
          h(
            FluidboxGallery,
            { source: collection.source, class: "thumb-row", "aria-label": "Vue gallery" },
            () => [
              ...collection.items.map((item, index) =>
                h(
                  "button",
                  {
                    key: item.id,
                    type: "button",
                    class: "fb-thumb",
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

export function mountIndexed(root: HTMLElement): void {
  createApp({
    setup() {
      const { source, sceneAt, count } = indexedArt(100_000);
      const start = ref(0);
      const requested = ref("50000");
      const { panel, gallery } = useGalleryElement();
      const indices = computed(() =>
        Array.from(
          { length: Math.min(windowSize, count - start.value) },
          (_, offset) => start.value + offset,
        ),
      );
      async function submit(event: Event) {
        event.preventDefault();
        const index = Math.max(0, Math.min(count - 1, Number(requested.value) - 1));
        start.value = windowStart(index, count);
        // Open after Vue patches the new window so the selected card is the origin.
        await nextTick();
        void gallery()?.open({ index });
      }
      return () =>
        h("div", { ref: panel }, [
          h("form", { class: "jump", onSubmit: submit }, [
            h("label", { class: "fb-label", for: "vue-jump" }, "Open item"),
            h("input", {
              id: "vue-jump",
              class: "fb-input",
              type: "number",
              min: 1,
              max: count,
              value: requested.value,
              onInput: (event: Event) =>
                (requested.value = (event.target as HTMLInputElement).value),
            }),
            h("button", { type: "submit", class: "fb-button fb-button--primary" }, "Open"),
            h(
              "output",
              { class: "jump__window" },
              `Showing ${formatCount(start.value + 1)}–${formatCount(start.value + indices.value.length)} of ${formatCount(count)}`,
            ),
          ]),
          h(
            FluidboxGallery,
            { source, class: "virtual-grid", "aria-label": "Vue indexed gallery" },
            () => [
              ...indices.value.map((index) =>
                h(
                  "button",
                  {
                    key: index,
                    type: "button",
                    class: "virtual-card",
                    "data-origin-id": String(index),
                    "aria-label": `Open gallery item ${index + 1}`,
                    onClick: () => void gallery()?.open({ index }),
                  },
                  [
                    h("img", { src: artSrc(sceneAt(index)), alt: "", "data-lightbox-origin": "" }),
                    h("span", `#${formatCount(index + 1)}`),
                  ],
                ),
              ),
              h("app-filmstrip"),
            ],
          ),
        ]);
    },
  }).mount(root);
}
