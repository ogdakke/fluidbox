<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { album } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="album">
    <!-- The first item opens; every album item closes back onto this trigger. -->
    <Fluidbox.Trigger
      v-slot="{ item }"
      :value="album"
      class="pattern-thumb pattern-album"
      data-test="trigger"
    >
      <!-- Shows the item the viewer last showed. Keep the img mounted. -->
      <img :src="item?.src" :alt="item ? itemLabel(item) : ''" data-test="preview" />
      <Fluidbox.Overlay flight="live" class="pattern-overlay" data-test="count">
        +{{ album.length - 1 }}
      </Fluidbox.Overlay>
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
