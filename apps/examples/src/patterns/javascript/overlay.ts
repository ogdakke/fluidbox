// #region example
import { createFluidbox } from "@ogdakke/fluidbox";
import { album, label } from "../shared";

export function mountOverlay(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: album });
  const ids = album.map((item) => item.id!);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pattern-thumb pattern-album";
  button.dataset.test = "trigger";
  const preview = Object.assign(new Image(), { src: album[0]!.src, alt: label(album[0]!) });
  preview.dataset.test = "preview";
  const count = document.createElement("span");
  count.className = "pattern-overlay";
  count.dataset.test = "count";
  count.textContent = `+${album.length - 1}`;
  button.append(preview, count);
  root.append(button);

  // The first id opens; every one of them closes back onto the button.
  fluidbox.bind(button, ids, {
    onPreviewChange(item) {
      preview.src = item.src;
      preview.alt = label(item);
    },
  });
  // The count flies with the photo.
  fluidbox.bindOverlay(count, ids, { travel: true });

  return () => {
    fluidbox.destroy();
    button.remove();
  };
}
// #endregion example
