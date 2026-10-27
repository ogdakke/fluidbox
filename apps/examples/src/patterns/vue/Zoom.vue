<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

// Your own icons: the package ships none. The buttons take their names from the labels.
const icons = {
  zoomIn: "M12 5v14M5 12h14",
  zoomOut: "M5 12h14",
  zoomReset: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
};
</script>

<template>
  <!-- Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. -->
  <Fluidbox.Root v-slot="fluidbox" :items="zoomPhotos" :zoom="{ step: 3, max: 6 }">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="photo in zoomPhotos"
        :key="photo.id"
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(photo)" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
    <Fluidbox.Viewer>
      <!-- Previous, Next and Close, then Zoom in, Zoom out and Fit with your icons. -->
      <Fluidbox.Toolbar />
      <Fluidbox.ZoomControls>
        <Fluidbox.ZoomIn>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path :d="icons.zoomIn" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </Fluidbox.ZoomIn>
        <Fluidbox.ZoomOut>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path :d="icons.zoomOut" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </Fluidbox.ZoomOut>
        <Fluidbox.ZoomReset>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path :d="icons.zoomReset" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </Fluidbox.ZoomReset>
      </Fluidbox.ZoomControls>
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
        :value="photo.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="photo.src" :alt="itemLabel(photo)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
