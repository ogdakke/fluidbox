// #region example
import { media, theme } from "../shared";

export function renderers(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  // Items from JS; the buttons marked data-fluidbox-value open them.
  gallery.items = media;
  // The slide template is the page's markup, so the page fills it in as it would any other.
  const slide = gallery.querySelector<HTMLTemplateElement>("template[data-fluidbox-slide]")!;
  slide.content.querySelector("[data-theme]")!.textContent = `Theme: ${theme}`;
}
// #endregion example
