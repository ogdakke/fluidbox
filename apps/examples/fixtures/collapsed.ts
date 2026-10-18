import type { AppGallery, AppLightbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
import "./site.css";

const gallery = document.querySelector<AppGallery>("#collapsed-gallery")!;
const colors = ["#c83f4b", "#d39a32", "#4a7098", "#78914b", "#9166a3", "#3b9b9b"];
const imageSource = (index: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="${colors[index % colors.length]}"/><text x="30" y="80" fill="white" font-size="60">${index + 1}</text></svg>`)}`;

for (let index = 0; index < 10; index++) {
  const item = document.createElement("app-lightbox") as AppLightbox;
  item.setAttribute("item-id", `item-${index}`);
  item.dataset.index = String(index);
  if (index === 2) item.dataset.previewMore = "";
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
  item.append(trigger);
  if (index === 2) {
    const overlay = document.createElement("span");
    overlay.dataset.lightboxTransitionLayer = "";
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
  #collapsed-gallery > app-lightbox { display: block; width: calc((100% - 24px) / 3); position: relative; }
  #collapsed-gallery > [data-preview-hidden] { display: none; }
  #collapsed-gallery > app-lightbox > [slot="trigger"] { display: block; width: 100%; padding: 0; border: 0; cursor: pointer; overflow: hidden; }
  #collapsed-gallery > app-lightbox img { display: block; width: 100%; height: auto; border-radius: 0; }
  #collapsed-gallery > app-lightbox:first-of-type, #collapsed-gallery > app-lightbox:first-of-type > [slot="trigger"], #collapsed-gallery > app-lightbox:first-of-type > [slot="trigger"] img { border-start-start-radius: 18px; border-end-start-radius: 18px; }
  #collapsed-gallery > [data-preview-more], #collapsed-gallery > [data-preview-more] > [slot="trigger"], #collapsed-gallery > [data-preview-more] > [slot="trigger"] img { border-start-end-radius: 18px; border-end-end-radius: 18px; }
  #collapsed-gallery > [data-preview-more] { overflow: hidden; }
  #collapsed-gallery > [data-preview-more][data-preview-concealed] { visibility: hidden; }
  :is(#collapsed-gallery, [data-lightbox-transition-content], [data-lightbox-frame]) [data-lightbox-transition-layer] { position: absolute; inset: 0; display: grid; place-items: center; color: white; background: #0008; pointer-events: none; opacity: var(--lightbox-transition-layer-opacity, var(--lightbox-progress, 1)); }
  [data-lightbox-transition-layer][data-lightbox-phase]:not([data-lightbox-phase="preview"]) [data-collapsed-label] { visibility: hidden; }
  [data-lightbox-transition-content] [data-collapsed-label] { color: white; opacity: var(--lightbox-progress); }
`;
document.head.append(style);

void gallery.whenReady().then((controller) => {
  const teaser = gallery.querySelector<AppLightbox>("[data-preview-more]")!;
  teaser.dataset.lightboxDynamicPreview = "";
  const preview = teaser.trigger.querySelector("img")!;
  const initialSrc = preview.src;
  const hidden = [...gallery.querySelectorAll<AppLightbox>("[data-preview-hidden]")];
  const hiddenSources = new Map(
    hidden.map((item) => [item.itemId, item.trigger.querySelector("img")!.src]),
  );
  const hiddenIds = new Set(hiddenSources.keys());
  const showPreview = (id: string, updateOpenItem = true) => {
    preview.src = hiddenSources.get(id) ?? initialSrc;
    if (updateOpenItem) teaser.openItemId = id;
  };
  controller.registerOrigin([teaser.itemId, ...hiddenIds], {
    trigger: teaser.trigger,
    visual: teaser.trigger,
    thumbnail: preview,
    prepareClose: (item) => {
      if (hiddenIds.has(item.id)) showPreview(item.id, false);
    },
  });
  const overlay = teaser.querySelector<HTMLElement>("[data-lightbox-transition-layer]")!;
  for (const id of [teaser.itemId, ...hiddenIds]) {
    controller.registerThumbnailOverlay(id, {
      behavior: "travel",
      element: overlay,
      frameLayer: overlay,
      renderer: {
        mount({ target }) {
          target.style.setProperty("--lightbox-transition-content-opacity", "1");
          const label = overlay.querySelector<HTMLElement>("[data-collapsed-label]")!;
          const marker = document.createComment("collapsed-label");
          label.before(marker);
          label.dataset.lightboxCounterScale = "";
          target.append(label);
          return () => {
            delete label.dataset.lightboxCounterScale;
            marker.replaceWith(label);
          };
        },
      },
    });
  }
  let closingId: string | null = null;
  let lastClosedId = teaser.itemId;
  controller.subscribe((state) => {
    const id = state.requestedId ?? state.activeId;
    if (state.status === "closing" && id && hiddenIds.has(id)) closingId = id;
    if (state.status === "closed") {
      if (closingId) {
        lastClosedId = closingId;
        showPreview(lastClosedId);
        closingId = null;
      }
      delete teaser.dataset.previewConcealed;
    } else if (closingId && state.status !== "closing") {
      closingId = null;
      showPreview(lastClosedId);
    } else if (id === teaser.itemId || (id && hiddenIds.has(id))) {
      teaser.dataset.previewConcealed = "";
    }
  });
  document.documentElement.dataset.fixtureReady = "";
});
