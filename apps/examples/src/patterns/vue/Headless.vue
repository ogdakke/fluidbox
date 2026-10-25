<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "../shared";
</script>

<template>
  <Fluidbox.Root v-slot="fluidbox" :items="photos">
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
    <!-- Your own controls and caption replace the default ones. -->
    <Fluidbox.Viewer>
      <div class="pattern-caption">
        <button
          type="button"
          :disabled="!fluidbox.hasPrevious"
          data-test="prev"
          @click="fluidbox.previous()"
        >
          Previous
        </button>
        <span>
          <strong data-test="title">{{ fluidbox.item && itemLabel(fluidbox.item) }}</strong>
          <small data-test="counter"><Fluidbox.Counter /></small>
        </span>
        <button
          type="button"
          :disabled="!fluidbox.hasNext"
          data-test="next"
          @click="fluidbox.next()"
        >
          Next
        </button>
        <button type="button" data-test="close" @click="fluidbox.close()">Close</button>
      </div>
    </Fluidbox.Viewer>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
