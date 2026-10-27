import { mountSite } from "../src/site";
import "@ogdakke/fluidbox/elements";
import type { FluidboxGalleryElement, FluidboxItemElement } from "@ogdakke/fluidbox/elements";
import "./site.css";

mountSite("fixtures", {
  fixture: "Collapsed gallery · three visible tiles and a +8 teaser for the rest",
});

const gallery = document.querySelector<FluidboxGalleryElement>("#collapsed-gallery")!;
const colors = ["#c83f4b", "#d39a32", "#4a7098", "#78914b", "#9166a3", "#3b9b9b"];
const imageSource = (index: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="${colors[index % colors.length]}"/><text x="30" y="80" fill="white" font-size="60">${index + 1}</text></svg>`)}`;

for (let index = 0; index < 10; index++) {
  const item = document.createElement("fluidbox-item") as FluidboxItemElement;
  item.value = `item-${index}`;
  item.dataset.index = String(index);
  // The teaser stands in for the items behind it, which have no trigger of their own.
  if (index === 2) {
    item.dataset.previewMore = "";
    item.value = Array.from({ length: 8 }, (_, i) => `item-${i + 2}`).join(" ");
  }
  if (index > 2) item.dataset.previewHidden = "";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.slot = "trigger";
  const image = document.createElement("img");
  image.src = imageSource(index);
  image.alt = `Item ${index + 1}`;
  image.width = 600;
  image.height = 400;
  trigger.append(image);
  if (index <= 2) item.append(trigger);
  if (index === 2) {
    const overlay = document.createElement("span");
    overlay.dataset.fluidboxTransitionLayer = "";
    const label = document.createElement("span");
    label.dataset.collapsedLabel = "";
    label.textContent = "+8 items";
    overlay.append(label);
    item.append(overlay);
  }
  const template = document.createElement("template");
  template.slot = "content";
  template.innerHTML = `<img src="${imageSource(index)}" alt="Item ${index + 1}" width="600" height="400">`;
  item.append(template);
  gallery.append(item);
}

const style = document.createElement("style");
style.textContent = `
  #collapsed-gallery { display: flex; gap: 12px; max-width: 800px; }
  #collapsed-gallery > fluidbox-item { display: block; width: calc((100% - 24px) / 3); position: relative; }
  #collapsed-gallery > [data-preview-hidden] { display: none; }
  #collapsed-gallery > fluidbox-item > [slot="trigger"] { display: block; width: 100%; padding: 0; border: 0; cursor: pointer; overflow: hidden; }
  #collapsed-gallery > fluidbox-item img { display: block; width: 100%; height: auto; border-radius: 0; }
  #collapsed-gallery > fluidbox-item:first-of-type, #collapsed-gallery > fluidbox-item:first-of-type > [slot="trigger"], #collapsed-gallery > fluidbox-item:first-of-type > [slot="trigger"] img { border-start-start-radius: 18px; border-end-start-radius: 18px; }
  #collapsed-gallery > [data-preview-more], #collapsed-gallery > [data-preview-more] > [slot="trigger"], #collapsed-gallery > [data-preview-more] > [slot="trigger"] img { border-start-end-radius: 18px; border-end-end-radius: 18px; }
  #collapsed-gallery > [data-preview-more] { overflow: hidden; }
  #collapsed-gallery > [data-preview-more][data-preview-concealed] { visibility: hidden; }
  :is(#collapsed-gallery, [data-fluidbox-transition-content], [data-fluidbox-frame]) [data-fluidbox-transition-layer] { position: absolute; inset: 0; display: grid; place-items: center; color: white; background: #0008; pointer-events: none; opacity: var(--fluidbox-transition-layer-opacity, var(--fluidbox-closed, 1)); }
  [data-fluidbox-transition-layer][data-fluidbox-phase]:not([data-fluidbox-phase="idle"]) [data-collapsed-label] { visibility: hidden; }
  [data-fluidbox-transition-content] [data-collapsed-label] { color: white; opacity: var(--fluidbox-closed); }
`;
document.head.append(style);

void gallery.whenReady().then((fluidbox) => {
  const teaser = gallery.querySelector<FluidboxItemElement>("[data-preview-more]")!;
  const preview = teaser.trigger!.querySelector("img")!;
  const initialSrc = preview.src;
  const hidden = [...gallery.querySelectorAll<FluidboxItemElement>("[data-preview-hidden]")];
  const hiddenSources = new Map(
    hidden.map((item) => [item.value, imageSource(Number(item.dataset.index))]),
  );
  const hiddenIds = new Set(hiddenSources.keys());
  const showPreview = (id: string) => {
    preview.src = hiddenSources.get(id) ?? initialSrc;
  };
  teaser.addEventListener("fluidbox-preview-change", (event) => showPreview(event.detail.id));
  const overlay = teaser.querySelector<HTMLElement>("[data-fluidbox-transition-layer]")!;
  const teaserId = "item-2";
  const value = [teaserId, ...hiddenIds];
  // The overlay itself moves into the flying frame, and its label rides live on it.
  fluidbox.bindOverlay(overlay, value, { flight: "frame" });
  fluidbox.bindOverlay(overlay, value, {
    flight: {
      live({ target }) {
        target.style.setProperty("--fluidbox-transition-content-opacity", "1");
        const label = overlay.querySelector<HTMLElement>("[data-collapsed-label]")!;
        const marker = document.createComment("collapsed-label");
        label.before(marker);
        label.dataset.fluidboxCounterScale = "";
        target.append(label);
        return () => {
          delete label.dataset.fluidboxCounterScale;
          marker.replaceWith(label);
        };
      },
    },
  });
  let closingId: string | null = null;
  let lastClosedId = teaserId;
  fluidbox.subscribe((state) => {
    const id = state.value;
    if (state.status === "closing" && id && hiddenIds.has(id)) closingId = id;
    if (state.status === "closed") {
      if (closingId) {
        lastClosedId = closingId;
        closingId = null;
      }
      delete teaser.dataset.previewConcealed;
    } else if (closingId && state.status !== "closing") {
      closingId = null;
      showPreview(lastClosedId);
    } else if (id === teaserId || (id && hiddenIds.has(id))) {
      teaser.dataset.previewConcealed = "";
    }
  });
  document.documentElement.dataset.fixtureReady = "";
});
