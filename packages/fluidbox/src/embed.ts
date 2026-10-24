/**
 * Video-site facades: a slide shows the video's poster and a Play button, and
 * loads the provider's player only when pressed. YouTube and Vimeo are two
 * providers made with `createEmbedProvider`, as an app makes its own. Safe to
 * import on the server.
 */
import { addStyles, paintPoster, posterStyles } from "./addon-styles";
import { IFRAME_SANDBOX_DEFAULT } from "./iframe-sandbox";
import { isSafeMediaUrl } from "./media-url";
import type {
  FluidboxCustomItemBase,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** What a provider's `parse` finds in a URL or id. */
export interface FluidboxEmbedVideo {
  /** The provider's id of the video. */
  readonly video: string;
  /** A private link's hash, as Vimeo's `h`. */
  readonly hash?: string;
  /** Where playback starts, in seconds. */
  readonly start?: number;
  /** This video's width / height, when the URL says: a YouTube Short is 9 / 16. */
  readonly aspect?: number;
}

/** What `createEmbedProvider` takes. */
export interface FluidboxEmbedProviderOptions {
  /** Stored on items, so items stay serialisable. Lower case, digits and "-". */
  readonly name: string;
  /** The player's https origin: the postMessage target, checked against `url()`, preconnected. */
  readonly origin: string;
  /** A URL or id, to the video, or null when it isn't this provider's. */
  readonly parse: (source: string) => FluidboxEmbedVideo | null;
  /** The player's URL. It must pass the media URL check and be on `origin`. */
  readonly url: (item: FluidboxEmbedItem, options: { readonly autoplay: boolean }) => string;
  /** A poster when the item has none, as YouTube's still. */
  readonly poster?: (item: FluidboxEmbedItem) => string | undefined;
  /** Pause the player. Without it, leaving the slide unloads the player back to its poster. */
  readonly pause?: (frame: HTMLIFrameElement) => void;
  /** The iframe's `allow`. @default EMBED_ALLOW */
  readonly allow?: string;
  /** The iframe's `sandbox`. @default IFRAME_SANDBOX_DEFAULT */
  readonly sandbox?: string;
  /** @default "strict-origin-when-cross-origin" */
  readonly referrerPolicy?: ReferrerPolicy;
  /** Width / height when neither the item nor `parse` gives one. @default 16 / 9 */
  readonly aspect?: number;
}

/** A video site the embed slide plays from. Make one with `createEmbedProvider`. */
export interface FluidboxEmbedProvider extends Omit<FluidboxEmbedProviderOptions, "url"> {
  /** The player's URL, checked. Throws a TypeError for a URL off `origin`. */
  readonly url: (item: FluidboxEmbedItem, options?: { readonly autoplay?: boolean }) => string;
}

/** A video on a provider's site, drawn by the embed slide. Make one with `embedItem`. */
export interface FluidboxEmbedItem extends FluidboxCustomItemBase<"embed"> {
  readonly id: string;
  /** The provider's name. */
  readonly provider: string;
  /** The provider's id of the video. */
  readonly video: string;
  /** The hash of a private link, as Vimeo's `h` parameter. */
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

/** What `embedItem` takes besides the video. */
export interface FluidboxEmbedItemOptions {
  /** The video's accessible name, and the iframe's `title`. */
  readonly title: string;
  /** Defaults to the provider's name and the video's id, as `youtube:M7lc1UVf-VE`. */
  readonly id?: string;
  /** @default 1280 wide at the video's aspect, or 1280 high for a tall one */
  readonly width?: number;
  readonly height?: number;
  readonly thumbnail?: FluidboxThumbnail;
  readonly poster?: string;
  /** Where playback starts, in seconds. Overrides a time in the URL. */
  readonly start?: number;
}

/** What the player may use. Fullscreen comes from `allow`, as the viewer's iframes have it. */
export const EMBED_ALLOW = "autoplay; fullscreen; picture-in-picture; encrypted-media";

const providerName = /^[a-z0-9-]+$/;

/**
 * Make a provider. Its `url` is checked as it is called: the result must be
 * http(s) and on `origin`, which must be https, or it throws a TypeError and
 * the slide shows its error rather than load a page off the provider's site.
 */
export function createEmbedProvider(options: FluidboxEmbedProviderOptions): FluidboxEmbedProvider {
  const { name, origin } = options;
  if (!providerName.test(name)) {
    throw new TypeError(`An embed provider's name is lower case, digits and "-": ${name}`);
  }
  if (!/^https:$/.test(new URL(origin).protocol) || new URL(origin).origin !== origin) {
    throw new TypeError(`An embed provider's origin is an https origin: ${origin}`);
  }
  return {
    ...options,
    url(item, { autoplay = true } = {}) {
      const href = options.url(item, { autoplay });
      const base = globalThis.location?.href ?? origin;
      if (!isSafeMediaUrl(href, "iframe") || new URL(href, base).origin !== origin) {
        throw new TypeError(`The ${name} player's URL is not on ${origin}: ${href}`);
      }
      return href;
    },
  };
}

/**
 * Make an item from a provider and a URL or id. Throws a TypeError when the
 * provider's `parse` finds nothing.
 */
export function embedItem(
  provider: FluidboxEmbedProvider,
  source: string,
  options: FluidboxEmbedItemOptions,
): FluidboxEmbedItem {
  const found = provider.parse(source);
  if (!found) throw new TypeError(`Not a ${provider.name} video: ${source}`);
  const start = options.start ?? found.start;
  const aspect = found.aspect ?? provider.aspect ?? 16 / 9;
  const item: FluidboxEmbedItem = {
    type: "embed",
    id: options.id ?? `${provider.name}:${found.video}`,
    title: options.title,
    width: options.width ?? Math.round(aspect >= 1 ? 1280 : 1280 * aspect),
    height: options.height ?? Math.round(aspect >= 1 ? 1280 / aspect : 1280),
    provider: provider.name,
    video: found.video,
    ...(found.hash ? { hash: found.hash } : {}),
    ...(start ? { start } : {}),
    ...(options.thumbnail ? { thumbnail: options.thumbnail } : {}),
  };
  const poster = options.poster ?? provider.poster?.(item);
  return poster ? { ...item, poster } : item;
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
function pasted(source: string) {
  const text = source.trim();
  try {
    return new URL(/^[a-z][\w+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

/** A start time the players take: whole seconds, or none. */
const startOf = (item: FluidboxEmbedItem) =>
  item.start && item.start > 0 ? Math.floor(item.start) : 0;

/**
 * YouTube, played from the privacy-enhanced `youtube-nocookie.com` with its
 * script API on, so the slide can pause it. Its `parse` takes watch,
 * youtu.be, shorts, live, embed and nocookie URLs, with a start from `t` or
 * `start`; a Short is 9 / 16.
 */
export const youtube: FluidboxEmbedProvider = /* @__PURE__ */ createEmbedProvider({
  name: "youtube",
  origin: "https://www.youtube-nocookie.com",
  parse(source) {
    const text = source.trim();
    if (YOUTUBE_ID.test(text)) return { video: text };
    const parsed = pasted(text);
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
    return { video, ...(start ? { start } : {}), ...(short ? { aspect: 9 / 16 } : {}) };
  },
  url(item, { autoplay }) {
    if (!YOUTUBE_ID.test(item.video)) throw new TypeError(`Not a youtube video: ${item.video}`);
    const url = new URL(`/embed/${item.video}`, "https://www.youtube-nocookie.com");
    const start = startOf(item);
    url.search = new URLSearchParams({
      ...(autoplay ? { autoplay: "1" } : {}),
      enablejsapi: "1",
      playsinline: "1",
      rel: "0",
      ...(start ? { start: String(start) } : {}),
    }).toString();
    return url.href;
  },
  poster: (item) => `https://i.ytimg.com/vi/${item.video}/hqdefault.jpg`,
  pause: (frame) =>
    frame.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "https://www.youtube-nocookie.com",
    ),
});

/**
 * Vimeo, played from `player.vimeo.com` with Do Not Track. Its `parse` takes
 * vimeo.com pages, channel, group, album and showcase pages and player URLs,
 * with a private link's hash and a start from `#t`.
 */
export const vimeo: FluidboxEmbedProvider = /* @__PURE__ */ createEmbedProvider({
  name: "vimeo",
  origin: "https://player.vimeo.com",
  parse(source) {
    const text = source.trim();
    if (VIMEO_ID.test(text)) return { video: text };
    const parsed = pasted(text);
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
  },
  url(item, { autoplay }) {
    if (!VIMEO_ID.test(item.video) || (item.hash && !VIMEO_HASH.test(item.hash))) {
      throw new TypeError(`Not a vimeo video: ${item.video}`);
    }
    const url = new URL(`/video/${item.video}`, "https://player.vimeo.com");
    url.search = new URLSearchParams({
      ...(item.hash ? { h: item.hash } : {}),
      ...(autoplay ? { autoplay: "1" } : {}),
      dnt: "1",
    }).toString();
    const start = startOf(item);
    if (start) url.hash = `t=${start}s`;
    return url.href;
  },
  pause: (frame) =>
    frame.contentWindow?.postMessage(
      JSON.stringify({ method: "pause" }),
      "https://player.vimeo.com",
    ),
});

/** A YouTube video from its URL or id: `embedItem(youtube, …)`. */
export function youtubeItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem {
  return embedItem(youtube, source, options);
}

/** A Vimeo video from its URL or id: `embedItem(vimeo, …)`. */
export function vimeoItem(source: string, options: FluidboxEmbedItemOptions): FluidboxEmbedItem {
  return embedItem(vimeo, source, options);
}

/** What `createEmbedSlide` takes. */
export interface FluidboxEmbedSlideOptions {
  /** The providers the slide plays. @default [youtube, vimeo] */
  readonly providers?: readonly FluidboxEmbedProvider[];
  /**
   * The Play button's name, and its text when it has no content.
   * @default (item) => `Play ${item.title}`
   */
  readonly label?: (item: FluidboxEmbedItem) => string;
  /** The Play button's content, as the `icons` option makes a control's. Its label becomes `aria-label`. */
  readonly play?: () => Node;
}

// Over the poster, which is absolute too, and centred. Its look is in baseline.css.
const embedStyles = `
/* Centred over the poster at whatever size baseline.css or you give it. */
:where([data-fluidbox-embed] > [data-fluidbox-embed-play]) {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
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

/** Warm the connection to a player's origin, once per document. */
function preconnect(ownerDocument: Document, origin: string) {
  if (ownerDocument.head.querySelector(`link[rel=preconnect][href="${origin}"]`)) return;
  const link = ownerDocument.createElement("link");
  link.rel = "preconnect";
  link.href = origin;
  ownerDocument.head.append(link);
}

/**
 * Make the slide for embed items. It shows the thumbnail, then the poster,
 * and a Play button; the player loads, and plays, when the button is pressed.
 * Leaving the slide pauses a provider that can pause, and unloads one that
 * can't. An item whose provider isn't in `providers` shows the slide's error.
 */
export function createEmbedSlide(
  options: FluidboxEmbedSlideOptions = {},
): FluidboxSlideRenderer<FluidboxEmbedItem> {
  const providers = new Map<string, FluidboxEmbedProvider>();
  for (const provider of options.providers ?? [youtube, vimeo]) {
    if (providers.has(provider.name)) {
      throw new TypeError(`Two embed providers are named ${provider.name}.`);
    }
    providers.set(provider.name, provider);
  }
  return ({ item, media: target, signal, onActiveChange, fail }) => {
    const provider = providers.get(item.provider);
    if (!provider) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`The embed slide has no provider named ${item.provider}, for ${item.id}.`);
      }
      fail(new TypeError(`No embed provider named ${item.provider}`));
      return;
    }
    const ownerDocument = target.ownerDocument;
    addStyles(ownerDocument, "embed", posterStyles + embedStyles);
    preconnect(ownerDocument, provider.origin);
    const box = ownerDocument.createElement("div");
    box.dataset.fluidboxMediaAddon = "";
    box.dataset.fluidboxEmbed = provider.name;
    paintPoster(box, item.thumbnail, item.poster, signal);
    const play = ownerDocument.createElement("button");
    play.type = "button";
    play.dataset.fluidboxEmbedPlay = "";
    const label = options.label?.(item) ?? `Play ${item.title}`;
    const content = options.play?.();
    if (content) {
      play.setAttribute("aria-label", label);
      play.append(content);
    } else {
      // Its label is its text and its name; baseline.css draws a glyph over it.
      play.dataset.fluidboxDefault = "";
      play.textContent = label;
    }
    box.append(play);
    target.append(box);
    let frame: HTMLIFrameElement | undefined;
    // Back to the poster: a closed viewer takes its slides out of the page, and
    // a player put back would load and play again.
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
        let src: string;
        try {
          src = provider.url(item);
        } catch (error) {
          fail(error);
          return;
        }
        frame = ownerDocument.createElement("iframe");
        frame.title = item.title;
        // Policy attributes apply to the navigation that src starts, so they go first.
        frame.allow = provider.allow ?? EMBED_ALLOW;
        frame.setAttribute("allowfullscreen", "");
        frame.setAttribute("sandbox", provider.sandbox ?? IFRAME_SANDBOX_DEFAULT);
        // YouTube won't play an embed that sends no referrer.
        frame.referrerPolicy = provider.referrerPolicy ?? "strict-origin-when-cross-origin";
        frame.src = src;
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
      if (box.isConnected && provider.pause) provider.pause(frame);
      else reset();
    });
    return () => {
      stop();
      // An iframe out of the document unloads its player at once.
      frame?.remove();
    };
  };
}

/** The embed slide for YouTube and Vimeo, with the default Play label: `slides: { embed: embedSlide }`. */
export const embedSlide: FluidboxSlideRenderer<FluidboxEmbedItem> =
  /* @__PURE__ */ createEmbedSlide();
