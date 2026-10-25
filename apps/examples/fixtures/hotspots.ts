import { mountSite } from "../src/site";
import {
  createFluidbox,
  itemLabel,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxHotspotOptions,
  type FluidboxImageItem,
  type FluidboxItem,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";

mountSite("fixtures", {
  fixture: "Hotspots · pins on a product photo, contained, letterboxed and in a fill box",
});

interface RoomItem extends FluidboxCustomItemBase<"room"> {
  readonly id: string;
  readonly image: FluidboxImageItem;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    room: RoomItem;
  }
}

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

Object.assign(window, { hotspotsFixture: { boxes, pins, unnamed } });
