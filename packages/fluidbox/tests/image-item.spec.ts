import { describe, expect, it } from "vitest";
import { imageItem } from "../src/image-item";

const blur = `data:image/svg+xml;charset=utf-8,%3Csvg viewBox='0 0 4 3'%3E%3C/svg%3E`;

describe("imageItem", () => {
  it("makes an item from next/image's props", () => {
    const full = {
      src: "/_next/image?w=3840",
      srcSet: "/_next/image?w=640 640w, /_next/image?w=3840 3840w",
      sizes: "100vw",
      width: 1800,
      height: 1200,
      alt: "River valley",
      style: { color: "transparent", backgroundImage: `url("${blur}")` },
    };
    const thumb = { ...full, srcSet: "/_next/image?w=640 640w", sizes: "25vw" };
    expect(imageItem(full, thumb)).toEqual({
      type: "img",
      src: "/_next/image?w=3840",
      srcset: "/_next/image?w=640 640w, /_next/image?w=3840 3840w",
      sizes: "100vw",
      alt: "River valley",
      width: 1800,
      height: 1200,
      thumbnail: {
        src: "/_next/image?w=3840",
        srcset: "/_next/image?w=640 640w",
        sizes: "25vw",
        width: 1800,
        height: 1200,
      },
      placeholder: blur,
    });
  });

  it("takes the HTML spelling and string sizes", () => {
    expect(
      imageItem({ src: "/a.jpg", srcset: "/a.jpg 800w", width: "800", height: "600" }),
    ).toEqual({
      type: "img",
      src: "/a.jpg",
      srcset: "/a.jpg 800w",
      alt: "",
      width: 800,
      height: 600,
    });
  });

  it("needs a width and height", () => {
    expect(() => imageItem({ src: "/a.jpg", alt: "A" })).toThrow(TypeError);
  });
});
