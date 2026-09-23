import { defineComponent, h, onMounted, shallowRef, watch } from "vue";
import type { PropType } from "vue";
import { bindGallerySource } from "./binding";
import { registerLightboxElements } from "./register";
import type { AppGallery } from "./gallery";
import type { LightboxGallerySource } from "./source";

/** Register custom elements on mount for standalone Vue templates. */
export function useFluidboxElements(): void {
  onMounted(() => {
    void registerLightboxElements();
  });
}

/** Vue component for indexed galleries. Slots become children of `<app-gallery>`. */
export const FluidboxGallery = defineComponent({
  name: "FluidboxGallery",
  inheritAttrs: false,
  props: {
    source: { type: Object as PropType<LightboxGallerySource | null>, default: null },
  },
  setup(props, { attrs, slots }) {
    const element = shallowRef<AppGallery | null>(null);

    watch(
      [element, () => props.source],
      ([node, source], _previous, onCleanup) => {
        if (node) onCleanup(bindGallerySource(node, source));
      },
      { immediate: true, flush: "post" },
    );

    return () => h("app-gallery", { ...attrs, ref: element }, slots.default?.());
  },
});
