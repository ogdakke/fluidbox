// #region example
import "@ogdakke/fluidbox/filmstrip.css";

export function filmstrip(root: HTMLElement) {
  // Your own thumbnails. The selected button has data-fluidbox-selected.
  const strip = root.querySelector(".numbered-strip")!.querySelector("fluidbox-filmstrip")!;
  strip.render = ({ index, target }) => {
    const thumb = document.createElement("span");
    thumb.className = "pattern-filmstrip-thumb";
    thumb.dataset.test = "thumb";
    thumb.textContent = String(index + 1);
    target.append(thumb);
  };
}
// #endregion example
