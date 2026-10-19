// #region example
import { createFluidbox } from "@ogdakke/fluidbox";
import { label, photos } from "../shared";

export function mountProgrammatic(root: HTMLElement) {
  root.insertAdjacentHTML(
    "beforeend",
    `<div class="pattern-toolbar">
      <button type="button" data-action="open-third" data-test="open-third">Open the third photo</button>
      <label><input type="checkbox" name="lock" data-test="lock" /> Lock navigation</label>
      <output name="status" data-test="status"></output>
    </div>
    <div class="pattern-grid"></div>
    <ol class="pattern-log" data-test="log"></ol>`,
  );
  const openThird = root.querySelector<HTMLButtonElement>('[data-action="open-third"]')!;
  const lock = root.querySelector<HTMLInputElement>('input[name="lock"]')!;
  const status = root.querySelector<HTMLOutputElement>('output[name="status"]')!;
  const grid = root.querySelector<HTMLElement>(".pattern-grid")!;
  const log = root.querySelector<HTMLOListElement>(".pattern-log")!;

  const fluidbox = createFluidbox({ items: photos });

  // beforeitemchange comes before every move between items; canceling it keeps the viewer still.
  fluidbox.addEventListener("beforeitemchange", (event) => {
    if (lock.checked) event.preventDefault();
  });
  for (const type of [
    "beforetoggle",
    "toggle",
    "beforeitemchange",
    "itemchange",
    "settle",
  ] as const) {
    fluidbox.addEventListener(type, (event) => {
      const entry = document.createElement("li");
      entry.textContent = event.type;
      log.append(entry);
      while (log.children.length > 20) log.firstElementChild!.remove();
    });
  }

  const showStatus = () => {
    const { status: current, index } = fluidbox.state;
    status.value = `${current} ${index ?? "-"}`;
  };
  showStatus();
  fluidbox.subscribe(showStatus);
  openThird.addEventListener("click", () => void fluidbox.open(2));

  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pattern-thumb";
    button.dataset.test = "trigger";
    button.append(Object.assign(new Image(), { src: photo.src, alt: label(photo) }));
    grid.append(button);
    fluidbox.bind(button, index);
  });

  return () => {
    fluidbox.destroy();
    root.replaceChildren();
  };
}
// #endregion example
