---
title: Vue
section: Frameworks
order: 3
---

# Vue

`<FluidboxGallery>` renders an `<fluidbox-gallery>`, forwards attributes and the default slot, and rebinds whenever its `source` prop changes.

```vue
<script setup lang="ts">
import { shallowRef } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const source = shallowRef(photosSource);
// The component ref's root element is the rendered <fluidbox-gallery>.
const gallery = shallowRef<{ $el: FluidboxGalleryElement }>();
</script>

<template>
  <FluidboxGallery ref="gallery" :source="source" aria-label="Photos">
    <button
      v-for="(photo, index) in photos"
      :key="photo.id"
      type="button"
      :data-origin-id="photo.id"
      @click="gallery?.$el.open({ index })"
    >
      <img :src="photo.thumbnail?.src" alt="" />
    </button>
    <fluidbox-filmstrip />
  </FluidboxGallery>
</template>
```

Assign an [origin adapter](./sources-and-origins.md#origins) to the rendered element's `origins` property after mount so flights start from your thumbnails. `useFluidboxElements()` registers elements for standalone `<fluidbox-item>` markup from a component's setup function.
