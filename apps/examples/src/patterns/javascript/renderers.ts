// #region example
import { createFluidbox, itemLabel, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { media, theme, thumbnailSrc } from "../shared";

// Draws items of type "note".
const note: FluidboxSlideRenderer = (slide) => {
  const article = document.createElement("article");
  article.className = "pattern-note";
  article.textContent = `Theme: ${theme}`;
  slide.media.append(article);
  return () => article.remove();
};

export function mountRenderers(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: media, slides: { note } });

  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  media.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: thumbnailSrc(item), alt: itemLabel(item) }));
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
