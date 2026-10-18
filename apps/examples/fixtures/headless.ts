import { mountSite } from "../src/site";
import { arraySource, createLightbox } from "@ogdakke/fluidbox";
import type { LightboxController, LightboxItem, LightboxRenderer } from "@ogdakke/fluidbox";
import "./headless.css";

mountSite("fixtures", {
  fixture: "Headless runtime · custom renderers, a protected viewer, and a secondary viewer",
});

const source = arraySource<LightboxItem>([
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
    placeholder: { src: "/photo-square.svg" },
    preview: { src: "/photo-square.svg" },
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

const origins = {
  getOrigin(id: string) {
    const trigger = document.querySelector<HTMLElement>(`[data-photo-id="${id}"]`);
    const visual = trigger?.querySelector<HTMLImageElement>("img");
    return trigger && visual ? { trigger, visual, thumbnail: visual } : null;
  },
};
const increment = (name: string) => {
  document.body.dataset[name] = String(Number(document.body.dataset[name] ?? 0) + 1);
};
const renderers = {
  demo: {
    mount({ target, item, signal }) {
      increment("customMounts");
      const content = document.createElement("button");
      content.type = "button";
      content.dataset.testCustomMedia = "";
      content.textContent = `Custom ${item.id}`;
      target.append(content);
      signal.addEventListener("abort", () => increment("customAborts"), { once: true });
      return () => increment("customDisposals");
    },
  },
} satisfies Record<string, LightboxRenderer<DemoItem>>;

const viewer: LightboxController<DemoItem> = createLightbox({
  source,
  origins,
  renderers,
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
const secondaryViewer: LightboxController<DemoItem> = createLightbox({
  source,
  origins,
  renderers,
});
const protectedViewer: LightboxController<DemoItem> = createLightbox({
  source,
  origins,
  renderers,
  onBeforeCommand(event) {
    if (event.command === "close") event.preventDefault();
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
    headlessSecondaryViewer: typeof secondaryViewer;
    headlessProtectedViewer: typeof protectedViewer;
  }
}

window.headlessViewer = viewer;
window.headlessSecondaryViewer = secondaryViewer;
window.headlessProtectedViewer = protectedViewer;
