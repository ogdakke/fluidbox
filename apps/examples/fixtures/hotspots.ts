import { mountSite } from "../src/site";
import {
  createFluidbox,
  itemLabel,
  type Fluidbox,
  type FluidboxHotspotOptions,
  type FluidboxImageItem,
  type FluidboxItem,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import type { RoomItem } from "./hotspot-items";

mountSite("fixtures", {
  fixture: "Hotspots · pins on a product photo, contained, letterboxed and in a fill box",
});

/** The photo's points of interest: percentages, and item pixels on its 1600 × 1600. */
const pins: readonly (FluidboxHotspotOptions & { readonly name: string })[] = [
  { name: "Framed print", x: "50%", y: "28%" },
  { name: "Books", x: 360, y: 950 },
  { name: "Plant", x: "69%", y: "52%" },
];

const image: FluidboxImageItem = {
  type: "image",
  id: "room-image",
  src: "/products/fjord-room.webp",
  alt: "A framed fjord print over a sideboard",
  width: 1600,
  height: 1600,
  thumbnail: { src: "/products/fjord-room-thumb.webp" },
};

const room = (id: string, extra: Partial<RoomItem> = {}): RoomItem => ({
  type: "room",
  id,
  title: "Living room",
  width: 1600,
  height: 1600,
  image,
  thumbnail: image.thumbnail,
  parts: [],
  ...extra,
});

function make(items: readonly RoomItem[], scaleWithZoom = false): Fluidbox {
  return createFluidbox({
    items,
    slides: {
      room: (slide) => {
        const undraw = slide.drawImage(slide.item.image);
        slide.zoomable(true);
        for (const { name, ...point } of pins) {
          const pin = slide.hotspot({ ...point, scaleWithZoom });
          pin.className = "hotspot-pin";
          pin.setAttribute("aria-label", name);
          pin.dataset.pin = name;
        }
        return undraw;
      },
    },
  });
}

const sets = {
  room: [room("room")],
  // A 3:2 box around a square photo: object-fit contain leaves bars at the sides.
  wide: [room("wide", { width: 1500, height: 1000 })],
  // The box is the stage; the photo is contained in it.
  filled: [room("filled", { fit: "fill" })],
  growing: [room("growing")],
};

const boxes = {
  room: make(sets.room),
  wide: make(sets.wide),
  filled: make(sets.filled),
  growing: make(sets.growing, true),
};

for (const [key, items] of Object.entries(sets) as [keyof typeof sets, FluidboxItem[]][]) {
  const root = document.querySelector<HTMLElement>(`#${key}`)!;
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.item = item.id;
    button.setAttribute("aria-label", `Open ${itemLabel(item)}`);
    const thumbnail = document.createElement("img");
    thumbnail.alt = "";
    thumbnail.src = "/products/fjord-room-thumb.webp";
    button.append(thumbnail);
    root.append(button);
    boxes[key].bind(button, item);
  }
}

/** A slide that adds a hotspot and leaves it empty, so development builds warn. */
const unnamed = createFluidbox({
  items: [room("unnamed")],
  slides: {
    room: (slide) => {
      slide.drawImage(slide.item.image);
      slide.hotspot({ x: "50%", y: "50%" });
    },
  },
});

/** What a `custom` box draws: its own `<img>`, or none, in a 3:2 box. */
export interface CustomBox {
  /** The image's `object-fit`. @default "contain" */
  readonly fit?: string;
  /** The image's `object-position`. */
  readonly position?: string;
  /** The box's padding. */
  readonly padding?: string;
  /** No image: a canvas, which the pins don't measure. */
  readonly noMedia?: boolean;
  /** The image's width and height attributes. */
  readonly declared?: readonly [number, number];
  /** @default the room photo */
  readonly src?: string;
}

/** A viewer of one 3:2 slide that draws an image of its own as `options` say. */
const custom = (options: CustomBox): Fluidbox =>
  createFluidbox({
    items: [room("custom", { width: 1500, height: 1000 })],
    slides: {
      room: (slide) => {
        const { media } = slide;
        media.style.padding = options.padding ?? "";
        const drawn = document.createElement(options.noMedia ? "canvas" : "img");
        if (drawn instanceof HTMLImageElement) {
          drawn.alt = "";
          drawn.src = options.src ?? image.src;
          if (options.declared) [drawn.width, drawn.height] = options.declared;
        }
        Object.assign(drawn.style, {
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: options.fit ?? "contain",
          objectPosition: options.position ?? "",
        });
        drawn.dataset.custom = "";
        media.append(drawn);
        slide.zoomable(true);
        for (const { name, ...point } of pins) {
          const pin = slide.hotspot(point);
          pin.className = "hotspot-pin";
          pin.setAttribute("aria-label", name);
          pin.dataset.pin = name;
        }
        // Taken out before the hotspots' code is in: it stays out.
        slide.hotspot({ x: "10%", y: "10%" }).remove();
        return () => drawn.remove();
      },
    },
  });

Object.assign(window, { hotspotsFixture: { boxes, pins, unnamed, custom } });
