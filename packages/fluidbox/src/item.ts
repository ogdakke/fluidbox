import { markedVisualOrigin } from "./origin-geometry";
import type {
  FluidboxImageResource,
  FluidboxImageSource,
  FluidboxItem,
  FluidboxOrigin,
  FluidboxRenderer,
} from "./public-api";

export interface DeclarativeFluidboxDefinition {
  readonly item: FluidboxItem;
  readonly origin: FluidboxOrigin;
  readonly renderer?: readonly [string, FluidboxRenderer];
}

function positiveDimension(element: Element, name: "width" | "height") {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function imageSources(picture: HTMLPictureElement | null): FluidboxImageSource[] | undefined {
  if (!picture) return undefined;
  const sources = Array.from(picture.querySelectorAll<HTMLSourceElement>(":scope > source")).map(
    (source) => ({
      ...(source.media ? { media: source.media } : {}),
      ...(source.type ? { type: source.type } : {}),
      srcset: source.getAttribute("srcset") ?? "",
      ...(source.sizes ? { sizes: source.sizes } : {}),
    }),
  );
  return sources.length ? sources : undefined;
}

function imageResource(image: HTMLImageElement): FluidboxImageResource {
  const picture = image.parentElement instanceof HTMLPictureElement ? image.parentElement : null;
  const sources = imageSources(picture);
  const src = image.getAttribute("src");
  if (!src) throw new TypeError("Declarative lightbox images require an img src attribute.");
  const srcset = image.getAttribute("srcset");
  const width = positiveDimension(image, "width");
  const height = positiveDimension(image, "height");
  return {
    src,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(srcset ? { srcset } : {}),
    ...(image.sizes ? { sizes: image.sizes } : {}),
    ...(sources ? { sources } : {}),
  };
}

function firstContentElement(template: HTMLTemplateElement) {
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('<template slot="content"> must contain one root element.');
  }
  return element;
}

/** A declarative item definition. Its parent fluidbox-gallery owns the viewer controller. */
export class FluidboxItemElement extends HTMLElement {
  /** Override the item opened by this trigger without changing its own item identity. */
  openItemId: string | null = null;

  connectedCallback() {
    queueMicrotask(() => {
      if (!this.isConnected) return;
      const trigger = this.trigger;
      trigger.dataset.fluidboxTrigger = "";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  get itemId() {
    const id = this.getAttribute("item-id")?.trim();
    if (!id) throw new TypeError("<fluidbox-item> requires a non-empty item-id attribute.");
    return id;
  }

  get trigger(): HTMLElement {
    const trigger = Array.from(this.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.getAttribute("slot") === "trigger",
    );
    if (!trigger) {
      throw new TypeError('<fluidbox-item> requires an element with slot="trigger".');
    }
    return trigger;
  }

  get contentTemplate(): HTMLTemplateElement {
    const template = Array.from(this.children).find(
      (child): child is HTMLTemplateElement =>
        child instanceof HTMLTemplateElement && child.getAttribute("slot") === "content",
    );
    if (!template) {
      throw new TypeError('<fluidbox-item> requires a <template slot="content">.');
    }
    return template;
  }

  compile(): DeclarativeFluidboxDefinition {
    const id = this.itemId;
    const trigger = this.trigger;
    const thumbnail = trigger.querySelector<HTMLImageElement>("img") ?? undefined;
    const visual =
      trigger.querySelector<HTMLElement>("[data-fluidbox-origin]") ??
      markedVisualOrigin(trigger) ??
      thumbnail ??
      trigger;
    const origin: FluidboxOrigin = { trigger, visual, thumbnail };
    const template = this.contentTemplate;
    const content = firstContentElement(template);
    const image =
      content instanceof HTMLPictureElement
        ? content.querySelector<HTMLImageElement>(":scope > img")
        : content instanceof HTMLImageElement
          ? content
          : null;
    const caption = this.querySelector<HTMLElement>(":scope > [slot=caption]")?.textContent?.trim();
    const description = this.querySelector<HTMLElement>(
      ":scope > [slot=description]",
    )?.textContent?.trim();
    const metadata = {
      ...(this.getAttribute("placeholder-src")
        ? { placeholder: { src: this.getAttribute("placeholder-src")! } }
        : {}),
      ...(thumbnail
        ? { thumbnail: imageResource(thumbnail), preview: imageResource(thumbnail) }
        : {}),
      ...(caption ? { caption } : {}),
      ...(description ? { description } : {}),
    };

    if (image) {
      const resource = imageResource(image);
      const width = resource.width ?? positiveDimension(content, "width");
      const height = resource.height ?? positiveDimension(content, "height");
      if (!width || !height) {
        throw new TypeError(`Image item ${id} requires width and height on its content img.`);
      }
      return {
        origin,
        item: {
          id,
          media: {
            ...resource,
            type: "image",
            alt: image.alt,
            width,
            height,
          },
          ...metadata,
        },
      };
    }

    if (content instanceof HTMLVideoElement) {
      const width = positiveDimension(content, "width");
      const height = positiveDimension(content, "height");
      const src = content.getAttribute("src");
      if (!src || !width || !height) {
        throw new TypeError(`Video item ${id} requires src, width, and height attributes.`);
      }
      return {
        origin,
        item: {
          id,
          media: {
            type: "video",
            src,
            title: content.getAttribute("aria-label") || content.title || id,
            width,
            height,
            ...(content.poster ? { poster: { src: content.poster } } : {}),
          },
          ...metadata,
        },
      };
    }

    const width = positiveDimension(content, "width") || thumbnail?.width || 1;
    const height = positiveDimension(content, "height") || thumbnail?.height || 1;
    const rendererKey = `fluidbox-item:${id}`;
    return {
      origin,
      item: {
        id,
        media: {
          type: "custom",
          renderer: rendererKey,
          title: this.getAttribute("aria-label") || id,
          width,
          height,
        },
        ...metadata,
      },
      renderer: [
        rendererKey,
        {
          mount({ target }) {
            target.append(template.content.cloneNode(true));
            return () => target.replaceChildren();
          },
        },
      ],
    };
  }
}

if (!customElements.get("fluidbox-item"))
  customElements.define("fluidbox-item", FluidboxItemElement);
