import { describe, expect, it } from "vitest";
import { createItemList, toList } from "../src/items";
import { checkItemUrls, isSafeMediaUrl } from "../src/media-url";
import type { FluidboxIframeItem, FluidboxVideoItem } from "../src/public-api";

const frame = (src: string): FluidboxIframeItem => ({
  type: "iframe",
  id: "frame",
  src,
  title: "Embed",
  width: 16,
  height: 9,
});

const video = (src: string, poster?: string): FluidboxVideoItem => ({
  type: "video",
  id: "video",
  src,
  title: "Clip",
  width: 16,
  height: 9,
  ...(poster === undefined ? {} : { poster }),
});

describe("isSafeMediaUrl", () => {
  it("takes http(s), relative and protocol-relative URLs", () => {
    for (const url of [
      "https://www.youtube-nocookie.com/embed/x",
      "http://example.com/",
      "/embed.html",
      "embed.html?a=1",
      "//example.com/x",
      "#top",
    ]) {
      expect(isSafeMediaUrl(url, "iframe"), url).toBe(true);
    }
  });

  it("refuses script, data and other schemes however they are written", () => {
    for (const url of [
      "javascript:parent.pwned=document.domain",
      " JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      "\njavascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "blob:https://example.com/uuid",
      "file:///etc/passwd",
      "about:blank",
      "http://[",
    ]) {
      expect(isSafeMediaUrl(url, "iframe"), url).toBe(false);
    }
  });

  it("lets video play object URLs but not data or script", () => {
    expect(isSafeMediaUrl("blob:https://example.com/uuid", "video")).toBe(true);
    expect(isSafeMediaUrl("data:video/mp4;base64,", "video")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)", "video")).toBe(false);
  });
});

describe("checkItemUrls", () => {
  it("names the field and the URL it refuses", () => {
    expect(() => checkItemUrls(frame("javascript:alert(1)"))).toThrow(
      "The src of fluidbox iframe item frame is not http(s) or relative: javascript:alert(1)",
    );
    expect(() => checkItemUrls(video("/clip.mp4", "javascript:alert(1)"))).toThrow(/poster/);
    expect(() => checkItemUrls(video("/clip.mp4", "/poster.jpg"))).not.toThrow();
  });

  it("checks every source of a video, as its src", () => {
    const clip = (...sources: string[]) => ({
      ...video("/clip.mp4"),
      sources: sources.map((src) => ({ src, type: "video/webm" })),
    });
    expect(() => checkItemUrls(clip("/clip.webm", "blob:https://example.com/uuid"))).not.toThrow();
    expect(() => checkItemUrls(clip("/clip.webm", "javascript:alert(1)"))).toThrow(
      "The source src of fluidbox video item",
    );
    expect(() => toList([clip("data:video/webm;base64,")])).toThrow(TypeError);
  });

  it("leaves images and custom content alone", () => {
    expect(() =>
      checkItemUrls({ type: "image", src: "data:image/png;base64,", alt: "", width: 1, height: 1 }),
    ).not.toThrow();
  });

  it("runs when arrays and lazy lists are read", () => {
    expect(() => toList([frame("javascript:parent.pwned=1")])).toThrow(TypeError);
    const list = createItemList({ count: 1, item: () => frame("data:text/html,x") });
    expect(() => list.get(0)).toThrow(TypeError);
    expect(toList([frame("https://example.com/")]).count).toBe(1);
  });
});
