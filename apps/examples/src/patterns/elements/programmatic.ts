// #region example
export function programmatic(root: HTMLElement) {
  const gallery = root.querySelector("fluidbox-gallery")!;
  const lock = root.querySelector<HTMLInputElement>('input[name="lock"]')!;
  const status = root.querySelector<HTMLOutputElement>('output[name="status"]')!;
  const log = root.querySelector<HTMLOListElement>(".pattern-log")!;

  root.querySelector('[data-action="open-third"]')!.addEventListener("click", () => {
    void gallery.open(2);
  });

  // beforeitemchange comes before every move between items; canceling it keeps the viewer still.
  gallery.addEventListener("beforeitemchange", (event) => {
    if (lock.checked) event.preventDefault();
  });

  for (const type of ["beforetoggle", "toggle", "beforeitemchange", "itemchange", "settle"]) {
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
