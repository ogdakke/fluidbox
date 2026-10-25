<!-- #region example -->
<script setup lang="ts">
import { ref } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import {
  Fluidbox,
  type FluidboxValue,
  type FluidboxValueChangeDetails,
} from "@ogdakke/fluidbox/vue";
import { photos } from "../shared";

const locked = ref(false);
const log = ref<string[]>([]);
const record = (type: string) => {
  log.value = [...log.value, type].slice(-20);
};

// Called before every open, move and close; canceling a move keeps the viewer still.
function onValueChange(_: FluidboxValue, details: FluidboxValueChangeDetails) {
  if (locked.value && details.action === "move") details.cancel();
  record("valuechange");
}
</script>

<template>
  <Fluidbox.Root
    v-slot="{ status, index, open }"
    :items="photos"
    @update:model-value="onValueChange"
    @value-change-complete="record('valuechangecomplete')"
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
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <ol class="pattern-log" data-test="log">
      <li v-for="(type, entry) in log" :key="entry">{{ type }}</li>
    </ol>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
