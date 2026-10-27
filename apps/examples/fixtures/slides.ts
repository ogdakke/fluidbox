import { mountSite } from "../src/site";
import {
  createFluidbox,
  type FluidboxZoomPose,
  itemLabel,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
  type FluidboxItem,
  type FluidboxSlideOrigin,
  type FluidboxVideoItem,
  videoSlide,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/sheet";
import "@ogdakke/fluidbox/sheet.css";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";

mountSite("fixtures", {
  fixture: "Slides · a product slide and a clip drawing the built-in media, and an unknown type",
});

interface ProductItem extends FluidboxCustomItemBase<"product"> {
  readonly id: string;
  readonly price: number;
  readonly image: FluidboxImageItem;
}

interface ClipItem extends FluidboxCustomItemBase<"clip"> {
  readonly id: string;
  readonly video: FluidboxVideoItem;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    product: ProductItem;
    clip: ClipItem;
    mystery: FluidboxCustomItemBase<"mystery">;
    other: FluidboxCustomItemBase<"other">;
    card: FluidboxCustomItemBase<"card">;
    blank: FluidboxCustomItemBase<"blank">;
    widget: FluidboxCustomItemBase<"widget">;
    own: FluidboxCustomItemBase<"own">;
    film: FluidboxCustomItemBase<"film">;
    gated: FluidboxCustomItemBase<"gated">;
    map: FluidboxCustomItemBase<"map">;
    player: FluidboxCustomItemBase<"player">;
  }
}

/** What the slides did, in order, for the tests. */
const log: string[] = [];

const photo = (id: string, src: string): FluidboxImageItem => ({
  type: "image",
  id,
  src,
  alt: `Photo ${id}`,
  width: 800,
  height: 800,
  thumbnail: { src },
});

const items: FluidboxItem[] = [
  photo("photo", "/photo-square.svg"),
  {
    type: "product",
    id: "product",
    title: "Framed print",
    width: 800,
    height: 800,
    price: 120,
    image: {
      ...photo("product-image", "/products/fjord-room.webp"),
      thumbnail: { src: "/products/fjord-room-thumb.webp" },
    },
    thumbnail: { src: "/products/fjord-room-thumb.webp" },
  },
  {
    type: "clip",
    id: "clip",
    title: "Drift",
    width: 640,
    height: 360,
    video: {
      type: "video",
      id: "drift",
      src: "/video/drift.webm",
      poster: "/video/drift-poster.jpg",
      title: "Drift",
      width: 640,
      height: 360,
      autoplay: true,
      muted: true,
      loop: true,
    },
    thumbnail: { src: "/video/drift-poster.jpg" },
  },
  { type: "mystery", id: "mystery", title: "Mystery", width: 800, height: 600 },
  photo("last", "/photo-portrait.svg"),
];

const fluidbox: Fluidbox = createFluidbox({
  items,
  slides: {
    product: (slide) => {
      log.push(`product mount ${slide.index}`);
      // The built-in image in the box: it flies, loads and fails as a photo's does.
      const undraw = slide.drawImage(slide.item.image);
      const price = document.createElement("p");
      price.className = "slides-price";
      price.textContent = `€${slide.item.price}`;
      slide.media.append(price);
      return () => {
        log.push("product dispose");
        undraw();
      };
    },
    clip: (slide) => {
      log.push(`clip mount ${slide.index}`);
      return slide.drawVideo(slide.item.video);
    },
  },
});

const replacedItems: FluidboxItem[] = [
  photo("one", "/photo-square.svg"),
  { type: "other", id: "other", title: "Other", width: 800, height: 600 },
];

const replaced: Fluidbox = createFluidbox({
  items: replacedItems,
  slides: {
    // Replaces the built-in image slide, and still draws the built-in image.
    image: (slide) => {
      slide.media.dataset.replaced = slide.item.id ?? "";
      slide.drawImage();
    },
    default: (slide) => {
      const text = document.createElement("p");
      text.className = "slides-default";
      text.textContent = `Default slide for ${slide.item.type}`;
      slide.media.append(text);
    },
  },
});

/** Each pose the card's box reported, for the tests. */
const poses: (Omit<FluidboxZoomPose, "visible"> & {
  visible: { x: number; y: number; width: number; height: number };
})[] = [];

const hookItems: FluidboxItem[] = [
  { type: "card", id: "card", title: "Card", width: 800, height: 600 },
  { type: "blank", id: "blank", title: "Blank", width: 800, height: 600 },
  photo("after", "/photo-square.svg"),
  { type: "own", id: "own", title: "Own image", width: 800, height: 800 },
  { type: "film", id: "film", title: "Own video", width: 640, height: 360 },
  { type: "gated", id: "gated", title: "Gated", width: 800, height: 600 },
  { type: "widget", id: "widget", title: "Widget", width: 800, height: 600 },
];

/** A custom element that counts how often it joins the page, as <model-viewer> would mind. */
customElements.define(
  "fixture-widget",
  class extends HTMLElement {
    connectedCallback() {
      this.dataset.connections = String(Number(this.dataset.connections ?? 0) + 1);
    }
  },
);

/** Opens the gated slide's waitUntil promise, and calls waitUntil on it again. */
const gate: { open?: () => void; wait?: (promise: Promise<unknown>) => void } = {};

const hooks: Fluidbox = createFluidbox({
  items: hookItems,
  slides: {
    card: (slide) => {
      const art = document.createElement("div");
      art.className = "slides-card";
      art.style.cssText =
        "width: 100%; height: 100%; background: linear-gradient(45deg, #335, #c96)";
      slide.media.append(art);
      slide.zoomable({ max: 3 });
      const caption = document.createElement("p");
      caption.className = "slides-caption";
      caption.textContent = "Card caption";
      slide.layer.append(caption);
      return slide.onZoom((pose) => {
        const { x, y, width, height } = pose.visible;
        poses.push({ ...pose, visible: { x, y, width, height } });
      });
    },
    // Draws nothing: the open has no picture to fly.
    blank: () => {},
    // Images and videos of its own, which the open waits for.
    own: (slide) => {
      log.push(`own opening ${slide.opening}`);
      const image = document.createElement("img");
      image.alt = "";
      image.src = "/products/fjord-room.webp?own";
      image.style.cssText = "width: 100%; height: 100%; object-fit: contain";
      slide.media.append(image);
    },
    film: (slide) => {
      log.push(`film opening ${slide.opening}`);
      const video = document.createElement("video");
      video.muted = true;
      video.poster = "/video/drift-poster.jpg?own";
      video.src = "/video/drift.webm?own";
      video.style.cssText = "width: 100%; height: 100%";
      slide.media.append(video);
    },
    gated: (slide) => {
      log.push(`gated opening ${slide.opening}`);
      const art = document.createElement("div");
      art.className = "slides-card";
      art.style.cssText = "width: 100%; height: 100%; background: #335";
      slide.media.append(art);
      slide.waitUntil(new Promise<void>((resolve) => (gate.open = resolve)));
      gate.wait = slide.waitUntil;
    },
    widget: (slide) => {
      const widget = document.createElement("fixture-widget");
      widget.style.cssText = "display: block; width: 100%; height: 100%; background: #c96";
      slide.media.append(widget);
    },
  },
});

const clip = (id: string, sources: string[], src: string): FluidboxVideoItem => ({
  type: "video",
  id,
  title: `Clip ${id}`,
  src,
  sources: sources.map((source) => ({ src: source, type: "video/webm" })),
  muted: true,
  width: 640,
  height: 360,
  poster: "/video/drift-poster.jpg",
  thumbnail: { src: "/video/drift-poster.jpg" },
  tracks: [{ src: "/video/drift.vtt", kind: "captions", srclang: "en", label: "English" }],
});

const videoItems: FluidboxItem[] = [
  clip("encoded", ["/video/drift.webm"], "/video/drift.mp4"),
  clip("broken", ["/video/missing.webm"], "/video/missing.mp4"),
  photo("still-1", "/photo-square.svg"),
  photo("still-2", "/photo-square.svg"),
];

const videos: Fluidbox = createFluidbox({ items: videoItems });

/** Each attach and its abort, with the src the video still had as it aborted. */
const attached: string[] = [];

const streamedItems: FluidboxItem[] = [
  { ...clip("stream", [], "/video/drift.mp4"), sources: undefined },
  { ...clip("stream-2", [], "/video/drift.webm"), sources: undefined },
  photo("frame-1", "/photo-square.svg"),
  photo("frame-2", "/photo-square.svg"),
];

const streamed: Fluidbox = createFluidbox({
  items: streamedItems,
  slides: {
    // As an engine would: it loads only once its slide shows or opens, sets
    // the src itself, and lets go as the signal aborts.
    video: videoSlide({
      attach(video, signal, item, slide) {
        attached.push(`attach ${item.id} ${video.querySelectorAll("source").length}`);
        const start = () => {
          if (video.hasAttribute("src")) return;
          attached.push(`load ${item.id}`);
          video.src = item.src;
        };
        if (slide.active || slide.opening) start();
        else {
          const stop = slide.onActiveChange((active) => active && start());
          signal.addEventListener("abort", stop);
        }
        signal.addEventListener("abort", () =>
          attached.push(`abort ${item.id} ${video.getAttribute("src")}`),
        );
      },
    }),
  },
});

/** A map-like slide: it paints the whole box, and its poster keeps its own shape. */
const mapSlide = (slide: { media: HTMLElement; item: FluidboxItem }) => {
  const art = document.createElement("div");
  art.className = "slides-map";
  art.style.cssText = "width: 100%; height: 100%; background: linear-gradient(90deg, #234, #9bd)";
  slide.media.append(art);
};

const filledItems: FluidboxItem[] = [
  // A square poster: the flight starts from the square in the middle of the stage.
  { type: "map", id: "map", title: "Map", fit: "fill", width: 600, height: 600 },
  // No size: the flight starts from the trigger's own shape.
  { type: "map", id: "sky", title: "Sky", fit: "fill" },
  // Images ignore fit.
  { ...photo("photo-fill", "/photo-square.svg"), fit: "fill" },
];

const filled: Fluidbox = createFluidbox({ items: filledItems, slides: { map: mapSlide } });

const sheetedItems: FluidboxItem[] = [
  { type: "map", id: "sheeted-map", title: "Map with details", fit: "fill" },
];

const sheeted: Fluidbox = createFluidbox({
  items: sheetedItems,
  slides: { map: mapSlide },
  sheet: {
    snapPoints: ["50%"],
    render: ({ target }) => target.append("Details of the place"),
  },
});

function grid(selector: string, box: Fluidbox, list: readonly FluidboxItem[]) {
  const root = document.querySelector<HTMLElement>(selector)!;
  for (const item of list) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.item = item.id;
    button.setAttribute("aria-label", `Open ${itemLabel(item)}`);
    const image = document.createElement("img");
    image.alt = "";
    image.src = item.type === "image" ? item.src : (item.thumbnail?.src ?? "/photo-square.svg");
    button.append(image);
    root.append(button);
    box.bind(button, item);
  }
}

grid("#slides", fluidbox, items);
grid("#replaced", replaced, replacedItems);
grid("#hooks", hooks, hookItems);
grid("#videos", videos, videoItems);
grid("#streamed", streamed, streamedItems);
grid("#filled", filled, filledItems);
grid("#sheeted", sheeted, sheetedItems);

/**
 * A player of your own, as Mux's or Vidstack's would be: it reads the trigger
 * video it opened from, and hands a time back as it closes. `returns` says
 * what it registers: a stub at 2.5 s, playing; a function that returns null;
 * or nothing.
 */
const playback = {
  returns: "stub" as "stub" | "null" | "none",
  origins: [] as { index: number; origin: FluidboxSlideOrigin | null }[],
};
const playerItems: FluidboxItem[] = ["film-a", "film-b"].map((id) => ({
  type: "player",
  id,
  title: `Film ${id}`,
  width: 960,
  height: 540,
}));
const player: Fluidbox = createFluidbox({
  items: playerItems,
  slides: {
    player: (slide) => {
      playback.origins.push({ index: slide.index, origin: slide.origin });
      const screen = document.createElement("div");
      screen.className = "player-screen";
      screen.textContent = slide.item.title;
      slide.media.append(screen);
      if (playback.returns === "stub") {
        return slide.returnPlayback({ currentTime: 2.5, paused: false });
      }
      if (playback.returns === "null") return slide.returnPlayback(() => null);
      return undefined;
    },
  },
});
{
  const root = document.querySelector<HTMLElement>("#playback")!;
  for (const item of playerItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.item = item.id;
    button.setAttribute("aria-label", `Open ${itemLabel(item)}`);
    // The first trigger shows a playing clip; the second a still.
    button.innerHTML =
      item.id === "film-a"
        ? `<video data-fluidbox-origin autoplay loop muted playsinline src="/video/drift.webm"></video>`
        : `<img alt="" src="/video/drift-poster.jpg" />`;
    root.append(button);
    player.bind(button, item);
  }
}

Object.assign(window, {
  slidesFixture: {
    player,
    playback,
    fluidbox,
    replaced,
    hooks,
    videos,
    streamed,
    filled,
    sheeted,
    attached,
    log,
    poses,
    gate,
  },
});
