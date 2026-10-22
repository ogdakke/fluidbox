import type { FluidboxItem } from "./public-api";

/**
 * The sandbox an iframe item gets when it names none. Embeds such as YouTube,
 * Vimeo and maps keep working, and the page they frame can't navigate the top
 * window, open modals or download. Fullscreen comes from `allow`.
 */
export const IFRAME_SANDBOX_DEFAULT =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation";

/** Any base works: it only gives relative URLs a scheme that passes. */
const BASE = "https://fluidbox.invalid/";

/**
 * Whether a URL may load into the viewer's iframe or video: http(s) and
 * relative URLs, and object URLs for video. The URL parser decides the
 * scheme, so whitespace and case tricks such as ` JaVa\tscript:` count too.
 */
export function isSafeMediaUrl(url: string, kind: "iframe" | "video"): boolean {
  let protocol: string;
  try {
    protocol = new URL(url, BASE).protocol;
  } catch {
    return false;
  }
  return (
    protocol === "https:" || protocol === "http:" || (kind === "video" && protocol === "blob:")
  );
}

/** The first URL of an iframe or video item that may not load, as `[attribute, url]`. */
function unsafeUrl(item: FluidboxItem): readonly [string, string] | undefined {
  if (item.type !== "iframe" && item.type !== "video") return undefined;
  if (!isSafeMediaUrl(item.src, item.type)) return ["src", item.src];
  if (item.type === "video" && item.poster !== undefined && !isSafeMediaUrl(item.poster, "video"))
    return ["poster", item.poster];
  return undefined;
}

/** Whether every URL of the item may load into the viewer. */
export const hasSafeUrls = (item: FluidboxItem): boolean => !unsafeUrl(item);

/** Throw a TypeError when an iframe or video item points anywhere but http(s). */
export function checkItemUrls(item: FluidboxItem): void {
  const unsafe = unsafeUrl(item);
  if (!unsafe) return;
  const [name, url] = unsafe;
  const allowed = item.type === "video" ? "http(s), blob or relative" : "http(s) or relative";
  throw new TypeError(
    `The ${name} of fluidbox ${item.type} item ${item.id ?? url} must be an ${allowed} URL: ${url}`,
  );
}
