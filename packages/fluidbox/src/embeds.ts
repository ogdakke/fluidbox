/**
 * YouTube and Vimeo facades: a slide shows the video's poster and a play
 * button, and loads the provider's player only when pressed. Safe to import on
 * the server.
 */
import { addStyles, paintPoster, posterStyles } from "./addon-styles";
import { IFRAME_SANDBOX_DEFAULT } from "./iframe-sandbox";
import type {
  FluidboxCustomItemBase,
  FluidboxItem,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** The video sites the embed renderer plays from. */
export type FluidboxEmbedProvider = "youtube" | "vimeo";

/** A YouTube or Vimeo video, drawn by an embed renderer. Make one with `youtubeItem` or `vimeoItem`. */
export interface FluidboxEmbedItem extends FluidboxCustomItemBase<"embed"> {
  readonly id: string;
  readonly provider: FluidboxEmbedProvider;
  /** The provider's id of the video. */
  readonly video: string;
  /** The hash of a private Vimeo link, its `h` parameter. */
  readonly hash?: string;
  /** Where playback starts, in seconds. */
  readonly start?: number;
  /**
   * The poster's URL, shown over the thumbnail once it has loaded. A YouTube
   * video defaults to YouTube's own still. Vimeo has no still at a fixed URL,
   * so give a Vimeo video a `poster` or a `thumbnail`.
   */
  readonly poster?: string;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    embed: FluidboxEmbedItem;
  }
}

/** What `youtubeItem` and `vimeoItem` take besides the video. */
export interface FluidboxEmbedItemOptions {
  /** The video's accessible name, and the iframe's `title`. */
  readonly title: string;
  /** Defaults to the provider and the video's id, as `youtube:M7lc1UVf-VE`. */
  readonly id?: string;
  /** @default 1280, or 720 for a YouTube Short */
  readonly width?: number;
  /** @default 720, or 1280 for a YouTube Short */
  readonly height?: number;
  readonly thumbnail?: FluidboxThumbnail;
  readonly poster?: string;
  /** Where playback starts, in seconds. Overrides a time in the URL. */
  readonly start?: number;
}

const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d+$/;
const VIMEO_HASH = /^[\da-f]+$/i;

/** Seconds from `90`, `90s`, `1m30s` or `1h2m3s`. */
function seconds(value: string | null | undefined) {
  if (!value) return undefined;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
  if (!match || !match[0]) return undefined;
  const [, hours = "0", minutes = "0", rest = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
}

/** A URL from what a person might paste: with or without its scheme. */
function url(source: string) {
  const text = source.trim();
  try {
    return new URL(/^[a-z][\w+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/**
 * Find the video in a YouTube URL or id: watch, youtu.be, shorts, live,
 * embed and nocookie URLs, with a start time from `t` or `start`. Null when
 * it isn't one.
 */
export function parseYouTube(
  source: string,
): { readonly video: string; readonly start?: number; readonly short?: boolean } | null {
  const text = source.trim();
  if (YOUTUBE_ID.test(text)) return { video: text };
  const parsed = url(text);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^(www|m|music)\./, "");
  const path = parsed.pathname.split("/").filter(Boolean);
  let video: string | undefined;
  let short = false;
  if (host === "youtu.be") video = path[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (path[0] === "watch") video = parsed.searchParams.get("v") ?? undefined;
    else if (["embed", "shorts", "live", "v", "e"].includes(path[0] ?? "")) {
      video = path[1];
      short = path[0] === "shorts";
    }
  }
  if (!video || !YOUTUBE_ID.test(video)) return null;
  const start = seconds(parsed.searchParams.get("t") ?? parsed.searchParams.get("start"));
  return { video, ...(start ? { start } : {}), ...(short ? { short } : {}) };
}

/**
 * Find the video in a Vimeo URL or id: vimeo.com pages, channel, group,
 * album and showcase pages, and player URLs, with a private link's hash and a
 * start time from `#t`. Null when it isn't one.
 */
export function parseVimeo(
  source: string,
): { readonly video: string; readonly hash?: string; readonly start?: number } | null {
  const text = source.trim();
  if (VIMEO_ID.test(text)) return { video: text };
  const parsed = url(text);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const path = parsed.pathname.split("/").filter(Boolean);
  // The id follows /video/ in a player's or a showcase's URL, and is the first
  // number in a page's path otherwise. A private link's hash follows it.
  const marker = path.indexOf("video");
  const at = marker >= 0 ? marker + 1 : path.findIndex((part) => VIMEO_ID.test(part));
  const video = path[at];
  if (!video || !VIMEO_ID.test(video)) return null;
  if (marker < 0 && ["showcase", "album"].includes(path[0] ?? "")) return null;
  const after = path[at + 1];
  const hash =
    parsed.searchParams.get("h") ?? (after && VIMEO_HASH.test(after) ? after : undefined);
  const start = seconds(new URLSearchParams(parsed.hash.slice(1)).get("t"));
  return {
    video,
    ...(hash && VIMEO_HASH.test(hash) ? { hash } : {}),
    ...(start ? { start } : {}),
  };
}

function embedItem(
  provider: FluidboxEmbedProvider,
  found: { video: string; hash?: string; start?: number; short?: boolean },
  options: FluidboxEmbedItemOptions,
): FluidboxEmbedItem {
  const start = options.start ?? found.start;
  const poster =
    options.poster ??
    (provider === "youtube" ? `https://i.ytimg.com/vi/${found.video}/hqdefault.jpg` : undefined);
  return {
    type: "embed",
    id: options.id ?? `${provider}:${found.video}`,
    title: options.title,
    width: options.width ?? (found.short ? 720 : 1280),
    height: options.height ?? (found.short ? 1280 : 720),
    provider,
    video: found.video,
    ...(found.hash ? { hash: found.hash } : {}),
    ...(start ? { start } : {}),
    ...(poster ? { poster } : {}),
    ...(options.thumbnail ? { thumbnail: options.thumbnail } : {}),
  };
}

/** A YouTube video from its URL or id. Throws a TypeError for anything else. */
export function youtubeItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem {
  const found = parseYouTube(source);
  if (!found) throw new TypeError(`Not a YouTube video: ${source}`);
  return embedItem("youtube", found, options);
}

/** A Vimeo video from its URL or id. Throws a TypeError for anything else. */
export function vimeoItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem {
  const found = parseVimeo(source);
  if (!found) throw new TypeError(`Not a Vimeo video: ${source}`);
  return embedItem("vimeo", found, options);
}

const origins: Record<FluidboxEmbedProvider, string> = {
  youtube: "https://www.youtube-nocookie.com",
  vimeo: "https://player.vimeo.com",
};

/**
 * The player's URL: YouTube's privacy-enhanced `youtube-nocookie.com`, or
 * `player.vimeo.com` with Do Not Track, always https, with the player's
 * script API on so the slide can pause it.
 */
export function embedUrl(item: FluidboxEmbedItem, { autoplay = true } = {}): string {
  const valid =
    item.provider === "youtube"
      ? YOUTUBE_ID.test(item.video)
      : VIMEO_ID.test(item.video) && (!item.hash || VIMEO_HASH.test(item.hash));
  if (!valid) throw new TypeError(`Not a ${item.provider} video: ${item.video}`);
  const start = item.start && item.start > 0 ? Math.floor(item.start) : 0;
  if (item.provider === "youtube") {
    const url = new URL(`/embed/${item.video}`, origins.youtube);
    url.search = new URLSearchParams({
      ...(autoplay ? { autoplay: "1" } : {}),
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      ...(start ? { start: String(start) } : {}),
    }).toString();
    return url.href;
  }
  const url = new URL(`/video/${item.video}`, origins.vimeo);
  url.search = new URLSearchParams({
    ...(item.hash ? { h: item.hash } : {}),
    ...(autoplay ? { autoplay: "1" } : {}),
    dnt: "1",
  }).toString();
  if (start) url.hash = `t=${start}s`;
  return url.href;
}

/** Whether an item is a YouTube or Vimeo video made for an embed renderer. */
export function isEmbedItem(item: FluidboxItem): item is FluidboxEmbedItem {
  const provider = (item as Partial<FluidboxEmbedItem>).provider;
  return (
    item.type === "embed" &&
    (provider === "youtube" || provider === "vimeo") &&
    typeof (item as Partial<FluidboxEmbedItem>).video === "string"
  );
}

/** What the player may use. Fullscreen comes from `allow`, as the viewer's iframes have it. */
export const EMBED_ALLOW = "autoplay; fullscreen; picture-in-picture; encrypted-media";

/** Ask a player to pause through its postMessage API. */
function pause(frame: HTMLIFrameElement, provider: FluidboxEmbedProvider) {
  const message =
    provider === "youtube"
      ? { event: "command", func: "pauseVideo", args: [] }
      : { method: "pause" };
  frame.contentWindow?.postMessage(JSON.stringify(message), origins[provider]);
}

/** What `createEmbedRenderer` takes. */
export interface FluidboxEmbedRendererOptions {
  /**
   * The play button's accessible name.
   * @default (item) => `Play ${item.title}`
   */
  readonly label?: (item: FluidboxEmbedItem) => string;
}

const embedStyles = `
:where([data-fluidbox-embed] > [data-fluidbox-embed-play]) {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  place-items: center;
  width: 68px;
  height: 48px;
  margin: -24px 0 0 -34px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: rgb(0 0 0 / 0.7);
  color: white;
  cursor: pointer;
}
:where([data-fluidbox-embed] > [data-fluidbox-embed-play]:is(:hover, :focus-visible)) {
  background: rgb(0 0 0 / 0.9);
}
:where([data-fluidbox-embed] > [data-fluidbox-embed-play] > svg) {
  width: 24px;
  height: 24px;
  fill: currentColor;
}
:where([data-fluidbox-embed] > iframe) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
:where([data-fluidbox-embed][data-fluidbox-embed-ready] > [data-fluidbox-media-poster]) {
  visibility: hidden;
}
`;

/**
 * Make a renderer for `youtubeItem` and `vimeoItem` videos. The slide shows
 * the thumbnail, then the poster, and a play button; the player loads, and
 * plays, when the button is pressed. It pauses when the viewer moves to another
 * slide, and goes when the slide unloads.
 */
export function createEmbedRenderer(
  options: FluidboxEmbedRendererOptions = {},
): FluidboxSlideRenderer<FluidboxItem> {
  return ({ item, target, signal, onActiveChange }) => {
    if (!isEmbedItem(item)) {
      throw new TypeError(`The embed renderer draws youtubeItem and vimeoItem videos: ${item.id}`);
    }
    const ownerDocument = target.ownerDocument;
    addStyles(ownerDocument, "embed", posterStyles + embedStyles);
    const box = ownerDocument.createElement("div");
    box.dataset.fluidboxMediaAddon = "";
    box.dataset.fluidboxEmbed = item.provider;
    paintPoster(box, item.thumbnail, item.poster, signal);
    const play = ownerDocument.createElement("button");
    play.type = "button";
    play.dataset.fluidboxEmbedPlay = "";
    play.setAttribute("aria-label", options.label?.(item) ?? `Play ${item.title}`);
    const icon = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const path = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M8 5.5v13l10.5-6.5z");
    icon.append(path);
    play.append(icon);
    box.append(play);
    target.append(box);
    let frame: HTMLIFrameElement | undefined;
    // A closed viewer takes its slides out of the page, and a player put back
    // would load and play again, so the slide goes back to its poster.
    const reset = () => {
      frame?.replaceWith(play);
      frame = undefined;
      delete box.dataset.fluidboxEmbedPlaying;
      delete box.dataset.fluidboxEmbedReady;
    };
    play.addEventListener(
      "click",
      () => {
        if (frame) return;
        frame = ownerDocument.createElement("iframe");
        frame.title = item.title;
        // Policy attributes apply to the navigation that src starts, so they go first.
        frame.allow = EMBED_ALLOW;
        frame.setAttribute("allowfullscreen", "");
        frame.setAttribute("sandbox", IFRAME_SANDBOX_DEFAULT);
        // YouTube won't play an embed that sends no referrer.
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.src = embedUrl(item);
        // The poster stays until the player's page has loaded over it.
        frame.addEventListener("load", () => (box.dataset.fluidboxEmbedReady = ""), {
          once: true,
          signal,
        });
        box.dataset.fluidboxEmbedPlaying = "";
        play.replaceWith(frame);
        frame.focus({ preventScroll: true });
      },
      { signal },
    );
    const stop = onActiveChange((active) => {
      if (active || !frame) return;
      if (box.isConnected) pause(frame, item.provider);
      else reset();
    });
    return () => {
      stop();
      // An iframe out of the document unloads its player at once.
      frame?.remove();
    };
  };
}

/** The embed renderer with the default play label, for `renderers: { embed: renderEmbed }`. */
export const renderEmbed: FluidboxSlideRenderer<FluidboxItem> =
  /* @__PURE__ */ createEmbedRenderer();
