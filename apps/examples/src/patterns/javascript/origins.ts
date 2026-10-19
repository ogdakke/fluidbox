// #region example
import { createFluidbox } from "@ogdakke/fluidbox";
import { label, product, strip } from "../shared";

export function mountOrigins(root: HTMLElement) {
  // The photo flies from the element marked data-fluidbox-origin, not the whole card.
  const productViewer = createFluidbox({ items: [product] });
  const card = document.createElement("button");
  card.type = "button";
  card.className = "pattern-card";
  card.dataset.test = "product";
  card.innerHTML = `
    <span data-fluidbox-origin><img src="${product.src}" alt="${label(product)}" /></span>
    <span><strong>Coral runner</strong><br />€120</span>`;
  productViewer.bind(card, 0);

  // Moving through the viewer scrolls each trigger into view, so the close lands on it.
  const stripViewer = createFluidbox({ items: strip });
  const scroller = document.createElement("div");
  scroller.className = "pattern-scroller";
  scroller.dataset.test = "scroller";
  strip.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: item.src, alt: label(item) }));
    scroller.append(button);
    stripViewer.bind(button, index);
  });

  root.append(card, scroller);

  return () => {
    productViewer.destroy();
    stripViewer.destroy();
    card.remove();
    scroller.remove();
  };
}
// #endregion example
