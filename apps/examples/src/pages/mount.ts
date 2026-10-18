/** Mount a demo into `selector`, clearing its loading state and reporting failures in place. */
export function mountInto(
  selector: string,
  load: () => Promise<(root: HTMLElement) => void>,
): void {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) return;
  void load()
    .then((mount) => mount(root))
    .catch((error: unknown) => {
      console.error(error);
      root.textContent = `Failed to load: ${String(error)}`;
    })
    .finally(() => root.removeAttribute("aria-busy"));
}
