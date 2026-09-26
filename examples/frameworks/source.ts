import { arraySource } from "@ogdakke/fluidbox";

function item(index: number) {
  const src = index % 2 ? "/second.svg" : "/first.svg";
  return {
    id: String(index),
    media: {
      type: "image" as const,
      src,
      alt: `Framework item ${index + 1}`,
      width: index % 2 ? 400 : 600,
      height: index % 2 ? 600 : 400,
    },
    thumbnail: { src },
  };
}

export const source = arraySource([item(0), item(1), item(2)]);
export const alternateSource = arraySource([item(0), item(1)]);
export const runtimeSource = source;
export const alternateRuntimeSource = alternateSource;
