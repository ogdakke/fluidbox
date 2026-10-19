<!-- #region example -->
<script setup lang="ts">
import { defineComponent, h, inject, provide, type InjectionKey } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox, type FluidboxVueRenderer } from "@ogdakke/fluidbox/vue";
import { media, theme, thumbnailSrc } from "../shared";

// Provided here, injected by any component below, such as the note renderer.
const ThemeKey: InjectionKey<string> = Symbol("theme");
provide(ThemeKey, theme);

const Note = defineComponent(() => {
  const current = inject(ThemeKey);
  return () => h("article", { class: "pattern-note" }, `Theme: ${current}`);
});

// Draws items of type "custom" whose render is "note".
const renderers: Record<string, FluidboxVueRenderer> = { note: () => h(Note) };
</script>

<template>
  <Fluidbox.Root :items="media" :renderers="renderers">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="item in media"
        :key="item.id"
        :item="item"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(item)" :alt="itemLabel(item)" />
      </Fluidbox.Trigger>
    </div>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
