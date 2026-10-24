<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/sheet.css";
import { ref } from "vue";
import { photos } from "../shared";

// The stop the sheet rests at: 0 at rest, then one per snap point.
const stop = ref(0);
</script>

<template>
  <Fluidbox.Root :items="photos" @sheetchange="stop = $event.snap">
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
    <Fluidbox.Viewer>
      <Fluidbox.Controls />
      <!-- At stop 0 the sheet is out of sight; this raises it. -->
      <Fluidbox.SheetStop :stop="1" class="pattern-sheet-toggle" data-test="peek">
        Details
      </Fluidbox.SheetStop>
    </Fluidbox.Viewer>
    <!-- The sheet's content, for the active item. Its attributes go on the sheet. -->
    <Fluidbox.Sheet v-slot="{ item }" :snap-points="['40%', '90%']" class="pattern-sheet">
      <h3 data-test="sheet-title">{{ itemLabel(item) }}</h3>
      <p>
        Stop <output data-test="stop">{{ stop }}</output>
      </p>
      <Fluidbox.SheetStop :stop="2" data-test="expand">Expand</Fluidbox.SheetStop>
      <input data-test="field" placeholder="Add a note" aria-label="Note" />
    </Fluidbox.Sheet>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
