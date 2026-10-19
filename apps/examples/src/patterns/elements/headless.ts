// #region example
import { label } from "../shared";

export function headless(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const caption = root.querySelector<HTMLTemplateElement>(":scope > template")!;
  gallery.viewer = ({ target, fluidbox, signal }) => {
    target.append(caption.content.cloneNode(true));
    const action = (name: string) =>
      target.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
    const previous = action("previous");
    const next = action("next");
    previous.addEventListener("click", () => fluidbox.previous(), { signal });
    next.addEventListener("click", () => fluidbox.next(), { signal });
    action("close").addEventListener("click", () => fluidbox.close(), { signal });
    const title = target.querySelector("strong")!;
    const counter = target.querySelector("small")!;
    return fluidbox.subscribe(({ item, index, count, hasPrevious, hasNext }) => {
      if (!item || index === null) return;
      title.textContent = label(item);
      counter.textContent = `${index + 1} / ${count}`;
      previous.disabled = !hasPrevious;
      next.disabled = !hasNext;
    });
  };
}
// #endregion example
