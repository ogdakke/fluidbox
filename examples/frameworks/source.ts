import type { LightboxGallerySource } from "@ogdakke/fluidbox";

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
