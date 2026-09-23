import type { LightboxGallerySource, LightboxSource } from "@ogdakke/fluidbox";

export const source: LightboxGallerySource = {
  count: 3,
  getItem(index) {
    return {
      id: String(index),
      src: index % 2 ? "/second.svg" : "/first.svg",
      thumbnailSrc: index % 2 ? "/second.svg" : "/first.svg",
      alt: `Framework item ${index + 1}`,
      width: index % 2 ? 400 : 600,
      height: index % 2 ? 600 : 400,
    };
  },
};

export const alternateSource: LightboxGallerySource = { ...source, count: 2 };

function runtimeItem(index: number) {
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

export const runtimeSource: LightboxSource<ReturnType<typeof runtimeItem>> = {
  count: 3,
  getItem: runtimeItem,
  getIndex(id) {
    const index = Number(id);
    return Number.isInteger(index) && index >= 0 && index < this.count ? index : null;
  },
};

export const alternateRuntimeSource = { ...runtimeSource, count: 2 };
