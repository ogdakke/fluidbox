import { arraySource } from "@ogdakke/fluidbox";

export { createFluidbox, registerFluidboxElements } from "@ogdakke/fluidbox";

export const source = arraySource([
  {
    id: "bundle-fixture",
    media: {
      type: "image",
      src: "/fixture.jpg",
      alt: "Bundle fixture",
      width: 1,
      height: 1,
    },
  },
]);
