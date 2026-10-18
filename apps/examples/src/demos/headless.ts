import { arraySource, createLightbox } from "@ogdakke/fluidbox";
import type { LightboxController, LightboxItem } from "@ogdakke/fluidbox";
import { artItem, artSrc, sceneById } from "../art";

const picks = ["canyon", "coast", "ridge", "dune"].map(sceneById);

export function mountHeadless(grid: HTMLElement): LightboxController<LightboxItem> {
  const source = arraySource(picks.map((scene) => artItem(scene, `headless-${scene.id}`)));

  for (const scene of picks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "headless-thumb";
    button.dataset.photoId = `headless-${scene.id}`;
    button.setAttribute("aria-label", `Open ${scene.title}`);
    const image = document.createElement("img");
    image.src = artSrc(scene);
    image.alt = "";
    image.width = scene.width;
    image.height = scene.height;
    button.append(image);
    grid.append(button);
  }

  const viewer = createLightbox({
    source,
    origins: {
      getOrigin(id) {
        const trigger = grid.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(id)}"]`);
        const visual = trigger?.querySelector("img");
        return trigger && visual ? { trigger, visual, thumbnail: visual } : null;
      },
    },
    portal: {
      mount({ target, controller, signal }) {
        const bar = document.createElement("div");
        bar.className = "caption-bar";
        bar.innerHTML = `
          <button type="button" data-action="previous" aria-label="Previous image">←</button>
          <div class="caption-bar__text"><strong></strong><span></span></div>
          <button type="button" data-action="next" aria-label="Next image">→</button>
          <button type="button" data-action="close" aria-label="Close viewer">✕</button>
        `;
        const title = bar.querySelector("strong")!;
        const counter = bar.querySelector(".caption-bar__text span")!;
        const button = (action: string) =>
          bar.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
        const sync = () => {
          const { activeIndex, count, canPrevious, canNext } = controller.state;
          const item = activeIndex === null ? null : source.getItem(activeIndex);
          title.textContent = item?.media.type === "image" ? item.media.alt : "";
          counter.textContent = activeIndex === null ? "" : `${activeIndex + 1} / ${count}`;
          button("previous").disabled = !canPrevious;
          button("next").disabled = !canNext;
        };
        const dispose = controller.subscribe(sync);
        button("previous").addEventListener("click", () => void controller.previous(), {
          signal,
        });
        button("next").addEventListener("click", () => void controller.next(), { signal });
        button("close").addEventListener("click", () => void controller.close(), { signal });
        target.append(bar);
        sync();
        return () => {
          dispose();
          bar.remove();
        };
      },
    },
  });

  grid.addEventListener("click", (event) => {
    const trigger = (event.target as Element).closest<HTMLElement>("[data-photo-id]");
    if (trigger) void viewer.open({ id: trigger.dataset.photoId! }, { reason: "trigger" });
  });
  return viewer;
}
