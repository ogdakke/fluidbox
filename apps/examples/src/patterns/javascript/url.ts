// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
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

export function mountUrl(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: photos });

  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: photo.src, alt: itemLabel(photo) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });
  root.append(grid);

  // The address drives the viewer, and the viewer writes back to it.
  const showUrl = () => {
    const photo = photoInUrl();
    void (photo === null ? fluidbox.close() : fluidbox.open(photo));
  };
  fluidbox.addEventListener("valuechange", ({ index }) => followInUrl(index));
  addEventListener("popstate", showUrl);
  showUrl();

  return () => {
    removeEventListener("popstate", showUrl);
    fluidbox.destroy();
    grid.remove();
  };
}
// #endregion example
