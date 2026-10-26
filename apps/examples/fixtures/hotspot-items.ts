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

type Part = RoomItem["parts"][number];

/** The pin the tests add between the two, to see it take its place in the Tab order. */
export const lamp: Part = { id: "lamp", name: "Lamp", x: "30%", y: "60%" };

/** The parts with the lamp after the first. */
export const withLamp = (parts: readonly Part[]): Part[] => [parts[0]!, lamp, ...parts.slice(1)];

declare global {
  interface Window {
    /** Adds the lamp between the slide's pins. */
    addLamp: () => void;
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
