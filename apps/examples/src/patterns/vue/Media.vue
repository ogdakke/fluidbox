<!-- #region example -->
<script setup lang="ts">
import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
import { itemLabel, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { renderEmbed } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer } from "@ogdakke/fluidbox/model";
import {
  Fluidbox,
  type FluidboxVueRenderContext,
  type FluidboxVueRenderer,
} from "@ogdakke/fluidbox/vue";
import { createSpinRenderer } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";
import { addonSlide } from "../../addon-slide";

/**
 * The add-ons draw into an element. A Vue renderer gets the slide's item,
 * signal and activity, so give the add-on an element of a component's own.
 */
const AddonSlide = defineComponent({
  props: {
    render: { type: Function as PropType<FluidboxSlideRenderer>, required: true },
    context: { type: Object as PropType<FluidboxVueRenderContext>, required: true },
  },
  setup(props) {
    const target = ref<HTMLElement>();
    const controller = new AbortController();
    let dispose: void | (() => void);
    onMounted(() => {
      const { context } = props;
      dispose = props.render(
        addonSlide(context, target.value!, AbortSignal.any([context.signal, controller.signal])),
      );
    });
    onBeforeUnmount(() => {
      controller.abort();
      dispose?.();
    });
    return () => h("span", { ref: target, style: { display: "contents" } });
  },
});

const addon =
  (render: FluidboxSlideRenderer): FluidboxVueRenderer =>
  (context) =>
    h(AddonSlide, { render, context });

// The items' `render` names these: "embed", "spin" and "model".
const renderers = {
  embed: addon(renderEmbed),
  spin: addon(createSpinRenderer()),
  // <model-viewer> loads when a model first comes on show.
  model: addon(createModelRenderer({ load: () => import(/* @vite-ignore */ modelViewerUrl) })),
};
</script>

<template>
  <Fluidbox.Root :items="productMedia" :renderers="renderers">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="item in productMedia"
        :key="item.id"
        :item="item"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(item)" :alt="itemLabel(item)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
