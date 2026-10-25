<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { product, strip } from "../shared";

const products = [product];
</script>

<template>
  <!-- Only the photo flies: the card marks it with data-fluidbox-origin. -->
  <Fluidbox.Root :items="products">
    <Fluidbox.Trigger :value="product.id" as-child>
      <button type="button" class="pattern-card" data-test="product">
        <span data-fluidbox-origin>
          <img :src="product.src" :alt="itemLabel(product)" />
        </span>
        <span><strong>Coral runner</strong><br />€120</span>
      </button>
    </Fluidbox.Trigger>
  </Fluidbox.Root>

  <!-- Moving through the viewer scrolls each trigger into view, so the close lands on it. -->
  <Fluidbox.Root :items="strip">
    <div class="pattern-scroller" data-test="scroller">
      <Fluidbox.Trigger
        v-for="photo in strip"
        :key="photo.id"
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
