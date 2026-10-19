// #region example
import { createFluidbox, itemLabel } from "@ogdakke/fluidbox";
import { photos } from "../shared";

export function mountHeadless(root: HTMLElement) {
  const fluidbox = createFluidbox({
    items: photos,
    // Your own controls and caption, drawn into the viewer while it is open.
    viewer({ target, fluidbox, signal }) {
      const caption = document.createElement("div");
      caption.className = "pattern-caption";
      caption.innerHTML = `
        <button type="button" data-action="previous" data-test="prev">Previous</button>
        <span><strong data-test="title"></strong> <small data-test="counter"></small></span>
        <button type="button" data-action="next" data-test="next">Next</button>
        <button type="button" data-action="close" data-test="close">Close</button>`;
      const action = (name: string) =>
        caption.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
      const prev = action("previous");
      const next = action("next");
      const title = caption.querySelector("strong")!;
      const counter = caption.querySelector("small")!;
      prev.addEventListener("click", () => void fluidbox.previous(), { signal });
      next.addEventListener("click", () => void fluidbox.next(), { signal });
      action("close").addEventListener("click", () => void fluidbox.close(), { signal });
      target.append(caption);

      return fluidbox.subscribe(({ item, index, count, hasPrevious, hasNext }) => {
        if (!item || index === null) return;
        title.textContent = itemLabel(item);
        counter.textContent = `${index + 1} / ${count}`;
        prev.disabled = !hasPrevious;
        next.disabled = !hasNext;
      });
    },
  });

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

  return () => {
    fluidbox.destroy();
    grid.remove();
  };
}
// #endregion example
