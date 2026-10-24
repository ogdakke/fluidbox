import { describe, expect, it } from "vitest";
import type { FluidboxImageItem } from "../src/public-api";
import { fluidboxStaticViewer, fluidboxStaticViewerNodes } from "../src/static-viewer";

const photo = (index: number): FluidboxImageItem => ({
  type: "image",
  id: `photo-${index}`,
  src: `/photos/${index}.jpg`,
  alt: `Photo ${index + 1}`,
  width: 1600,
  height: 900,
  thumbnail: { src: `/thumbs/${index}.jpg` },
});
const items = [photo(0), photo(1), photo(2)];

describe("fluidboxStaticViewer", () => {
  it("has no inline styles, so a strict style-src renders it", () => {
    const html = fluidboxStaticViewer({ items, value: "photo-1", thumbnails: true })!;
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toMatch(/<script|\son[a-z]+=/i);
  });

  it("sizes the image in its ratio, past any screen", () => {
    const html = fluidboxStaticViewer({ items, value: "photo-0" })!;
    expect(html).toMatch(/<img data-fluidbox-media alt="Photo 1" width="17778" height="10000"/);
  });

  it("is a labelled region, not a dialog, until the viewer takes over", () => {
    const html = fluidboxStaticViewer({ items, value: "photo-0" })!;
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("aria-modal");
    expect(html).toContain('role="region" aria-label="Photo 1"');
  });

  it("links the controls it has addresses for and makes the rest inert", () => {
    const linked = fluidboxStaticViewer({
      items,
      value: "photo-0",
      href: (value) => (value === null ? "/photos" : `/photos/${value}`),
    })!;
    expect(linked).toContain('<a data-fluidbox-next aria-label="Next" href="/photos/photo-1">');
    expect(linked).toContain('<a data-fluidbox-close aria-label="Close" href="/photos">');
    expect(linked).toMatch(/<button data-fluidbox-previous [^>]*disabled inert>/);

    const plain = fluidboxStaticViewer({ items, value: "photo-1" })!;
    expect(plain).not.toContain("<a ");
    expect(plain.match(/<button [^>]* inert>/g)).toHaveLength(3);
  });

  it("hides the thumbnails' empty stand-in, with no listbox", () => {
    const html = fluidboxStaticViewer({ items, value: "photo-0", thumbnails: true })!;
    expect(html).not.toContain('role="listbox"');
    expect(html).toContain('data-fluidbox-thumbnails-dock data-fluidbox-chrome aria-hidden="true"');
    expect(html).toContain('aria-orientation="horizontal"');
  });

  it("gives the same copy as elements, and none for other items", () => {
    const root = fluidboxStaticViewerNodes({ items, value: "photo-0" })!;
    expect(root.tag).toBe("div");
    expect(root.attributes).toEqual({ "data-fluidbox-viewer": "", "data-fluidbox-static": "" });
    expect(
      fluidboxStaticViewerNodes({
        items: [
          {
            id: "x",
            type: "iframe",
            src: "/x",
            title: "x",
            width: 1,
            height: 1,
          },
        ],
        value: "x",
      }),
    ).toBeNull();
  });

  it("escapes what it writes", () => {
    const html = fluidboxStaticViewer({
      items: [{ ...photo(0), alt: '"><script>x</script>' }],
      value: "photo-0",
    })!;
    expect(html).not.toContain("<script>");
  });
});
