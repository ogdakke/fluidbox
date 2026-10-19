// #region example
import "@ogdakke/fluidbox/sheet.css";
import { label } from "../shared";

export function sheet(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const sheet = gallery.querySelector("fluidbox-sheet")!;
  const content = sheet.querySelector("template")!;
  // Fill the sheet for the active item; without this it shows the template as is.
  sheet.render = ({ item, target }) => {
    target.append(content.content.cloneNode(true));
    target.querySelector("h3")!.textContent = label(item);
    const stop = target.querySelector<HTMLOutputElement>('output[name="stop"]')!;
    stop.value = String(gallery.sheet!.stop);
    return gallery.sheet!.subscribe((next) => (stop.value = String(next)));
  };
}
// #endregion example
