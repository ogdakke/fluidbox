<!-- #region example -->
<script setup lang="ts">
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { label, product, strip } from "../shared";
</script>

<template>
  <!-- The photo flies from the element marked data-fluidbox-origin, not the whole card. -->
  <Fluidbox.Root :items="[product]">
    <Fluidbox.Trigger :item="product" class="pattern-card" data-test="product">
      <span data-fluidbox-origin>
        <img :src="product.src" :alt="label(product)" />
      </span>
      <span><strong>Coral runner</strong><br />€120</span>
    </Fluidbox.Trigger>
  </Fluidbox.Root>

  <!-- Moving through the viewer scrolls each trigger into view, so the close lands on it. -->
  <Fluidbox.Root :items="strip">
    <div class="pattern-scroller" data-test="scroller">
      <Fluidbox.Trigger
        v-for="photo in strip"
        :key="photo.id"
        :item="photo"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="label(photo)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
