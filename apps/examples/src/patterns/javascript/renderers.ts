// #region example
import { createFluidbox, itemLabel, type FluidboxRenderer } from "@ogdakke/fluidbox";
import { media, theme, thumbnailSrc } from "../shared";

// Draws items of type "custom" whose render is "note".
const note: FluidboxRenderer = ({ target }) => {
  const article = document.createElement("article");
  article.className = "pattern-note";
  article.textContent = `Theme: ${theme}`;
  target.append(article);
  return () => article.remove();
};

export function mountRenderers(root: HTMLElement) {
  const fluidbox = createFluidbox({ items: media, renderers: { note } });

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
