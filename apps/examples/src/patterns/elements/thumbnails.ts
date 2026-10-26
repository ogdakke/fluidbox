// #region example
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";

export function thumbnails(root: HTMLElement) {
  // Your own thumbnails. The selected button has data-active.
  const strip = root.querySelector(".numbered-strip")!.querySelector("fluidbox-thumbnails")!;
  strip.render = ({ index, target }) => {
    const thumb = document.createElement("span");
    thumb.className = "pattern-thumbnails-thumb";
    thumb.dataset.test = "thumb";
    thumb.textContent = String(index + 1);
    target.append(thumb);
  };
}
// #endregion example
