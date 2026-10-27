// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import { album } from "../shared";

export function mountOverlay(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: album });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-thumb pattern-album";
  button.dataset.test = "trigger";
  const preview = Object.assign(new Image(), { src: album[0]!.src, alt: itemLabel(album[0]!) });
  preview.dataset.test = "preview";
  const count = document.createElement("span");
  count.className = "pattern-overlay";
  count.dataset.test = "count";
  count.textContent = `+${album.length - 1}`;
  button.append(preview, count);
  root.append(button);

  // The cover opens the first photo; every one of them closes back onto it.
  fluidbox.bind(button, album, {
    onPreviewChange(item) {
      preview.src = item.src;
      preview.alt = itemLabel(item);
    },
  });
  // The count flies with the photo.
  fluidbox.bindOverlay(count, album, { flight: "copy" });

  return () => {
    fluidbox.destroy();
    button.remove();
  };
}
// #endregion example
