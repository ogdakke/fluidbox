// #region example
import { itemLabel } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/sheet.css";
import "@ogdakke/fluidbox/baseline.css";

export function sheet(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const sheet = gallery.querySelector("fluidbox-sheet")!;
  const content = sheet.querySelector("template")!;
  // Fill the sheet for the active item; without this it shows the template as is.
  sheet.render = ({ item, target, signal }) => {
    target.append(content.content.cloneNode(true));
    target.querySelector("h3")!.textContent = itemLabel(item);
    const stop = target.querySelector<HTMLOutputElement>('output[name="stop"]')!;
    stop.value = String(gallery.sheet!.snap);
    gallery.addEventListener("sheetchange", (event) => (stop.value = String(event.snap)), {
      signal,
    });
  };
}
// #endregion example
