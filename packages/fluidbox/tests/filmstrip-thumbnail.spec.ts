import { describe, expect, it } from "vitest";
import { filmstripThumbnailSources, loadFilmstripThumbnail } from "../src/filmstrip-thumbnail";

describe("filmstrip thumbnail sources", () => {
  it("tries the smallest thumbnail candidates before progressively larger fallbacks", () => {
    expect(
      filmstripThumbnailSources({
        id: "image",
        thumbnail: {
          src: "/thumb.jpg",
          candidates: [
            { src: "/thumb-320.jpg", width: 320 },
            { src: "/thumb-160.jpg", width: 160 },
          ],
        },
        preview: { src: "/preview.jpg" },
        media: {
          type: "image",
          src: "/full.jpg",
          alt: "",
          width: 1200,
          height: 800,
        },
      }),
    ).toEqual(["/thumb-160.jpg", "/thumb-320.jpg", "/thumb.jpg", "/preview.jpg", "/full.jpg"]);
  });

  it("uses a video poster and removes duplicate requests", () => {
    expect(
      filmstripThumbnailSources({
        id: "video",
        thumbnail: { src: "/poster.jpg" },
        media: {
          type: "video",
          src: "/video.mp4",
          title: "Video",
          width: 1920,
          height: 1080,
          poster: { src: "/poster.jpg" },
        },
      }),
    ).toEqual(["/poster.jpg"]);
  });

  it("keeps the preview until a fallback decodes", async () => {
    const attempted: string[] = [];
    class TestImage {
      src = "";
      decode() {
        attempted.push(this.src);
        return this.src === "/missing.jpg"
          ? Promise.reject(new Error("missing"))
          : Promise.resolve();
      }
    }
    const target = {
      src: "/preview.jpg",
      ownerDocument: { defaultView: { Image: TestImage } },
    } as unknown as HTMLImageElement;

    await loadFilmstripThumbnail(
      target,
      ["/missing.jpg", "/fallback.jpg"],
      new AbortController().signal,
    );

    expect(attempted).toEqual(["/missing.jpg", "/fallback.jpg"]);
    expect(target.src).toBe("/fallback.jpg");
  });

  it("does not paint a thumbnail after its virtual item is aborted", async () => {
    let finishDecode: (() => void) | undefined;
    class TestImage {
      src = "";
      decode() {
        return new Promise<void>((resolve) => (finishDecode = resolve));
      }
    }
    const target = {
      src: "/preview.jpg",
      ownerDocument: { defaultView: { Image: TestImage } },
    } as unknown as HTMLImageElement;
    const controller = new AbortController();
    const loading = loadFilmstripThumbnail(target, ["/full.jpg"], controller.signal);

    controller.abort();
    finishDecode?.();
    await loading;

    expect(target.src).toBe("/preview.jpg");
  });
});
