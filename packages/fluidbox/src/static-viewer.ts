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
   * Close, an index for Previous and Next. A control without one is drawn but
   * inert until the viewer takes over.
   */
  readonly href?: (index: number | null) => string | undefined;
}

/**
 * An element of the server's copy, by HTML attribute names. A boolean
 * attribute that is on has the value `""`.
 */
export interface FluidboxStaticNode {
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly FluidboxStaticNode[];
}

type Attributes = Record<string, string | number | boolean | undefined>;

const node = (
  tag: string,
  values: Attributes,
  ...children: (FluidboxStaticNode | null)[]
): FluidboxStaticNode => {
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== false)
      attributes[name] = value === true ? "" : String(value);
  }
  return { tag, attributes, children: children.filter((child) => child !== null) };
};

const icon = (name: keyof typeof CONTROL_ICON_PATHS) =>
  node(
    "svg",
    { ...CONTROL_ICON_ATTRIBUTES, "data-fluidbox-icon": "" },
    node("path", { d: CONTROL_ICON_PATHS[name] }),
  );

/**
 * The image's `width` and `height` in its own ratio, scaled past any screen.
 * The copy carries no inline styles, so a strict `style-src` never blocks it:
 * the stylesheet fits the image within the slide by `max-width` and
 * `max-height` alone, which only scale an image down. A page's
 * `--fluidbox-max-upscale` therefore applies once the viewer takes over, not to
 * this copy.
 */
const STATIC_SIZE = 10_000;
const staticSize = (width: number, height: number) => {
  const scale = STATIC_SIZE / Math.min(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * The open viewer as elements, for a framework to render as its own where the
 * viewer's root is. `fluidboxStaticViewer` gives the same as HTML. Only image
 * items have one; for any other item this returns `null`.
 */
export function fluidboxStaticViewerNodes<TItem extends FluidboxItem>({
  items,
  index,
  labels = defaultLabels,
  loop = false,
  filmstrip = false,
  sheet = false,
  controls: showControls = true,
  dir,
  href,
}: FluidboxStaticViewerOptions<TItem>): FluidboxStaticNode | null {
  const item = items[index];
  if (!item || item.type !== "img") return null;
  const count = items.length;
  const position = labels.position(index, count);

  const placeholder = item.placeholder
    ? node("img", {
        "data-fluidbox-slide-placeholder": "",
        alt: "",
        "aria-hidden": "true",
        decoding: "sync",
        src: item.placeholder,
      })
    : null;
  const thumbnail = item.thumbnail;
  const preview = thumbnail
    ? node("img", {
        "data-fluidbox-slide-preview": "",
        "data-fluidbox-image-ready": "",
        alt: "",
        "aria-hidden": "true",
        decoding: "sync",
        srcset: thumbnail.srcset,
        sizes: thumbnail.sizes,
        src: thumbnail.src,
      })
    : null;
  const sources = (item.sources ?? []).map((source) => node("source", { ...source }));
  const media = node("img", {
    "data-fluidbox-media": "",
    alt: item.alt,
    ...staticSize(item.width, item.height),
    draggable: "false",
    decoding: "async",
    fetchpriority: "high",
    srcset: item.srcset,
    sizes: item.sizes,
    src: item.src,
  });

  // Until the viewer takes over, a control is a link where there is an address
  // to go to, and otherwise drawn but inert, so it never offers what it can't do.
  const control = (name: "previous" | "next" | "close", target: number | null) => {
    const label = labels[name];
    const link = target === null && name !== "close" ? undefined : href?.(target);
    const common = { [`data-fluidbox-${name}`]: "", "aria-label": label };
    return link
      ? node("a", { ...common, href: link }, icon(name))
      : node(
          "button",
          { ...common, type: "button", disabled: name !== "close" && target === null, inert: true },
          icon(name),
        );
  };
  const step = (by: number) => {
    const next = index + by;
    if (count < 2) return null;
    if (loop) return (next + count) % count;
    return next >= 0 && next < count ? next : null;
  };
  const controls = showControls
    ? [control("previous", step(-1)), control("next", step(1)), control("close", null)]
    : [];
  // An empty stand-in that keeps the filmstrip's room. Its orientation is what
  // the stylesheet keys the room on; it is hidden, having nothing to offer yet.
  const strip = filmstrip
    ? node(
        "div",
        { "data-fluidbox-filmstrip-dock": "", "data-fluidbox-chrome": "", "aria-hidden": "true" },
        node(
          "div",
          { "data-fluidbox-filmstrip": "" },
          node("div", { "data-fluidbox-filmstrip-scroll": "", "aria-orientation": "horizontal" }),
        ),
      )
    : null;

  // Not a dialog yet: nothing traps focus or hides the page until the viewer
  // takes over, so the copy is a labelled region of the page.
  return node(
    "div",
    { "data-fluidbox-overlay": "", "data-fluidbox-static": "", dir },
    node("div", { "data-fluidbox-backdrop": "" }),
    node(
      "div",
      { "data-fluidbox-container": "" },
      node(
        "div",
        {
          "data-fluidbox-dialog": "",
          role: "region",
          "aria-label": item.alt || labels.viewer,
          "data-fluidbox-headless": "",
          "data-fluidbox-sheet-host": sheet && "",
          "data-gallery": count > 1,
          "data-fluidbox-status": "open",
          "data-open": "",
        },
        node(
          "div",
          { "data-fluidbox-slides": "" },
          node(
            "div",
            {
              "data-fluidbox-slide": "",
              role: "group",
              "aria-label": position,
              "aria-hidden": "false",
            },
            node(
              "div",
              { "data-fluidbox-frame": "", "data-fluidbox-image-frame": "" },
              placeholder,
              preview,
              node("picture", { "data-fluidbox-picture": "" }, ...sources, media),
            ),
          ),
        ),
        node("div", { "data-fluidbox-portal": "" }, ...controls),
        node("div", { "data-fluidbox-addons": "" }, strip),
      ),
    ),
  );
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const VOID = new Set(["img", "source"]);

const html = ({ tag, attributes, children }: FluidboxStaticNode): string => {
  const open = `<${tag}${Object.entries(attributes)
    .map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${escape(value)}"`))
    .join("")}>`;
  return VOID.has(tag) ? open : `${open}${children.map(html).join("")}</${tag}>`;
};

/**
 * The open viewer as HTML, for a server to render where the viewer's root is.
 * It uses the viewer's own markup and stylesheet, absolute at the top of the page, and
 * the viewer takes it over once it loads. It has no inline styles or scripts, so it
 * renders under a strict Content Security Policy.
 * Render it outside any positioned or transformed element, which it would sit inside. Only image
 * items have one; for any other item this returns `null` and the viewer opens as usual.
 */
export function fluidboxStaticViewer<TItem extends FluidboxItem>(
  options: FluidboxStaticViewerOptions<TItem>,
): string | null {
  const root = fluidboxStaticViewerNodes(options);
  return root && html(root);
}
