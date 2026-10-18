import { artSrc, scenes } from "../art";

/** Fills an `<app-gallery>` with one `<app-lightbox>` per scene, laid out as justified rows. */
export function mountElements(gallery: HTMLElement): void {
  const filmstrip = gallery.querySelector("app-filmstrip");
  for (const scene of scenes) {
    const item = document.createElement("app-lightbox");
    item.setAttribute("item-id", scene.id);
    item.style.setProperty("--ratio", String(scene.width / scene.height));

    const image = () => {
      const img = document.createElement("img");
      img.src = artSrc(scene);
      img.alt = scene.title;
      img.width = scene.width;
      img.height = scene.height;
      return img;
    };

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.slot = "trigger";
    trigger.append(image());

    const content = document.createElement("template");
    content.setAttribute("slot", "content");
    content.content.append(image());

    const caption = document.createElement("span");
    caption.slot = "caption";
    caption.textContent = scene.title;

    const label = document.createElement("span");
    label.className = "mosaic__label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = scene.title;

    item.append(trigger, content, caption, label);
    gallery.insertBefore(item, filmstrip);
  }
}
