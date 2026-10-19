<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { album } from "../shared";
</script>

<template>
  <Fluidbox.Root :items="album">
    <!-- The cover opens the first photo; every album item closes back onto it. -->
    <Fluidbox.Trigger
      v-slot="{ item }"
      :item="album[0]"
      :returns="album"
      class="pattern-thumb pattern-album"
      data-test="trigger"
    >
      <!-- Shows the item the viewer last showed. -->
      <img :src="item?.src" :alt="item ? itemLabel(item) : ''" data-test="preview" />
      <Fluidbox.ThumbnailOverlay travel class="pattern-overlay" data-test="count">
        +{{ album.length - 1 }}
      </Fluidbox.ThumbnailOverlay>
    </Fluidbox.Trigger>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
