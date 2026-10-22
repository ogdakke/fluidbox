import { mountSite } from "../src/site";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  FluidboxImageItem,
  FluidboxItem,
  FluidboxOriginAdapter,
  FluidboxSlideRenderer,
} from "@ogdakke/fluidbox";
import { renderEmbed, youtubeItem, type FluidboxEmbedItem } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer, modelItem, type FluidboxModelItem } from "@ogdakke/fluidbox/model";
import { createSpinRenderer, spinItem, type FluidboxSpinItem } from "@ogdakke/fluidbox/spin";
import {
  Fluidbox,
  useFluidbox,
  type FluidboxReactRenderContext,
  type FluidboxReactRenderer,
} from "@ogdakke/fluidbox/react";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { thumbHashToDataURL } from "thumbhash";
import hashes from "./shop-photos.json";
import { Avatar, compact, type Person } from "./social-ui";
import "./safari-chrome.css";
import "./shop.css";

mountSite("fixtures", { fixture: "Shop product page · carousel, dots and a filmstrip column" });

// The product: one print in seven photos. Frame options jump to their photo, as in Shop.

type FrameId = "print" | "canvas" | "black" | "wood" | "white";

type Shot = FluidboxImageItem & { readonly id: string; readonly frame?: FrameId };

/**
 * ?slow holds each photo back on the dev server, the full ones longer than
 * the thumbnails, so the ThumbHash placeholders show as they would on a phone
 * network. ?slow=4000 sets the full photos' delay.
 */
const slow = new URLSearchParams(location.search).get("slow");
const delay = slow === null ? 0 : Number(slow) || 1600;
const delayed = (src: string, ms: number) => (ms ? `${src}?delay=${Math.round(ms)}` : src);

const shot = (name: keyof typeof hashes, alt: string, frame?: FrameId): Shot => ({
  id: `fjord-${name}`,
  type: "img",
  src: delayed(`/products/fjord-${name}.webp`, delay),
  alt,
  width: 1600,
  height: 1600,
  thumbnail: {
    src: delayed(`/products/fjord-${name}-thumb.webp`, delay / 4),
    width: 160,
    height: 160,
  },
  // The 25-byte hash decodes to a 32px PNG, painted at once behind each photo.
  placeholder: thumbHashToDataURL(Uint8Array.from(atob(hashes[name]), (c) => c.charCodeAt(0))),
  frame,
});

const shots: readonly Shot[] = [
  shot("print", "The art print, unframed", "print"),
  shot("room", "The print in a wood frame above a sideboard"),
  shot("detail", "A detail of the print: the low sun over the water"),
  shot("canvas", "The print on gallery canvas", "canvas"),
  shot("black", "The print in a black frame", "black"),
  shot("wood", "The print in a wood frame", "wood"),
  shot("white", "The print in a white frame", "white"),
];

// After the photos, Shop's richer media: a video, the framed print all the way round,
// and a model of it to turn and place in a room.

const video = youtubeItem("https://www.youtube.com/watch?v=M7lc1UVf-VE", {
  id: "fjord-video",
  title: "Video: how the print is made",
  thumbnail: { src: "https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg", width: 320, height: 180 },
});

const spin = spinItem({
  id: "fjord-spin",
  title: "The wood-framed print, all the way round",
  frames: { src: "/products/spin/fjord-{index}.webp", count: 36, digits: 2 },
  width: 800,
  height: 800,
  thumbnail: { src: "/products/spin/fjord-00-thumb.webp", width: 160, height: 160 },
  autoplay: 8,
});

const model = modelItem({
  id: "fjord-model",
  title: "The wood-framed print in 3D",
  src: "/products/fjord-model.glb",
  poster: "/products/fjord-model.webp",
  width: 800,
  height: 800,
  thumbnail: { src: "/products/fjord-model-thumb.webp", width: 160, height: 160 },
  ar: true,
  arModes: "webxr scene-viewer quick-look",
  attributes: { "camera-orbit": "-30deg 80deg auto", "shadow-intensity": "1" },
});

type ShopItem = Shot | FluidboxEmbedItem | FluidboxSpinItem | FluidboxModelItem;

const media: readonly ShopItem[] = [...shots, video, spin, model];

/** The item's name for a card's label. */
const named = (item: ShopItem) => (item.type === "img" ? item.alt : item.title);

/** The picture a card shows: the photo, the video's poster, the spin's first frame or the model's poster. */
const cover = (item: ShopItem) =>
  item.type === "img"
    ? item.src
    : "frames" in item
      ? item.frames[0]!
      : (item.poster ?? item.thumbnail!.src);

/** What a card says it holds besides a photo. */
const badges: Record<string, string> = { embed: "Video", spin: "360°", model: "3D" };

/**
 * The add-ons' renderers draw into an element. A React slide gets a span of
 * its own to draw them into, with the slide's signal and activity.
 */
function addon(render: FluidboxSlideRenderer<FluidboxItem>): FluidboxReactRenderer<ShopItem> {
  return (context) => <AddonSlide render={render} context={context} />;
}

function AddonSlide({
  render,
  context,
}: {
  render: FluidboxSlideRenderer<FluidboxItem>;
  context: FluidboxReactRenderContext<ShopItem>;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const target = ref.current!;
    const controller = new AbortController();
    const dispose = render({
      item: context.item,
      index: context.index,
      target,
      signal: AbortSignal.any([context.signal, controller.signal]),
      get active() {
        return context.active;
      },
      onActiveChange: context.onActiveChange,
    });
    return () => {
      controller.abort();
      dispose?.();
      target.replaceChildren();
    };
  }, [render, context]);
  return <span ref={ref} style={{ display: "contents" }} />;
}

// The model's element loads from a CDN only when a model slide is first on show.
const MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

const renderers = {
  embed: addon(renderEmbed),
  spin: addon(createSpinRenderer()),
  model: addon(createModelRenderer({ load: () => import(/* @vite-ignore */ MODEL_VIEWER) })),
};

const sizes = [
  { id: "9x12", label: "9″ × 12″", price: 32.95 },
  { id: "18x24", label: "18″ × 24″", price: 54.95 },
  { id: "24x36", label: "24″ × 36″", price: 79.95 },
  { id: "30x40", label: "30″ × 40″", price: 109.95 },
  { id: "32x48", label: "32″ × 48″", price: 139.95 },
] as const;

const frames: readonly { id: FrameId; label: string; price: number }[] = [
  { id: "print", label: "Art print", price: 0 },
  { id: "canvas", label: "Gallery canvas", price: 40 },
  { id: "black", label: "Black frame", price: 55 },
  { id: "wood", label: "Wood frame", price: 55 },
  { id: "white", label: "White frame", price: 55 },
];

const store: Person = {
  name: "Foxglove Prints",
  handle: "foxgloveprints",
  seed: 20,
  badge: "gold",
};

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

// Icons, drawn on a 24px grid with a 1.8 stroke like the social fixture's.

const paths = {
  heart:
    "M12 20.5S3.5 15.4 2.4 10.1C1.6 6.4 4 3.6 7.2 3.6c2.1 0 3.6 1.1 4.8 2.8 1.2-1.7 2.7-2.8 4.8-2.8 3.2 0 5.6 2.8 4.8 6.5C20.5 15.4 12 20.5 12 20.5z",
  share:
    "M12 15.5V3m-4.5 4.5L12 3l4.5 4.5M4 14v4.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  star: "M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  home: "M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5",
  grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  box: "M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9",
  cart: "M3 4h2.5l2.2 11h10.6l2-8H7M9.5 20h.01M17 20h.01",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  chevron: "M6 9l6 6 6-6",
  pin: "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  truck:
    "M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.5v2.5h-7M6.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  calendar: "M4 6h16v14H4zM4 10h16M8.5 3.5V7M15.5 3.5V7",
  returns: "M4 9h12a4 4 0 0 1 0 8H8M4 9l4-4M4 9l4 4",
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6",
  arrow: "M5 12h14M13 6l6 6-6 6",
} as const;

type IconName = keyof typeof paths;

function Icon({ name, size = 20, filled }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      className="shop-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// The page's carousel. One trigger per photo; on a phone the next card peeks in
// from the right, on a wide screen one photo fills it and arrows step through.

function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = useCallback((target: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = ref.current;
    const slide = scroller?.children[target] as HTMLElement | undefined;
    if (!scroller || !slide) return;
    const first = scroller.children[0] as HTMLElement;
    scroller.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior });
    // An instant scroll has no scroll end to wait for.
    if (behavior === "instant") setIndex(target);
  }, []);

  const onScroll = useCallback(() => {
    const scroller = ref.current;
    if (!scroller || scroller.children.length < 2) return;
    const stride =
      (scroller.children[1] as HTMLElement).offsetLeft -
      (scroller.children[0] as HTMLElement).offsetLeft;
    const max = scroller.scrollWidth - scroller.clientWidth;
    // At the end the last card can't reach the start edge; count it as shown.
    const next =
      scroller.scrollLeft >= max - 2 ? count - 1 : Math.round(scroller.scrollLeft / stride);
    setIndex(Math.max(0, Math.min(count - 1, next)));
  }, [count]);

  return { ref, index, scrollTo, onScroll };
}

type Carousel = ReturnType<typeof useCarousel>;

/**
 * A photo over its ThumbHash: the placeholder is the box's background, and
 * the image fades in over it once it has loaded.
 */
function Photo({
  item,
  src,
  size,
  origin,
  eager,
  zoom,
}: {
  item: ShopItem;
  src: string;
  size: number;
  origin?: boolean;
  eager?: boolean;
  /** Magnify the photo in place under a resting mouse, as Shop's product page does. */
  zoom?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  // A cached image can finish before React attaches onLoad.
  const ref = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setLoaded(true);
  }, []);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => (zoom && box.current ? hoverZoom(box.current, item) : undefined), [zoom, item]);
  return (
    <span
      ref={box}
      className="shop-photo"
      style={item.placeholder ? { backgroundImage: `url(${item.placeholder})` } : undefined}
    >
      <img
        ref={ref}
        data-fluidbox-origin={origin || undefined}
        data-loaded={loaded || undefined}
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        loading={eager || !origin ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
}

function Gallery({ carousel }: { carousel: Carousel }) {
  const { ref, index, scrollTo, onScroll } = carousel;
  return (
    <div className="shop-gallery">
      {/* Wide screens: a column of thumbnails that steps the carousel, as Shop's does. */}
      <div className="shop-thumbs" role="group" aria-label="Product photos">
        {media.map((item, at) => (
          <button
            key={item.id}
            type="button"
            className="shop-thumb"
            aria-label={`Show ${named(item)}`}
            aria-current={at === index}
            onClick={() => scrollTo(at)}
          >
            <Photo item={item} src={item.thumbnail!.src} size={56} />
          </button>
        ))}
      </div>
      <div className="shop-stage">
        <div className="shop-carousel" ref={ref} onScroll={onScroll}>
          {media.map((item, at) => (
            <Fluidbox.Trigger key={item.id} item={item} asChild>
              <button
                type="button"
                className="shop-slide"
                aria-label={`Open ${at + 1} of ${media.length}: ${named(item)}`}
              >
                <Photo
                  item={item}
                  src={cover(item)}
                  size={item.width}
                  origin
                  eager={at < 2}
                  zoom={item.type === "img"}
                />
                {item.type === "custom" && (
                  <span className="shop-kind" aria-hidden="true">
                    {badges[item.render]}
                  </span>
                )}
              </button>
            </Fluidbox.Trigger>
          ))}
        </div>
        <button
          type="button"
          className="shop-arrow"
          data-side="previous"
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={() => scrollTo(index - 1)}
        >
          <Icon name="back" size={18} />
        </button>
        <button
          type="button"
          className="shop-arrow"
          data-side="next"
          aria-label="Next photo"
          disabled={index === media.length - 1}
          onClick={() => scrollTo(index + 1)}
        >
          <Icon name="next" size={18} />
        </button>
      </div>
    </div>
  );
}

// The viewer. A phone gets Shop's black viewer: close at the top left, a row of
// dots under the photo. A wide screen gets its white one: the thumbnails down
// the left, close at the top right, the arrows in the bottom-right corner.

/** Instagram's dots: five at most, the end ones shrunk while more lie beyond. */
const DOTS = 5;

function Dots() {
  const index = useFluidbox((state) => state.index);
  const count = useFluidbox((state) => state.count);
  if (index === null || count < 2) return null;
  const start = Math.max(0, Math.min(index - Math.floor(DOTS / 2), count - DOTS));
  return (
    <div className="shop-dots" aria-hidden="true">
      <div
        className="shop-dots__track"
        style={{ "--shop-dots-start": start } as React.CSSProperties}
      >
        {Array.from({ length: count }, (_, at) => {
          const shown = at >= start && at < start + DOTS;
          const edge =
            (at === start && start > 0) || (at === start + DOTS - 1 && start + DOTS < count);
          return (
            <span
              key={at}
              className="shop-dot"
              data-active={at === index || undefined}
              data-size={!shown ? "hidden" : edge ? "small" : "full"}
            />
          );
        })}
      </div>
    </div>
  );
}

/** True while the window is wide: the viewer has a filmstrip down the left instead of dots. */
function useWide() {
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches);
  useEffect(() => {
    const query = matchMedia(WIDE);
    const change = () => setWide(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return wide;
}

const WIDE = "(min-width: 900px)";

/**
 * Shop pans a zoomed photo with the pointer instead of a drag: the photo's
 * left edge meets the window's at the left of the screen, its right edge at
 * the right. Here that is the zoom viewport's own scroll, set from the pointer.
 */
function useHoverPan() {
  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)");
    const move = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType !== "mouse" || event.buttons) return;
      const viewport = document.querySelector<HTMLElement>("[data-fluidbox-zoom-viewport]");
      const media = viewport?.querySelector<HTMLElement>("[data-fluidbox-media]");
      if (!viewport || !media || "grabbing" in viewport.dataset) return;
      const box = viewport.getBoundingClientRect();
      const image = media.getBoundingClientRect();
      const along = (pointer: number, start: number, length: number) =>
        Math.max(0, Math.min(1, (pointer - start) / length));
      const left =
        image.width > box.width
          ? image.left -
            box.left +
            viewport.scrollLeft +
            along(event.clientX, box.left, box.width) * (image.width - box.width)
          : viewport.scrollLeft;
      const top =
        image.height > box.height
          ? image.top -
            box.top +
            viewport.scrollTop +
            along(event.clientY, box.top, box.height) * (image.height - box.height)
          : viewport.scrollTop;
      viewport.scrollTo({ left, top, behavior: "instant" });
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);
}

function ShopViewer() {
  useHoverPan();
  const wide = useWide();
  return (
    <>
      <Fluidbox.Viewer>
        <span className="shop-viewer" hidden />
        <Fluidbox.Close />
        <Dots />
        <Fluidbox.Previous />
        <Fluidbox.Next />
      </Fluidbox.Viewer>
      {/* The package's filmstrip, docked down the left by --fluidbox-filmstrip-position.
        A phone has the dots instead, so the strip is only there on a wide screen. */}
      {wide && <Fluidbox.Filmstrip />}
    </>
  );
}

// The product details.

function Choice<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.id === value)!;
  return (
    <fieldset className="shop-choice">
      <legend>
        <strong>{legend}</strong> <span className="fb-muted">{selected.label}</span>
      </legend>
      <div className="shop-choice__options">
        {options.map((option) => (
          <label key={option.id} className="shop-chip">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={option.id === value}
              onChange={() => onChange(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Quantity({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="shop-quantity">
      <span id="shop-quantity-label">
        <strong>Quantity</strong>
      </span>
      <div className="shop-stepper" role="group" aria-labelledby="shop-quantity-label">
        <button
          type="button"
          aria-label="One fewer"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Icon name="minus" size={16} />
        </button>
        <output aria-live="polite">{value}</output>
        <button
          type="button"
          aria-label="One more"
          disabled={value >= 9}
          onClick={() => onChange(value + 1)}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="shop-section" open>
      <summary>
        {title}
        <Icon name="chevron" size={16} />
      </summary>
      {children}
    </details>
  );
}

function Description() {
  const [more, setMore] = useState(false);
  return (
    <Section title="Description">
      <div className="shop-description" data-more={more || undefined} id="shop-description">
        <p>
          <strong>About the artwork.</strong> The fjord at the end of the blue hour, when the sun
          has dropped behind the far ridge and the water holds the last of the light. Each ridge is
          a shade darker than the one behind it, and the reflection breaks into short lines where a
          breeze crosses the surface.
        </p>
        <p>
          Printed on 230 g/m² matte fine-art paper with archival pigment inks, rated for more than a
          hundred years indoors. Framed prints come ready to hang, with the hardware fitted and a
          shatterproof acrylic front. Gallery canvas is stretched over a 3 cm pine bar and wraps the
          image around its edges.
        </p>
      </div>
      <button
        type="button"
        className="fb-button shop-wide"
        aria-expanded={more}
        aria-controls="shop-description"
        onClick={() => setMore((open) => !open)}
      >
        {more ? "Show less" : "Read more"}
      </button>
    </Section>
  );
}

function Shipping() {
  return (
    <Section title="Shipping and returns">
      <ul className="shop-facts">
        <li>
          <Icon name="pin" size={16} />
          <span>
            Ships to <strong>your address</strong>
          </span>
        </li>
        <li>
          <Icon name="truck" size={16} />
          <span>Free shipping</span>
        </li>
        <li>
          <Icon name="calendar" size={16} />
          <span>Arrives by Fri, Oct 30</span>
        </li>
        <li>
          <Icon name="returns" size={16} />
          <span>
            Returns accepted within 14 days
            <small className="fb-muted">Exceptions may apply. See the full policy.</small>
          </span>
        </li>
      </ul>
      <div className="shop-pair">
        <button type="button" className="fb-button">
          Return policy
        </button>
        <button type="button" className="fb-button">
          Shipping policy
        </button>
      </div>
      <a className="fb-button shop-wide" href="#store">
        <Icon name="link" size={16} />
        Visit {store.name}
      </a>
    </Section>
  );
}

function Seller() {
  return (
    <header className="shop-seller">
      <Avatar person={store} size={40} />
      <span className="shop-seller__name">
        <strong>{store.name}</strong>
        <span className="fb-muted">
          4.8 <Icon name="star" size={12} filled /> ({compact(1_712)})
        </span>
      </span>
      <button type="button" className="shop-icon-button" aria-label="More options">
        <Icon name="more" size={20} />
      </button>
    </header>
  );
}

function Product({ carousel, onAdd }: { carousel: Carousel; onAdd: (count: number) => void }) {
  const [size, setSize] = useState<(typeof sizes)[number]["id"]>("9x12");
  const [frame, setFrame] = useState<FrameId>("print");
  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(false);
  const [added, setAdded] = useState(false);
  const price =
    sizes.find((option) => option.id === size)!.price +
    frames.find((option) => option.id === frame)!.price;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(timer);
  }, [added]);

  const chooseFrame = (next: FrameId) => {
    setFrame(next);
    // Shop shows the photo of the frame you pick.
    const at = shots.findIndex((item) => item.frame === next);
    if (at >= 0) carousel.scrollTo(at);
  };

  const save = (
    <button
      type="button"
      className="shop-icon-button"
      aria-label="Save"
      aria-pressed={saved}
      onClick={() => setSaved((value) => !value)}
    >
      <Icon name="heart" size={20} filled={saved} />
    </button>
  );
  const share = (
    <button type="button" className="shop-icon-button" aria-label="Share">
      <Icon name="share" size={20} />
    </button>
  );

  return (
    <div className="shop-info">
      <div className="shop-title">
        <h1>Fjord in the Blue Hour | Art print</h1>
        <span className="shop-title__actions">
          {save}
          {share}
        </span>
      </div>
      <p className="shop-price">{euro.format(price * quantity)}</p>
      <p className="shop-note">
        <strong>Free</strong> shipping, arrives by Fri, Oct 30
      </p>
      <Choice name="size" legend="Size" options={sizes} value={size} onChange={setSize} />
      <Choice name="frame" legend="Frame" options={frames} value={frame} onChange={chooseFrame} />
      <Quantity value={quantity} onChange={setQuantity} />
      <div className="shop-buy">
        <button
          type="button"
          className="fb-button shop-add"
          onClick={() => {
            onAdd(quantity);
            setAdded(true);
          }}
        >
          {added ? "Added to cart" : "Add to cart"}
        </button>
        <button type="button" className="fb-button fb-button--primary">
          Buy now
        </button>
      </div>
      <div className="shop-pair shop-pair--quiet">
        <button
          type="button"
          className="fb-button"
          aria-pressed={saved}
          onClick={() => setSaved((value) => !value)}
        >
          <Icon name="heart" size={16} filled={saved} />
          {saved ? "Saved" : "Save"}
        </button>
        <button type="button" className="fb-button">
          <Icon name="share" size={16} />
          Share
        </button>
      </div>
      <Description />
      <Shipping />
    </div>
  );
}

/** Shop's floating bars: a tab bar and the cart on a phone, a search field on a wide screen. */
function AppBars({ cart }: { cart: number }) {
  return (
    <>
      <nav className="shop-tabbar" aria-label="App">
        <a className="shop-round" href="/fixtures/" aria-label="Back">
          <Icon name="back" size={20} />
        </a>
        <span className="shop-tabbar__tabs">
          <a href="#home" aria-label="Home" aria-current="page">
            <Icon name="home" size={21} />
          </a>
          <a href="#search" aria-label="Search">
            <Icon name="search" size={21} />
          </a>
          <a href="#browse" aria-label="Browse">
            <Icon name="grid" size={21} />
          </a>
          <a href="#orders" aria-label="Orders">
            <Icon name="box" size={21} />
          </a>
        </span>
        <a className="shop-round shop-round--cart" href="#cart" aria-label={`Cart, ${cart} items`}>
          <Icon name="cart" size={21} />
          {cart > 0 && <span className="shop-badge">{cart}</span>}
        </a>
      </nav>
      <form className="shop-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <input aria-label="Search" placeholder="What are you looking for today?" />
        <button type="submit" aria-label="Search">
          <Icon name="arrow" size={16} />
        </button>
      </form>
    </>
  );
}

function ProductPage() {
  const carousel = useCarousel(media.length);
  const [cart, setCart] = useState(0);
  // The viewer scrolls the carousel to the photo on show, so the close lands
  // on that card and the page is left where the viewer was.
  const origins = useMemo<FluidboxOriginAdapter<ShopItem>>(
    () => ({
      getOrigin: () => null,
      revealOrigin: (_id, index) => carousel.scrollTo(index, "instant"),
    }),
    [carousel.scrollTo],
  );
  return (
    <Fluidbox.Root
      items={media}
      origins={origins}
      renderers={renderers}
      zoom={{ step: 2.5, max: 4 }}
    >
      <article className="shop-page">
        <div className="shop-seller-row">
          <Seller />
        </div>
        <Gallery carousel={carousel} />
        <Product carousel={carousel} onAdd={(count) => setCart((total) => total + count)} />
      </article>
      <ShopViewer />
      <AppBars cart={cart} />
    </Fluidbox.Root>
  );
}

function Findings() {
  return (
    <section className="lab-section shop-findings" id="store">
      <div className="lab-section__head">
        <p className="fb-label">Findings</p>
        <p className="fb-muted">
          Built from the two screen recordings of Shop's product page. What maps onto the package,
          and where the fixture does work of its own.
        </p>
      </div>
      <ol className="findings">
        <li>
          <strong>Carousel and close: fits.</strong> Each card is a trigger. The origin adapter's
          revealOrigin scrolls the carousel to the photo on show while the viewer moves, so the
          closing flight lands on that card and the page stays on it, as Shop leaves it.
        </li>
        <li>
          <strong>Dots: fits.</strong> The dots are viewer content reading index and count from
          useFluidbox. Five show at most, and the end ones shrink while more lie beyond, as in
          Instagram and Shop.
        </li>
        <li>
          <strong>Thumbnail column: CSS.</strong> The filmstrip is viewer content that the page's
          CSS places. --fluidbox-filmstrip-axis: y runs it as a column down the left, over slides
          that cross the whole window; a vertical wheel scrolls it, and up and down step through it.
        </li>
        <li>
          <strong>Placeholders: fits.</strong> Each photo carries a 25-byte ThumbHash, decoded to a
          data URI as the item's placeholder, so the viewer paints it at once behind a photo still
          loading. The page's cards show the same one. Add ?slow to hold the photos back.
        </li>
        <li>
          <strong>Arrows in a corner: CSS.</strong> Previous and Next are the default parts, moved
          under the photo, into the bottom-right corner with a rule of the fixture's own.
        </li>
        <li>
          <strong>Click to zoom: fits.</strong> Shop zooms on one click and zooms out on the next.
          The package does the same for a mouse; touch zooms on a double tap.
        </li>
        <li>
          <strong>Zoom on hover: add-on.</strong> Shop magnifies the photo in the carousel under a
          resting mouse. The fixture calls hoverZoom from @ogdakke/fluidbox/hover-zoom on each card;
          a click still opens the viewer.
        </li>
        <li>
          <strong>Pan with the pointer: fixture code.</strong> Shop pans a zoomed photo by moving
          the mouse, with no drag. The fixture sets the zoom viewport's scroll from the pointer. The
          package pans by dragging, which still works.
        </li>
        <li>
          <strong>Video, 360° and 3D: add-ons.</strong> After the photos come a YouTube video, a
          spin of the framed print and a model of it, from the embeds, spin and model entries. The
          video loads its player only when Play is pressed and pauses when the viewer moves on. A
          drag on the spin or the model turns it instead of swiping, and the model&apos;s element
          loads from a CDN when its slide first shows. Each opens from its card like a photo.
        </li>
        <li>
          <strong>Themes per screen: fits.</strong> The viewer copies --fluidbox-* properties from
          the trigger as it opens, so a media query on the gallery gives the phone a black viewer
          and the wide screen a white one.
        </li>
      </ol>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ProductPage />
    <Findings />
  </React.StrictMode>,
);
