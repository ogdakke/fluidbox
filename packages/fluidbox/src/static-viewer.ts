import { CONTROL_ICON_ATTRIBUTES, CONTROL_ICON_PATHS } from "./control-icons";
import { defaultLabels, type FluidboxLabels } from "./labels";
import type { FluidboxItem } from "./public-api";

/** What the server needs to draw the open viewer. */
export interface FluidboxStaticViewerOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly items: readonly TItem[];
  /** The item on show. */
  readonly index: number;
  readonly labels?: FluidboxLabels;
  readonly loop?: boolean;
  /** Leave room for the filmstrip, which appears once the viewer takes over. */
  readonly filmstrip?: boolean;
  /** Leave room for a sheet's peek, as the viewer does once it takes over. */
  readonly sheet?: boolean;
  /** Draw Previous, Next and Close. Off when you draw your own viewer, as the viewer does. */
  readonly controls?: boolean;
  /** Without it, the copy takes the page's direction. */
  readonly dir?: "ltr" | "rtl";
  /**
   * The address each control leads to before JavaScript runs: `null` for
   * Close, an index for Previous and Next. Without it the controls are inert
   * buttons until the viewer takes over.
   */
  readonly href?: (index: number | null) => string | undefined;
}

const escape = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const attributes = (values: Record<string, string | number | boolean | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escape(value as string)}"`))
    .join("");

const icon = (name: keyof typeof CONTROL_ICON_PATHS) =>
  `<svg${attributes(CONTROL_ICON_ATTRIBUTES)} data-fluidbox-icon=""><path d="${CONTROL_ICON_PATHS[name]}"></path></svg>`;

/**
 * The open viewer as HTML, for a server to render where the viewer's root is.
 * It uses the viewer's own markup and stylesheet, absolute at the top of the page, and
 * the viewer takes it over once it loads.
 * Render it outside any positioned or transformed element, which it would sit inside. Only image items have one; for any
 * other item this returns `null` and the viewer opens as usual.
 */
export function fluidboxStaticViewer<TItem extends FluidboxItem>({
  items,
  index,
  labels = defaultLabels,
  loop = false,
  filmstrip = false,
  sheet = false,
  controls: showControls = true,
  dir,
  href,
}: FluidboxStaticViewerOptions<TItem>): string | null {
  const item = items[index];
  if (!item || item.type !== "img") return null;
  const count = items.length;
  const position = labels.position(index, count);
  const ratio = item.width / item.height;
  const height = "var(--fluidbox-content-height, var(--fluidbox-height, 100svh))";
  const frameStyle =
    `--fluidbox-item-width: min(100cqw, calc(${height} * ${ratio}));` +
    ` --fluidbox-item-height: min(${(item.height / item.width) * 100}cqw, ${height})`;

  const placeholder = item.placeholder
    ? `<img${attributes({ "data-fluidbox-slide-placeholder": "", alt: "", "aria-hidden": "true", decoding: "sync", src: item.placeholder })}>`
    : "";
  const thumbnail = item.thumbnail;
  const preview = thumbnail
    ? `<img${attributes({
        "data-fluidbox-slide-preview": "",
        "data-fluidbox-image-ready": "",
        alt: "",
        "aria-hidden": "true",
        decoding: "sync",
        srcset: thumbnail.srcset,
        sizes: thumbnail.sizes,
        src: thumbnail.src,
      })}>`
    : "";
  const sources = (item.sources ?? [])
    .map((source) => `<source${attributes({ ...source })}>`)
    .join("");
  const media = `<img${attributes({
    "data-fluidbox-media": "",
    alt: item.alt,
    width: item.width,
    height: item.height,
    draggable: "false",
    decoding: "async",
    fetchpriority: "high",
    style: `--fluidbox-media-aspect: ${item.width} / ${item.height}`,
    srcset: item.srcset,
    sizes: item.sizes,
    src: item.src,
  })}>`;

  const control = (name: "previous" | "next" | "close", target: number | null) => {
    const label = labels[name];
    const link = target === null && name !== "close" ? undefined : href?.(target);
    const disabled = name !== "close" && target === null;
    const common = { [`data-fluidbox-${name}`]: "", "aria-label": label };
    return link && !disabled
      ? `<a${attributes({ ...common, href: link })}>${icon(name)}</a>`
      : `<button${attributes({ ...common, type: "button", disabled })}>${icon(name)}</button>`;
  };
  const step = (by: number) => {
    const next = index + by;
    if (count < 2) return null;
    if (loop) return (next + count) % count;
    return next >= 0 && next < count ? next : null;
  };
  const controls = showControls
    ? control("previous", step(-1)) + control("next", step(1)) + control("close", null)
    : "";
  const strip = filmstrip
    ? `<div data-fluidbox-filmstrip-dock="" data-fluidbox-chrome=""><div${attributes({ "data-fluidbox-filmstrip": "", "aria-label": labels.filmstrip })}><div${attributes({ "data-fluidbox-filmstrip-scroll": "", role: "listbox", "aria-orientation": "horizontal", "aria-label": labels.filmstripList })}></div></div></div>`
    : "";

  return (
    `<div${attributes({ "data-fluidbox-overlay": "", "data-fluidbox-static": "", dir })}>` +
    `<div data-fluidbox-backdrop=""></div>` +
    `<div data-fluidbox-container="">` +
    `<div${attributes({
      "data-fluidbox-dialog": "",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": item.alt || labels.viewer,
      "data-fluidbox-headless": "",
      "data-fluidbox-sheet-host": sheet && "",
      "data-gallery": count > 1,
      "data-fluidbox-status": "open",
      "data-open": "",
    })}>` +
    `<div${attributes({ "data-fluidbox-slides": "", "aria-label": labels.slides })}>` +
    `<div${attributes({ "data-fluidbox-slide": "", role: "group", "aria-label": position, "aria-hidden": "false" })}>` +
    `<div${attributes({ "data-fluidbox-frame": "", "data-fluidbox-image-frame": "", style: frameStyle })}>` +
    placeholder +
    preview +
    `<picture data-fluidbox-picture="" style="display: contents">${sources}${media}</picture>` +
    `</div></div></div>` +
    `<span data-fluidbox-announcer="" role="status" aria-live="polite" aria-atomic="true"></span>` +
    `<div data-fluidbox-portal="">${controls}</div>` +
    `<div data-fluidbox-addons="">${strip}</div>` +
    `</div></div></div>`
  );
}
