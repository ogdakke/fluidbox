import type { FluidboxImageItem } from "@ogdakke/fluidbox";

/** The plain runtime's items, which the dev server also renders the open copy of. */
export const cspItems: readonly FluidboxImageItem[] = [
  { id: "canyon", type: "image", src: "/art/canyon.svg", alt: "Canyon", width: 1400, height: 1400 },
  {
    id: "portrait",
    type: "image",
    src: "/photo-portrait.svg",
    alt: "Portrait study",
    width: 800,
    height: 1200,
    thumbnail: { src: "/photo-portrait.svg" },
  },
  { id: "dune", type: "image", src: "/art/dune.svg", alt: "Dune", width: 1400, height: 1400 },
];
