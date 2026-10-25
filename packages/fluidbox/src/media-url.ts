import type { FluidboxItem } from "./public-api";

/**
 * Whether a URL may load into the viewer's iframe or video: http(s) and
 * relative URLs, and object URLs for video. The URL parser decides the
 * scheme, so whitespace and case tricks such as ` JaVa\tscript:` count too.
 * Its base only gives relative URLs a scheme that passes.
 */
export function isSafeMediaUrl(url: string, kind: "iframe" | "video"): boolean {
  try {
    const { protocol } = new URL(url, "https://fluidbox.invalid");
    return /^https?:$/.test(protocol) || (kind === "video" && protocol === "blob:");
  } catch {
    return false;
  }
}

/** Throw a TypeError when an iframe or video item points anywhere but http(s). */
export function checkItemUrls(item: FluidboxItem): void {
  if (item.type !== "iframe" && item.type !== "video") return;
  const urls: [string, unknown][] = [
    ["src", item.src],
    ["poster", (item as { poster?: unknown }).poster],
    ...(item.type === "video" ? (item.sources ?? []) : []).map(
      (source) => ["source src", source.src] as [string, unknown],
    ),
    // A video's caption tracks load from where the video may.
    ...(item.type === "video" ? (item.tracks ?? []) : []).map(
      (track) => ["track src", track.src] as [string, unknown],
    ),
  ];
  for (const [name, url] of urls) {
    if (typeof url === "string" && !isSafeMediaUrl(url, item.type)) {
      throw new TypeError(
        (() => {
          try {
            if (process.env.NODE_ENV !== "production")
              return `The ${name} of fluidbox ${item.type} item ${item.id ?? ""} is not http(s) or relative: ${url}`;
          } catch {}
          return "fluidbox";
        })(),
      );
    }
  }
}
