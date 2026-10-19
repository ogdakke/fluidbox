<!-- #region example -->
<script setup lang="ts">
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { label, photos } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="photos" :zoom="{ step: 3, max: 6 }">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
        :key="photo.id"
        :item="photo"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="label(photo)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>

  <Fluidbox.Root :items="photos" :zoom="false">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in photos"
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
