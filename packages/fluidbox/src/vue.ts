import { defineComponent, h, onMounted, shallowRef, watch } from "vue";
import type { PropType } from "vue";
import { bindGallerySource } from "./binding";
import { registerFluidboxElements } from "./register";
import type { FluidboxGalleryElement } from "./gallery";
import type { FluidboxItem, FluidboxSource } from "./public-api";

/** Register custom elements on mount for standalone Vue templates. */
export function useFluidboxElements(): void {
  onMounted(() => {
    void registerFluidboxElements();
  });
}

/** Vue component for indexed galleries. Slots become children of `<fluidbox-gallery>`. */
export const FluidboxGallery = defineComponent({
  name: "FluidboxGallery",
  inheritAttrs: false,
  props: {
    source: { type: Object as PropType<FluidboxSource<FluidboxItem> | null>, default: null },
  },
  setup(props, { attrs, slots }) {
    const element = shallowRef<FluidboxGalleryElement | null>(null);

    watch(
      [element, () => props.source],
      ([node, source], _previous, onCleanup) => {
        if (node) onCleanup(bindGallerySource(node, source));
      },
      { immediate: true, flush: "post" },
    );

    return () => h("fluidbox-gallery", { ...attrs, ref: element }, slots.default?.());
  },
});
