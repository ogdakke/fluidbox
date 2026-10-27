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
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <!-- Without a Viewer, the viewer has these same three buttons. -->
    <Fluidbox.Viewer>
      <Fluidbox.Previous />
      <Fluidbox.Next />
      <Fluidbox.Close />
    </Fluidbox.Viewer>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
