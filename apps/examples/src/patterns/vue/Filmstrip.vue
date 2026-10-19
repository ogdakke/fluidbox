<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="photos">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
        :key="photo.id"
        :item="photo"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <Fluidbox.Filmstrip />
  </Fluidbox.Root>

  <Fluidbox.Root :items="photos">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
        :key="photo.id"
        :item="photo"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <!-- Your own thumbnails. The selected button has data-fluidbox-selected. -->
    <Fluidbox.Filmstrip v-slot="{ index }">
      <span class="pattern-filmstrip-thumb" data-test="thumb">{{ index + 1 }}</span>
    </Fluidbox.Filmstrip>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
