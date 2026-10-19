<!-- #region example -->
<script setup lang="ts">
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/sheet.css";
import { label, photos } from "../shared";
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
        <img :src="photo.src" :alt="label(photo)" />
      </Fluidbox.Trigger>
    </div>
    <Fluidbox.Viewer>
      <Fluidbox.Controls />
      <!-- At stop 0 the sheet is out of sight; this raises it. -->
      <Fluidbox.SheetStop :stop="1" class="pattern-sheet-toggle" data-test="peek">
        Details
      </Fluidbox.SheetStop>
    </Fluidbox.Viewer>
    <!-- The sheet's content, for the active item. -->
    <Fluidbox.Sheet v-slot="{ item, stop, set }" :snap-points="['40%', '90%']">
      <div class="pattern-sheet">
        <h3 data-test="sheet-title">{{ label(item) }}</h3>
        <p>
          Stop <output data-test="stop">{{ stop }}</output>
        </p>
        <button type="button" data-test="expand" @click="set(2)">Expand</button>
        <input data-test="field" placeholder="Add a note" aria-label="Note" />
      </div>
    </Fluidbox.Sheet>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
