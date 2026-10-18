import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
import "./showcase.css";
import { mountElements } from "./demos/elements";
import { mountHeadless } from "./demos/headless";
import { mountIndexed } from "./demos/indexed";

mountElements(document.querySelector("#mosaic")!);
mountIndexed(document.querySelector("#virtual-gallery")!, document.querySelector("#jump-form")!);
mountHeadless(document.querySelector("#headless-grid")!);

// Framework demos load in parallel after the vanilla demos are interactive.
const frameworks: [string, () => Promise<{ mount(root: HTMLElement): void }>][] = [
  ["#react-root", () => import("./demos/react")],
  ["#solid-root", () => import("./demos/solid")],
  ["#vue-root", () => import("./demos/vue")],
  ["#angular-root", () => import("./demos/angular")],
];
for (const [selector, load] of frameworks) {
  const root = document.querySelector<HTMLElement>(selector)!;
  void load()
    .then((demo) => demo.mount(root))
    .catch((error: unknown) => {
      console.error(error);
      root.textContent = `Failed to load: ${String(error)}`;
    })
    .finally(() => root.removeAttribute("aria-busy"));
}
