// #region example
import "@ogdakke/fluidbox/filmstrip.css";
import { arabic } from "../shared";

export function rtl(root: HTMLElement) {
  root.querySelector("fluidbox-gallery")!.labels = arabic;
}
// #endregion example
