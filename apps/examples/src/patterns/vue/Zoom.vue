<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";
</script>

<template>
  <!-- Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. -->
  <Fluidbox.Root v-slot="fluidbox" :items="zoomPhotos" :zoom="{ step: 3, max: 6 }">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in zoomPhotos"
        :key="photo.id"
        :item="photo"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(photo)" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <Fluidbox.Viewer>
      <!-- Previous, Next and Close, then Zoom in, Zoom out and Fit. -->
      <Fluidbox.Controls zoom />
      <!-- The zoom the image on show rests at, from the viewer's state. -->
      <output class="pattern-zoom-level" data-test="zoom-level">
        {{ fluidbox.zoom ? `${Math.round(fluidbox.zoom.scale * 100)}%` : "" }}
      </output>
    </Fluidbox.Viewer>
  </Fluidbox.Root>

  <Fluidbox.Root :items="photos" :zoom="false">
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
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
