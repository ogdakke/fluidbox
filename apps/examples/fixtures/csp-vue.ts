import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { defineComponent, h } from "vue";
import { cspItems } from "./csp-items";

const photos = cspItems.slice(0, 2);

/** A Vue Root open through v-model: rendered on the server, then hydrated. */
export const CspVue = defineComponent(
  () => () =>
    h(Fluidbox.Root, { items: photos, modelValue: photos[1]!.id! }, () =>
      photos.map((photo, index) =>
        h(Fluidbox.Trigger, { key: photo.id, value: index }, () =>
          h("img", { src: photo.src, alt: photo.alt, width: 160 }),
        ),
      ),
    ),
);
