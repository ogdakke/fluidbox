import type { FluidboxCustomItemBase, FluidboxImageItem } from "@ogdakke/fluidbox";

/** A product whose slide draws its photo and pins two of its parts, for each binding's fixture. */
export interface RoomItem extends FluidboxCustomItemBase<"room"> {
  readonly id: string;
  readonly image: FluidboxImageItem;
  readonly parts: readonly {
    readonly id: string;
    readonly name: string;
    readonly x: `${number}%` | number;
    readonly y: `${number}%` | number;
  }[];
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    room: RoomItem;
  }
}

export const rooms: RoomItem[] = [
  {
    type: "room",
    id: "room",
    title: "Living room",
    width: 1600,
    height: 1600,
    image: {
      type: "image",
      id: "room-image",
      src: "/products/fjord-room.webp",
      alt: "A framed fjord print over a sideboard",
      width: 1600,
      height: 1600,
    },
    thumbnail: { src: "/products/fjord-room-thumb.webp" },
    parts: [
      { id: "print", name: "Framed print", x: "50%", y: "28%" },
      { id: "books", name: "Books", x: 360, y: 950 },
    ],
  },
];
