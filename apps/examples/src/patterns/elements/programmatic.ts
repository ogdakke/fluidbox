// #region example
export function programmatic(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const lock = root.querySelector<HTMLInputElement>('input[name="lock"]')!;
  const status = root.querySelector<HTMLOutputElement>('output[name="status"]')!;
  const log = root.querySelector<HTMLOListElement>(".pattern-log")!;

  root.querySelector('[data-action="open-third"]')!.addEventListener("click", () => {
    void gallery.open(2);
  });

  // beforevaluechange comes before every open, move and close; canceling a move keeps the viewer still.
  gallery.addEventListener("beforevaluechange", (event) => {
    if (lock.checked && event.action === "move") event.preventDefault();
  });

  for (const type of ["valuechange", "valuechangecomplete"]) {
    gallery.addEventListener(type, () => {
      log.append(Object.assign(document.createElement("li"), { textContent: type }));
      while (log.children.length > 20) log.firstElementChild!.remove();
    });
  }

  gallery.subscribe(({ status: current, index }) => {
    status.value = `${current} ${index ?? "-"}`;
  });
}
// #endregion example
