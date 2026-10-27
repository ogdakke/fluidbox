<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="photos">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
        :key="photo.id"
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <!-- Being there turns the thumbnails on. -->
    <Fluidbox.Thumbnails />
  </Fluidbox.Root>

  <Fluidbox.Root :items="photos">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
        :key="photo.id"
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <!-- Your own thumbnails. The selected button has data-active. -->
    <Fluidbox.Thumbnails v-slot="{ index }">
      <span class="pattern-thumbnails-thumb" data-test="thumb">{{ index + 1 }}</span>
    </Fluidbox.Thumbnails>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
