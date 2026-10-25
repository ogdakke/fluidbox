/**
 * The embed add-on for the custom elements: the slide of `embed` items, and a
 * content `<iframe>` whose `src` is a YouTube or Vimeo video read as one, so
 * it opens on its poster and loads the player on Play. Browser only.
 */
import { defineMarkup, defineSlide } from "./elements";
import { embedItem, embedSlide, vimeo, youtube } from "./embed";

defineSlide("embed", embedSlide);
defineMarkup("iframe[src]", (iframe, { id, title, thumbnail, caption }) => {
  const src = iframe.getAttribute("src")!;
  const provider = [youtube, vimeo].find((each) => each.parse(src));
  if (!provider) return null;
  const width = Number(iframe.getAttribute("width")) || undefined;
  const height = Number(iframe.getAttribute("height")) || undefined;
  const item = embedItem(provider, src, {
    id,
    title: iframe.getAttribute("title") || title,
    ...(thumbnail ? { thumbnail } : {}),
    ...(width && height ? { width, height } : {}),
  });
  return caption ? { ...item, caption } : item;
});
