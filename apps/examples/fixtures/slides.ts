import { mountSite } from "../src/site";
import {
  createFluidbox,
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

Object.assign(window, { slidesFixture: { fluidbox, replaced, log } });
