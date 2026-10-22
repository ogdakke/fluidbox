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
  for (const name of ["src", "poster"] as const) {
    const url = (item as Partial<Record<typeof name, unknown>>)[name];
    if (typeof url === "string" && !isSafeMediaUrl(url, item.type)) {
      throw new TypeError(
        `The ${name} of fluidbox ${item.type} item ${item.id ?? ""} is not http(s) or relative: ${url}`,
      );
    }
  }
}
