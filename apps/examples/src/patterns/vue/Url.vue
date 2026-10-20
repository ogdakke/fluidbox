<!-- #region example -->
<script setup lang="ts">
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import { onBeforeUnmount, ref } from "vue";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): number | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return Number.isInteger(photo) && photo >= 0 && photo < photos.length ? photo : null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(photo: number | null) {
  const shown = photoInUrl();
  if (photo === shown) return;
  const url = new URL(location.href);
  if (photo === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photo + 1));
  if (shown === null) history.pushState({ photo: true }, "", url);
  else history.replaceState(history.state, "", url);
}

const photo = ref(photoInUrl());
const onPopState = () => (photo.value = photoInUrl());
addEventListener("popstate", onPopState);
onBeforeUnmount(() => removeEventListener("popstate", onPopState));

function onOpenChange(open: boolean) {
  if (open) return;
  followInUrl(null);
  photo.value = null;
}

function onIndexChange(index: number) {
  followInUrl(index);
  photo.value = index;
}
</script>

<template>
  <Fluidbox.Root
    :items="photos"
    :open="photo !== null"
    :index="photo ?? undefined"
    @update:open="onOpenChange"
    @update:index="onIndexChange"
  >
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
