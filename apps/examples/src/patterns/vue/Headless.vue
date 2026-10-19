<!-- #region example -->
<script setup lang="ts">
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { label, photos } from "../shared";
</script>

<template>
  <Fluidbox.Root v-slot="fluidbox" :items="photos">
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
    <!-- Your own controls and caption, in place of the default ones. -->
    <Fluidbox.Viewer>
      <div class="pattern-caption">
        <button
          type="button"
          data-test="prev"
          :disabled="!fluidbox.hasPrevious"
          @click="fluidbox.previous()"
        >
          Previous
        </button>
        <span v-if="fluidbox.item && fluidbox.index !== null">
          <strong data-test="title">{{ label(fluidbox.item) }}</strong>
          <small data-test="counter">{{ fluidbox.index + 1 }} / {{ fluidbox.count }}</small>
        </span>
        <button
          type="button"
          data-test="next"
          :disabled="!fluidbox.hasNext"
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
