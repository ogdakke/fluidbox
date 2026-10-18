import { scenes } from "@ogdakke/fluidbox-design/art-scenes";

/**
 * Live demos in Markdown are plain placeholders, for example
 * `<div data-demo="gallery" data-scenes="dune,fjord"></div>`. Each renders real fluidbox markup.
 */
const demos: Record<string, (root: HTMLElement) => void> = {
  gallery(root) {
    const ids = root.dataset.scenes?.split(",") ?? scenes.map((scene) => scene.id);
    const gallery = document.createElement("app-gallery");
    gallery.className = "doc-demo-gallery";
    gallery.setAttribute("aria-label", root.getAttribute("aria-label") ?? "Example gallery");
    for (const id of ids) {
      const scene = scenes.find((candidate) => candidate.id === id);
      if (!scene) continue;
      const item = document.createElement("app-lightbox");
      item.setAttribute("item-id", `doc-${scene.id}`);
      item.style.setProperty("--ratio", String(scene.width / scene.height));
      const image = () =>
        Object.assign(document.createElement("img"), {
          src: `/art/${scene.id}.svg`,
          alt: scene.title,
          width: scene.width,
          height: scene.height,
        });
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.slot = "trigger";
      trigger.dataset.lightboxPreview = "";
      trigger.append(image());
      const content = document.createElement("template");
      content.setAttribute("slot", "content");
      content.content.append(image());
      const caption = document.createElement("span");
      caption.slot = "caption";
      caption.textContent = scene.title;
      item.append(trigger, content, caption);
      gallery.append(item);
    }
    if (root.hasAttribute("data-filmstrip"))
      gallery.append(document.createElement("app-filmstrip"));
    root.replaceChildren(gallery);
  },
};

export function mountDemos(container: HTMLElement): void {
  for (const root of container.querySelectorAll<HTMLElement>("[data-demo]")) {
    demos[root.dataset.demo!]?.(root);
  }
}
