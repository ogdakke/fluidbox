import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/elements";
import { takeOverFluidbox } from "@ogdakke/fluidbox/kit";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createSSRApp } from "vue";
import { cspItems } from "./csp-items";
import { CspVue } from "./csp-vue";

const viewer = createFluidbox({ items: cspItems });
for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo]")) {
  viewer.bind(trigger, Number(trigger.dataset.photo));
}

const params = new URLSearchParams(location.search);
const copy = document.querySelector<HTMLElement>("[data-fluidbox-static]");
const takeOver = copy
  ? takeOverFluidbox(viewer, copy, cspItems[Number(params.get("ssr") || 0)]!.id!)
  : Promise.resolve(false);

// A Root that renders open draws its server copy on the client too.
if (params.has("react")) {
  const photos = cspItems.slice(0, 2);
  createRoot(document.querySelector("[data-csp-react]")!).render(
    createElement(
      Fluidbox.Root,
      { items: photos, value: photos[1]!.id! },
      photos.map((photo, index) =>
        createElement(Fluidbox.Trigger, {
          key: photo.id,
          value: index,
          children: createElement("img", { src: photo.src, alt: photo.alt, width: 160 }),
        }),
      ),
    ),
  );
}

// So does a Vue Root, open through v-model, which hydrates the server's HTML.
if (params.has("vue")) {
  createSSRApp(CspVue).mount(document.querySelector<HTMLElement>("[data-csp-vue]")!);
}

declare global {
  interface Window {
    cspViewer: typeof viewer;
    /** Kept by /csp-violations.js. */
    cspViolations: string[];
    cspTakeOver: Promise<boolean>;
  }
}
window.cspViewer = viewer;
window.cspTakeOver = takeOver;
