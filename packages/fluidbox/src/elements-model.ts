/**
 * The model add-on for the custom elements: the slide of `model` items, and a
 * content `<model-viewer>` read as one, its other attributes kept for the
 * viewer's own. Load `<model-viewer>` yourself, as with Google's `<script>`;
 * the slide waits for it to be defined. For a slide that loads it, set
 * `gallery.slides = { model: createModelSlide({ load }) }`. Browser only.
 */
import { defineMarkup, defineSlide } from "./elements";
import { createModelSlide, modelItem } from "./model";

/** Attributes the item has fields for. */
const fields = new Set(["src", "poster", "alt", "ar", "ar-modes", "ios-src", "width", "height"]);

defineSlide("model", createModelSlide());
defineMarkup("model-viewer", (element, { id, title, thumbnail, caption }) => {
  const read = (name: string) => element.getAttribute(name) ?? undefined;
  const width = Number(read("width")) || undefined;
  const height = Number(read("height")) || undefined;
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .filter(({ name }) => !fields.has(name))
      .map(({ name, value }) => [name, value]),
  );
  return modelItem({
    id,
    title: read("alt") || title,
    src: read("src") ?? "",
    ...(read("poster") ? { poster: read("poster") } : {}),
    ...(element.hasAttribute("ar") ? { ar: true } : {}),
    ...(read("ar-modes") ? { arModes: read("ar-modes") } : {}),
    ...(read("ios-src") ? { iosSrc: read("ios-src") } : {}),
    ...(Object.keys(attributes).length ? { attributes } : {}),
    ...(width && height ? { width, height } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    ...(caption ? { caption } : {}),
  });
});
