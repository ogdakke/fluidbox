<!-- #region example -->
<script setup lang="ts">
import { ref } from "vue";
import { Fluidbox, type FluidboxChangeEvent } from "@ogdakke/fluidbox/vue";
import { label, photos } from "../shared";

const locked = ref(false);
const log = ref<string[]>([]);

const record = (event: Event) => {
  log.value = [...log.value, event.type].slice(-20);
};

// beforeitemchange comes before every move between items; canceling it keeps the viewer still.
function onBeforeItemChange(event: FluidboxChangeEvent) {
  if (locked.value) event.preventDefault();
  record(event);
}
</script>

<template>
  <Fluidbox.Root
    v-slot="{ status, index, open }"
    :items="photos"
    @beforetoggle="record"
    @toggle="record"
    @beforeitemchange="onBeforeItemChange"
    @itemchange="record"
    @settle="record"
  >
    <div class="pattern-toolbar">
      <button type="button" data-test="open-third" @click="open(2)">Open the third photo</button>
      <label>
        <input v-model="locked" type="checkbox" name="lock" data-test="lock" /> Lock navigation
      </label>
      <output data-test="status">{{ status }} {{ index ?? "-" }}</output>
    </div>
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
    <ol class="pattern-log" data-test="log">
      <li v-for="(type, entry) in log" :key="entry">{{ type }}</li>
    </ol>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
