// #region example
import {
  createFluidbox,
  itemLabel,
  type Fluidbox,
  type FluidboxImageItem,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";
import { photos } from "../shared";

export function mountSheet(root: HTMLElement) {
  const fluidbox: Fluidbox<FluidboxImageItem> = createFluidbox({
    items: photos,
    sheet: {
      snapPoints: ["40%", "90%"],
      // Fills the sheet for the active item.
      render({ item, target, signal }) {
        const sheet = fluidbox.sheet!;
        target.innerHTML = `
          <div class="pattern-sheet">
            <h3 data-test="sheet-title"></h3>
            <p>Stop <output name="stop" data-test="stop"></output></p>
            <button type="button" data-action="expand" data-test="expand">Expand</button>
            <input data-test="field" placeholder="Add a note" aria-label="Note" />
          </div>`;
        target.querySelector("h3")!.textContent = itemLabel(item);
        target
          .querySelector('[data-action="expand"]')!
          .addEventListener("click", () => sheet.set(2));
        const stop = target.querySelector<HTMLOutputElement>('output[name="stop"]')!;
        stop.value = String(sheet.stop);
        fluidbox.addEventListener("sheetchange", (event) => (stop.value = String(event.stop)), {
          signal,
        });
      },
    },
    // A button marked data-fluidbox-sheet-stop moves the sheet to that stop.
    viewer({ target }) {
      target.insertAdjacentHTML(
        "beforeend",
        `<button type="button" class="pattern-sheet-toggle" data-fluidbox-sheet-stop="1" data-test="peek">Details</button>`,
      );
    },
  });

  const grid = document.createElement("div");
  grid.className = "pattern-grid";
  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: photo.src, alt: itemLabel(photo) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });
  root.append(grid);

  return () => {
    fluidbox.destroy();
    grid.remove();
  };
}
// #endregion example
