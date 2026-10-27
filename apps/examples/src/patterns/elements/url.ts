// #region example
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

export function url(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // The gallery opens, moves and closes as its value changes.
  const show = (photo: number | null) => {
    gallery.value = photo === null ? null : photos[photo]!.id;
  };
  gallery.addEventListener("valuechange", ({ index }) => {
    followInUrl(index);
    show(index);
  });
  const onPopState = () => show(photoInUrl());
  addEventListener("popstate", onPopState);
  show(photoInUrl());
  return () => removeEventListener("popstate", onPopState);
}
// #endregion example
