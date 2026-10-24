import { mountSite } from "../src/site";
import {
  createFluidbox,
  type FluidboxZoomPose,
  itemLabel,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
  type FluidboxItem,
  type FluidboxVideoItem,
} from "@ogdakke/fluidbox";
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
    own: FluidboxCustomItemBase<"own">;
    film: FluidboxCustomItemBase<"film">;
    gated: FluidboxCustomItemBase<"gated">;
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
];

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

Object.assign(window, { slidesFixture: { fluidbox, replaced, hooks, log, poses, gate } });
