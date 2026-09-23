import type { LightboxImageResource, LightboxItem } from "./public-api";

function appendResource(target: string[], resource: LightboxImageResource | undefined) {
  if (!resource) return;
  for (const candidate of [...(resource.candidates ?? [])].sort((a, b) => a.width - b.width)) {
    if (!target.includes(candidate.src)) target.push(candidate.src);
  }
  if (!target.includes(resource.src)) target.push(resource.src);
}

export function filmstripThumbnailSources(item: LightboxItem): readonly string[] {
  const sources: string[] = [];
  appendResource(sources, item.thumbnail);
  appendResource(sources, item.preview);
  if (item.media.type === "image") appendResource(sources, item.media);
  else if (item.media.type === "video") appendResource(sources, item.media.poster);
  return sources;
}

export async function loadFilmstripThumbnail(
  target: HTMLImageElement,
  sources: readonly string[],
  signal: AbortSignal,
) {
  const ImageConstructor = target.ownerDocument.defaultView?.Image;
  if (!ImageConstructor) return;
  for (const source of sources) {
    if (signal.aborted) return;
    const loader = new ImageConstructor();
    const abort = () => (loader.src = "");
    signal.addEventListener("abort", abort, { once: true });
    loader.src = source;
    try {
      await loader.decode();
      if (!signal.aborted) target.src = source;
      return;
    } catch {
      // Keep the current preview painted while the next source is decoded.
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
}
