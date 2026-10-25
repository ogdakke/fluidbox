<!-- #region example -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): string | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return photos[photo]?.id ?? null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(id: string | null) {
  const shown = photoInUrl();
  if (id === shown) return;
  const url = new URL(location.href);
  if (id === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photos.findIndex((photo) => photo.id === id) + 1));
  if (shown === null) history.pushState({ photo: true }, "", url);
  else history.replaceState(history.state, "", url);
}

// Read the address once mounted, so the server and the browser render the same.
const photo = ref<string | null>(null);
const onPopState = () => (photo.value = photoInUrl());
onMounted(() => {
  onPopState();
  addEventListener("popstate", onPopState);
});
onBeforeUnmount(() => removeEventListener("popstate", onPopState));
</script>

<template>
  <Fluidbox.Root v-model="photo" :items="photos" @update:model-value="followInUrl">
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
