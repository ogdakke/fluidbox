import { readMarkup, type FluidboxMarkupContext } from "./elements-registry";
import { checkItemUrls } from "./media-url";
import type {
  FluidboxCustomItemBase,
  FluidboxItem,
  FluidboxPictureSource,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
  FluidboxVideoTrack,
} from "./public-api";

export interface DeclarativeFluidboxDefinition {
  readonly item: FluidboxItem;
  /** The trigger the item opens from, if it has one. */
  readonly trigger: HTMLElement | null;
  /** The renderer of markup content that is not an image, video or iframe. */
  readonly renderer?: readonly [string, FluidboxSlideRenderer];
  /** The item's own `<template slot="sheet">`. */
  readonly sheet?: HTMLTemplateElement;
}

function dimension(element: Element, name: "width" | "height") {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function pictureSources(picture: HTMLPictureElement | null): FluidboxPictureSource[] | undefined {
  if (!picture) return undefined;
  const sources = Array.from(picture.querySelectorAll<HTMLSourceElement>(":scope > source")).map(
    (source) => ({
      srcset: source.getAttribute("srcset") ?? "",
      ...(source.sizes ? { sizes: source.sizes } : {}),
      ...(source.media ? { media: source.media } : {}),
      ...(source.type ? { type: source.type } : {}),
    }),
  );
  return sources.length ? sources : undefined;
}

function thumbnailOf(image: HTMLImageElement): FluidboxThumbnail | undefined {
  const src = image.getAttribute("src");
  if (!src) return undefined;
  const srcset = image.getAttribute("srcset");
  const sizes = image.getAttribute("sizes");
  const width = dimension(image, "width");
  const height = dimension(image, "height");
  return {
    src,
    ...(srcset ? { srcset } : {}),
    ...(sizes ? { sizes } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

function slotted<TElement extends Element>(
  parent: Element,
  slot: string,
  type: abstract new () => TElement,
): TElement | null {
  return (
    Array.from(parent.children).find(
      (child): child is TElement => child instanceof type && child.getAttribute("slot") === slot,
    ) ?? null
  );
}

/** What `<fluidbox-item>` dispatches before a close flight lands on another item of its `value`. */
export type FluidboxPreviewChangeEvent = CustomEvent<{
  readonly id: string;
  readonly item: FluidboxItem;
}>;

/**
 * An item of its `<fluidbox-gallery>`: a `slot="trigger"` element that opens
 * it, and a `<template slot="content">` holding the `<img>`, `<picture>`,
 * `<video>`, `<iframe>` or other markup the viewer shows.
 *
 * `value` is the item's id. `value="a b c"` adds more items whose close
 * flight returns to this trigger, as a "+3" teaser does for an album. The
 * trigger opens the item it last showed. Before such a flight, the item
 * dispatches `fluidbox-preview-change` with the id and item it lands on;
 * update the trigger's preview synchronously there. The gallery doesn't read
 * changes inside a trigger as changes to its items.
 *
 * A `type` attribute makes the item one of that type's slide, keeping what
 * its content reads as, an image's `src` and `alt` say. Other markup without
 * one gets a slide of its own that shows the markup.
 */
export class FluidboxItemElement extends HTMLElement {
  /** The item's id, then the ids of the items that close back onto its trigger. */
  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
  }

  /** @internal The ids in `value`: the item's own first. */
  get ids(): readonly string[] {
    const ids = this.value.split(/\s+/).filter(Boolean);
    if (!ids.length) throw new TypeError("<fluidbox-item> requires a value: the item's id.");
    return ids;
  }

  /** @internal Called by the gallery before a close flight measures this trigger. */
  previewChange(id: string, item: FluidboxItem) {
    this.dispatchEvent(
      new CustomEvent("fluidbox-preview-change", { detail: { id, item }, bubbles: true }),
    );
  }

  /**
   * The `slot="trigger"` child. An item without one is in the gallery but has
   * no thumbnail of its own, as the rest of an album behind a teaser.
   */
  get trigger(): HTMLElement | null {
    return slotted(this, "trigger", HTMLElement);
  }

  /** @internal The gallery reads the content through `compile`. */
  get contentTemplate(): HTMLTemplateElement {
    const template = slotted(this, "content", HTMLTemplateElement);
    if (!template) throw new TypeError('<fluidbox-item> requires a <template slot="content">.');
    return template;
  }

  /** @internal Called by the gallery to read the item. */
  compile(): DeclarativeFluidboxDefinition {
    const id = this.ids[0]!;
    const trigger = this.trigger;
    const triggerImage = trigger?.querySelector<HTMLImageElement>("img");
    const template = this.contentTemplate;
    const content = template.content.firstElementChild;
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('<template slot="content"> must contain one root element.');
    }
    const sheet = slotted(this, "sheet", HTMLTemplateElement) ?? undefined;
    const thumbnail = triggerImage ? thumbnailOf(triggerImage) : undefined;
    const placeholder = this.getAttribute("placeholder");
    const caption = this.getAttribute("caption");
    const base = {
      id,
      ...(thumbnail ? { thumbnail } : {}),
      ...(placeholder ? { placeholder } : {}),
      ...(caption ? { caption } : {}),
    };
    const type = this.getAttribute("type");
    const done = (read: FluidboxItem): DeclarativeFluidboxDefinition => {
      // Your type wins: the content's fields go to the slide of that type.
      const item =
        type && read.type !== type
          ? ({
              ...read,
              type,
              title:
                (read as { title?: string }).title || (read as { alt?: string }).alt || named(null),
            } as unknown as FluidboxItem)
          : read;
      checkItemUrls(item);
      return { item, trigger, ...(sheet ? { sheet } : {}) };
    };
    const sized = (element: Element, kind: string) => {
      const width = dimension(element, "width");
      const height = dimension(element, "height");
      if (!width || !height) {
        throw new TypeError(`The ${kind} of item ${id} needs width and height attributes.`);
      }
      return { width, height };
    };
    // Without a name of its own, content takes its trigger's, and the id only as a last resort.
    const fallback =
      trigger?.getAttribute("aria-label") || triggerImage?.alt || trigger?.textContent?.trim();
    const named = (name: string | null) => {
      if (name || fallback) return name || fallback!;
      // Development builds only; a page without a bundler has no process.
      try {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `Fluidbox item ${id} has no accessible name; give its content an aria-label.`,
          );
        }
      } catch {}
      return id;
    };
    const source = (element: Element, kind: string) => {
      const src = element.getAttribute("src");
      if (!src) throw new TypeError(`The ${kind} of item ${id} needs a src attribute.`);
      return src;
    };

    // An add-on's reading comes first, as a YouTube iframe is an embed.
    const context: FluidboxMarkupContext = {
      ...base,
      title: content.getAttribute("aria-label") || content.title || fallback || id,
    };
    const read = readMarkup(content, context);
    if (read) return done(read);

    const image =
      content instanceof HTMLPictureElement
        ? content.querySelector<HTMLImageElement>(":scope > img")
        : content instanceof HTMLImageElement
          ? content
          : null;
    if (image) {
      const sources = pictureSources(content instanceof HTMLPictureElement ? content : null);
      const srcset = image.getAttribute("srcset");
      const sizes = image.getAttribute("sizes");
      const zoomSrc = image.dataset.zoomSrc;
      const zoomSrcset = image.dataset.zoomSrcset;
      return done({
        ...base,
        type: "image",
        src: source(image, "img"),
        alt: image.alt,
        ...sized(image, "img"),
        ...(srcset ? { srcset } : {}),
        ...(sizes ? { sizes } : {}),
        ...(sources ? { sources } : {}),
        ...(zoomSrc || zoomSrcset
          ? {
              zoom: {
                ...(zoomSrc ? { src: zoomSrc } : {}),
                ...(zoomSrcset ? { srcset: zoomSrcset } : {}),
              },
            }
          : {}),
      });
    }

    if (content instanceof HTMLVideoElement) {
      const preload = content.getAttribute("preload");
      const poster = content.getAttribute("poster");
      const tracks = Array.from(content.querySelectorAll("track"), (track) => ({
        src: source(track, "track"),
        ...(track.hasAttribute("kind") ? { kind: track.kind as FluidboxVideoTrack["kind"] } : {}),
        ...(track.srclang ? { srclang: track.srclang } : {}),
        ...(track.label ? { label: track.label } : {}),
        ...(track.default ? { default: true } : {}),
      }));
      // HTML's own defaults: a boolean attribute is on when present.
      return done({
        ...base,
        type: "video",
        src: source(content, "video"),
        title: named(content.getAttribute("aria-label") || content.title),
        ...sized(content, "video"),
        ...(poster ? { poster } : {}),
        autoplay: content.hasAttribute("autoplay"),
        loop: content.hasAttribute("loop"),
        muted: content.hasAttribute("muted"),
        playsInline: content.hasAttribute("playsinline"),
        controls: content.hasAttribute("controls"),
        ...(preload === "none" || preload === "metadata" || preload === "auto" ? { preload } : {}),
        ...(tracks.length ? { tracks } : {}),
      });
    }

    // An iframe with a src is iframe media; one with only srcdoc stays custom content.
    if (content instanceof HTMLIFrameElement && content.hasAttribute("src")) {
      const allow = content.getAttribute("allow");
      const referrerPolicy = content.getAttribute("referrerpolicy");
      return done({
        ...base,
        type: "iframe",
        src: source(content, "iframe"),
        title: named(content.title),
        ...sized(content, "iframe"),
        ...(allow ? { allow } : {}),
        ...(referrerPolicy ? { referrerPolicy: referrerPolicy as ReferrerPolicy } : {}),
        ...(content.hasAttribute("sandbox")
          ? { sandbox: content.getAttribute("sandbox") ?? "" }
          : {}),
      });
    }

    // Markup is an item of its type's slide, or has a slide of its own, which
    // the gallery registers under the item's type.
    const key = type || `fluidbox-item:${id}`;
    const markup = {
      ...base,
      type: key,
      title: named(this.getAttribute("aria-label") || content.getAttribute("aria-label")),
      width: dimension(content, "width") || thumbnail?.width || 1,
      height: dimension(content, "height") || thumbnail?.height || 1,
    } satisfies FluidboxCustomItemBase<string> as unknown as FluidboxItem;
    if (type) return done(markup);
    return {
      ...done(markup),
      renderer: [
        key,
        ({ media }) => {
          media.append(template.content.cloneNode(true));
          return () => media.replaceChildren();
        },
      ],
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fluidbox-item": FluidboxItemElement;
  }
  interface HTMLElementEventMap {
    "fluidbox-preview-change": FluidboxPreviewChangeEvent;
  }
}

if (!customElements.get("fluidbox-item"))
  customElements.define("fluidbox-item", FluidboxItemElement);
