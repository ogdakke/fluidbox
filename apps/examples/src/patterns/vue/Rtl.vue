<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/filmstrip.css";
import { arabic, photos } from "../shared";
</script>

<template>
  <!-- The viewer takes dir and lang from the trigger's surroundings. -->
  <div dir="rtl" lang="ar">
    <Fluidbox.Root :items="photos" :labels="arabic">
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
  </div>
</template>
<!-- #endregion example -->
