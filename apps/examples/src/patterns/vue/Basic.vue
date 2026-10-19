<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "../shared";
</script>

<template>
  <!-- Without a Viewer, the viewer has the default Previous, Next and Close. -->
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
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
