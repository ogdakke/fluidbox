import { describe, expect, it } from "vitest";
import {
  embedUrl,
  isEmbedItem,
  parseVimeo,
  parseYouTube,
  vimeoItem,
  youtubeItem,
} from "../src/embeds";

const id = "M7lc1UVf-VE";

describe("parseYouTube", () => {
  it.each([
    [id, { video: id }],
    [`https://www.youtube.com/watch?v=${id}`, { video: id }],
    [`https://youtube.com/watch?feature=share&v=${id}`, { video: id }],
    [`https://m.youtube.com/watch?v=${id}&t=90`, { video: id, start: 90 }],
    [`https://music.youtube.com/watch?v=${id}`, { video: id }],
    [`https://www.youtube.com/watch?v=${id}&t=1m30s`, { video: id, start: 90 }],
    [`https://www.youtube.com/watch?v=${id}&t=1h2m3s`, { video: id, start: 3723 }],
    [`https://youtu.be/${id}`, { video: id }],
    [`https://youtu.be/${id}?si=abc&t=42`, { video: id, start: 42 }],
    [`youtu.be/${id}`, { video: id }],
    [`www.youtube.com/watch?v=${id}`, { video: id }],
    [`https://www.youtube.com/shorts/${id}`, { video: id, short: true }],
    [`https://www.youtube.com/embed/${id}?start=30`, { video: id, start: 30 }],
    [`https://www.youtube-nocookie.com/embed/${id}`, { video: id }],
    [`https://www.youtube.com/live/${id}`, { video: id }],
    [`https://www.youtube.com/v/${id}`, { video: id }],
    [`  https://youtu.be/${id}  `, { video: id }],
  ])("finds the video in %s", (source, expected) => {
    expect(parseYouTube(source)).toEqual(expected);
  });

  it.each([
    "",
    "not a video",
    "M7lc1UVf-V",
    "https://www.youtube.com/",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
    `https://example.com/watch?v=${id}`,
    `https://youtube.com.example.com/watch?v=${id}`,
    `https://vimeo.com/${id}`,
  ])("rejects %j", (source) => {
    expect(parseYouTube(source)).toBeNull();
  });
});

describe("parseVimeo", () => {
  it.each([
    ["76979871", { video: "76979871" }],
    ["https://vimeo.com/76979871", { video: "76979871" }],
    ["vimeo.com/76979871", { video: "76979871" }],
    ["https://www.vimeo.com/76979871#t=1m5s", { video: "76979871", start: 65 }],
    ["https://vimeo.com/76979871/8272103f6e", { video: "76979871", hash: "8272103f6e" }],
    [
      "https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0",
      { video: "76979871", hash: "8272103f6e" },
    ],
    ["https://player.vimeo.com/video/76979871", { video: "76979871" }],
    ["https://vimeo.com/channels/staffpicks/76979871", { video: "76979871" }],
    ["https://vimeo.com/groups/shortfilms/videos/76979871", { video: "76979871" }],
    ["https://vimeo.com/showcase/11223/video/76979871", { video: "76979871" }],
    ["https://vimeo.com/album/11223/video/76979871", { video: "76979871" }],
  ])("finds the video in %s", (source, expected) => {
    expect(parseVimeo(source)).toEqual(expected);
  });

  it.each([
    "",
    "abc",
    "https://vimeo.com/",
    "https://vimeo.com/staff",
    "https://vimeo.com/showcase/11223",
    "https://player.vimeo.com/video/abc",
    "https://example.com/76979871",
    "https://vimeo.com.example.com/76979871",
    `https://youtu.be/${id}`,
  ])("rejects %j", (source) => {
    expect(parseVimeo(source)).toBeNull();
  });

  it("drops a hash that isn't hexadecimal", () => {
    expect(parseVimeo("https://player.vimeo.com/video/76979871?h=no%20way")).toEqual({
      video: "76979871",
    });
  });
});

describe("youtubeItem and vimeoItem", () => {
  it("make custom items for the embed renderer", () => {
    const item = youtubeItem(`https://youtu.be/${id}?t=12`, { title: "A talk" });
    expect(item).toEqual({
      type: "custom",
      id: `youtube:${id}`,
      render: "embed",
      title: "A talk",
      width: 1280,
      height: 720,
      provider: "youtube",
      video: id,
      start: 12,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
    expect(isEmbedItem(item)).toBe(true);
  });

  it("stand a Short upright and take the caller's fields over the URL's", () => {
    const thumbnail = { src: "/short.jpg", width: 90, height: 160 };
    const item = youtubeItem(`https://youtube.com/shorts/${id}?t=5`, {
      title: "A Short",
      id: "short",
      start: 7,
      render: "video",
      thumbnail,
    });
    expect(item).toMatchObject({ id: "short", width: 720, height: 1280, start: 7 });
    expect(item.render).toBe("video");
    expect(item.thumbnail).toBe(thumbnail);
  });

  it("give a Vimeo video no poster of its own", () => {
    const item = vimeoItem("https://vimeo.com/76979871/8272103f6e", { title: "A film" });
    expect(item).toMatchObject({ id: "vimeo:76979871", video: "76979871", hash: "8272103f6e" });
    expect(item.poster).toBeUndefined();
  });

  it("throw a TypeError for anything else", () => {
    expect(() => youtubeItem("https://vimeo.com/1", { title: "" })).toThrow(TypeError);
    expect(() => vimeoItem(`https://youtu.be/${id}`, { title: "" })).toThrow(TypeError);
  });

  it("are told apart from other custom items", () => {
    expect(
      isEmbedItem({ type: "custom", id: "x", render: "x", title: "", width: 1, height: 1 }),
    ).toBe(false);
  });
});

describe("embedUrl", () => {
  it("plays YouTube from youtube-nocookie.com with its script API on", () => {
    const item = youtubeItem(id, { title: "", start: 90.5 });
    const url = new URL(embedUrl(item));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe(`/embed/${id}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      autoplay: "1",
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      start: "90",
    });
    expect(new URL(embedUrl(item, { autoplay: false })).searchParams.has("autoplay")).toBe(false);
  });

  it("plays Vimeo from player.vimeo.com with Do Not Track and the private hash", () => {
    const item = vimeoItem("https://vimeo.com/76979871/8272103f6e#t=65", { title: "" });
    const url = new URL(embedUrl(item));
    expect(url.origin).toBe("https://player.vimeo.com");
    expect(url.pathname).toBe("/video/76979871");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      h: "8272103f6e",
      autoplay: "1",
      dnt: "1",
    });
    expect(url.hash).toBe("#t=65s");
  });

  it("refuses an id it didn't parse", () => {
    const item = { ...youtubeItem(id, { title: "" }), video: "../../evil" };
    expect(() => embedUrl(item)).toThrow(TypeError);
    const vimeo = { ...vimeoItem("1", { title: "" }), hash: "?x=1" };
    expect(() => embedUrl(vimeo)).toThrow(TypeError);
  });
});
