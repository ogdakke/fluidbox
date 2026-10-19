// #region example
import { media, theme } from "../shared";

export function renderers(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // Items from JS; the buttons marked data-fluidbox-item-id open them.
  gallery.items = media;
  gallery.renderers = {
    note({ target }) {
      const note = document.createElement("article");
      note.className = "pattern-note";
      note.textContent = `Theme: ${theme}`;
      target.append(note);
    },
  };
}
// #endregion example
