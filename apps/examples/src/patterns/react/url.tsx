// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { useEffect, useState } from "react";
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
  // Read the address after the first render, so the server and the browser render the same.
  const [photo, setPhoto] = useState<number | null>(null);
  useEffect(() => {
    const onPopState = () => setPhoto(photoInUrl());
    onPopState();
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);

  return (
    <Fluidbox.Root
      items={photos}
      open={photo !== null}
      index={photo ?? undefined}
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
      <div className="pattern-grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger
            key={photo.src}
            item={photo}
            className="pattern-thumb"
            data-test="trigger"
          >
            <img src={photo.src} alt={itemLabel(photo)} />
          </Fluidbox.Trigger>
        ))}
      </div>
    </Fluidbox.Root>
  );
}
// #endregion example
