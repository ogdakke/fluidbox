<!-- #region example -->
<script setup lang="ts">
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { album, label } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="album">
    <!-- The first item opens; every album item closes back onto this trigger. -->
    <Fluidbox.Trigger
      v-slot="{ item }"
      :items="album"
      class="pattern-thumb pattern-album"
      data-test="trigger"
    >
      <!-- Shows the item the viewer last showed. -->
      <img :src="item?.src" :alt="item ? label(item) : ''" data-test="preview" />
      <Fluidbox.ThumbnailOverlay travel class="pattern-overlay" data-test="count">
        +{{ album.length - 1 }}
      </Fluidbox.ThumbnailOverlay>
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
