import { idOf } from "./items";
import { isSafeMediaUrl } from "./media-url";
import type { FluidboxItem } from "./public-api";

/** The file Download saves for an item, or null: its `download`, else an image's or a video's own. */
export function fileOf(item: FluidboxItem): { src: string; filename?: string } | null {
  const own = item.download;
  if (own === false) return null;
  const file =
    typeof own === "string"
      ? { src: own }
      : (own ??
        (item.type === "image"
          ? { src: item.zoom?.src ?? item.src }
          : item.type === "video"
            ? { src: item.src }
            : null));
  return file && isSafeMediaUrl(file.src, "video") ? file : null;
}

/** Whether the document lets an element go fullscreen: not on iPhone, where only a video may. */
export function canGoFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

/** Whether Share has a way to share: the share sheet, or the clipboard to copy to. */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && (!!navigator.share || !!navigator.clipboard);
}

/** The name a download saves as: the one given, else the URL's last path segment, else the item's id. */
export function downloadName(item: FluidboxItem, file: { src: string; filename?: string }) {
  if (file.filename) return file.filename;
  try {
    const url = new URL(file.src, location.href);
    if (url.protocol !== "blob:") {
      const last = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      if (last) return last;
    }
  } catch {
    // A URL that doesn't parse names nothing.
  }
  return idOf(item);
}

/** Whether a browser ignores `download` on a link to `href`, and navigates instead. */
export function crossOrigin(href: string) {
  const url = new URL(href, location.href);
  return url.protocol !== "blob:" && url.origin !== location.origin;
}
