<!-- #region example -->
<script setup lang="ts">
import { defineComponent, h, inject, provide, type InjectionKey } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { media, theme, thumbnailSrc } from "../shared";

// Provided here, injected by any component below, such as a slide's.
const ThemeKey: InjectionKey<string> = Symbol("theme");
provide(ThemeKey, theme);

/** Slide content renders inside the app, so it injects what the app provides. */
const Note = defineComponent(() => {
  const current = inject(ThemeKey);
  return () => h("article", { class: "pattern-note" }, `Theme: ${current}`);
});
</script>

<template>
  <Fluidbox.Root :items="media">
    <div class="pattern-grid">
      <Fluidbox.Trigger
        v-for="item in media"
        :key="item.id"
        :value="item.id"
        class="pattern-thumb"
        data-test="trigger"
      >
        <img :src="thumbnailSrc(item)" :alt="itemLabel(item)" />
      </Fluidbox.Trigger>
    </div>
    <!-- Items of type "note" render <Note /> in their media box; the rest are built in. -->
    <Fluidbox.Slides>
      <template #note>
        <Fluidbox.Media>
          <Note />
        </Fluidbox.Media>
      </template>
    </Fluidbox.Slides>
  </Fluidbox.Root>
</template>
<!-- #endregion example -->
