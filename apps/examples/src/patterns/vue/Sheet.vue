<!-- #region example -->
<script setup lang="ts">
import { ref } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/sheet.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

// The snap the sheet rests at: 0 below the photo, then one per snap point.
const snap = ref(0);
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
    <!-- Snap 0 rests below the photo; snaps 1 and 2 raise it to 40% and 90% of the screen. -->
    <Fluidbox.Sheet
      v-slot="{ item }"
      :snap-points="['40%', '90%']"
      class="pattern-sheet"
      @snap-change="snap = $event.snap"
    >
      <h3 data-test="sheet-title">{{ itemLabel(item) }}</h3>
      <p>
        Snap <output data-test="stop">{{ snap }}</output>
      </p>
      <Fluidbox.SheetSnap :to="2" data-test="expand">Expand</Fluidbox.SheetSnap>
      <input placeholder="Add a note" aria-label="Note" data-test="field" />
    </Fluidbox.Sheet>
    <Fluidbox.Viewer>
      <Fluidbox.SheetSnap :to="1" class="pattern-sheet-toggle" data-test="peek">
        Details
      </Fluidbox.SheetSnap>
      <Fluidbox.Toolbar />
    </Fluidbox.Viewer>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
