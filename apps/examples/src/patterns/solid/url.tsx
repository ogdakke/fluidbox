/** @jsxImportSource solid-js */
// #region example
import { createSignal, For, onCleanup, onMount } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
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

export function Url() {
  // Read the address once mounted, so the server and the browser render the same.
  const [photo, setPhoto] = createSignal<number | null>(null);
  onMount(() => {
    const onPopState = () => setPhoto(photoInUrl());
    onPopState();
    addEventListener("popstate", onPopState);
    onCleanup(() => removeEventListener("popstate", onPopState));
  });

  return (
    <Fluidbox.Root
      items={photos}
      open={photo() !== null}
      index={photo() ?? undefined}
      onOpenChange={(open) => {
        if (open) return;
        followInUrl(null);
        setPhoto(null);
      }}
      onIndexChange={(index) => {
        followInUrl(index);
        setPhoto(index);
      }}
    >
      <div class="pattern-grid">
        <For each={photos}>
          {(photo) => (
            <Fluidbox.Trigger item={photo} class="pattern-thumb" data-test="trigger">
              <img src={photo.src} alt={itemLabel(photo)} />
            </Fluidbox.Trigger>
          )}
        </For>
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
