<!-- #region example -->
<script setup lang="ts">
import { useTemplateRef, watchEffect } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { productPhoto, thumbnailSrc } from "../shared";

// Magnifies the photo inside its own box under a resting mouse.
const image = useTemplateRef<HTMLImageElement>("image");
watchEffect((onCleanup) => {
  if (image.value) onCleanup(hoverZoom(image.value, productPhoto));
});
</script>

<template>
  <Fluidbox.Root :items="[productPhoto]">
    <Fluidbox.Trigger :item="productPhoto" class="pattern-product" data-test="product">
      <img
        ref="image"
        :src="thumbnailSrc(productPhoto)"
        :alt="itemLabel(productPhoto)"
        width="640"
        height="640"
      />
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
