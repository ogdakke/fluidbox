<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { Embed } from "@ogdakke/fluidbox/vue/embed";
import { Model } from "@ogdakke/fluidbox/vue/model";
import { Spin } from "@ogdakke/fluidbox/vue/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

// <model-viewer> loads when a model first comes on show.
const loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);
</script>

<template>
  <Fluidbox.Root :items="productMedia">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="item in productMedia"
        :key="item.id"
        :value="item.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(item)" :alt="itemLabel(item)" />
      </Fluidbox.Trigger>
    </div>
    <!-- The photo is built in; the other items' types name these slides. -->
    <Fluidbox.Slides>
      <template #embed><Embed /></template>
      <template #spin><Spin /></template>
      <template #model><Model :load="loadModelViewer" /></template>
    </Fluidbox.Slides>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
