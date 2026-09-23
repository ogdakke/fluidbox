import { arraySource } from "@ogdakke/fluidbox";
import type { LightboxController } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";
import { createLightbox } from "../../packages/lightbox/src/create-lightbox";
import "./headless.css";

const source = arraySource([
  {
    id: "one",
    media: {
      type: "image",
      src: "/photo-square.svg",
      alt: "Blue square study",
      width: 800,
      height: 800,
      candidates: [
        { src: "/photo-square.svg", width: 400 },
        { src: "/photo-square.svg", width: 800 },
      ],
      sizes: "min(100vw, 800px)",
      sources: [
        {
          media: "(min-width: 1px)",
          candidates: [{ src: "/photo-square.svg", width: 800 }],
          sizes: "min(100vw, 800px)",
        },
      ],
    },
  },
  {
    id: "two",
    media: {
      type: "image",
      src: "/photo-portrait.svg",
      alt: "Orange portrait study",
      width: 600,
      height: 900,
    },
  },
]);

type DemoItem = ReturnType<typeof source.getItem>;

const viewer: LightboxController<DemoItem> = createLightbox({
  source,
  origins: {
    getOrigin(id) {
      const trigger = document.querySelector<HTMLElement>(`[data-photo-id="${id}"]`);
      const visual = trigger?.querySelector<HTMLImageElement>("img");
      return trigger && visual ? { trigger, visual, thumbnail: visual } : null;
    },
  },
  portal: {
    mount({ target, controller, signal }) {
      const controls = document.createElement("div");
      controls.dataset.demoControls = "";
      controls.innerHTML = `
        <button type="button" data-demo-previous aria-label="Previous image">Previous</button>
        <p data-demo-caption></p>
        <button type="button" data-demo-next aria-label="Next image">Next</button>
        <button type="button" data-demo-close aria-label="Close viewer">Close</button>
      `;
      const caption = controls.querySelector<HTMLElement>("[data-demo-caption]")!;
      const sync = () => {
        const state = controller.state;
        caption.textContent = state.activeId ?? "";
        controls.querySelector<HTMLButtonElement>("[data-demo-previous]")!.disabled =
          !state.canPrevious;
        controls.querySelector<HTMLButtonElement>("[data-demo-next]")!.disabled = !state.canNext;
      };
      const disposeState = controller.subscribe(sync);
      controls
        .querySelector("[data-demo-previous]")!
        .addEventListener("click", () => void controller.previous(), { signal });
      controls
        .querySelector("[data-demo-next]")!
        .addEventListener("click", () => void controller.next(), { signal });
      controls
        .querySelector("[data-demo-close]")!
        .addEventListener("click", () => void controller.close(), { signal });
      target.append(controls);
      sync();
      return () => {
        disposeState();
        controls.remove();
      };
    },
  },
});

for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo-id]")) {
  trigger.addEventListener("click", () => {
    void viewer.open({ id: trigger.dataset.photoId! }, { reason: "trigger" });
  });
}

declare global {
  interface Window {
    headlessViewer: typeof viewer;
  }
}

window.headlessViewer = viewer;
