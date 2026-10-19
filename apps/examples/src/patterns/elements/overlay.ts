// #region example
export function overlay(root: HTMLElement) {
  const cover = root.querySelector("fluidbox-item")!;
  const preview = cover.querySelector<HTMLImageElement>("img")!;
  // Before the close flight lands, show the item it lands on.
  cover.addEventListener("fluidbox-preview-change", ({ detail: { item } }) => {
    if (item.type !== "img") return;
    preview.src = item.src;
    preview.alt = item.alt;
  });
}
// #endregion example
