import type { FluidboxItem } from "./runtime-types";
import { srcsetCandidates } from "./srcset";

/** The resource's width-described candidates, smallest first, then its src. */
function appendResource(
  target: string[],
  resource: { readonly src: string; readonly srcset?: string } | undefined,
) {
  if (!resource) return;
  const candidates = srcsetCandidates(resource.srcset).filter((candidate) => candidate.width > 0);
  for (const candidate of candidates.sort((a, b) => a.width - b.width)) {
    if (!target.includes(candidate.src)) target.push(candidate.src);
  }
  if (!target.includes(resource.src)) target.push(resource.src);
}

export function filmstripThumbnailSources(item: FluidboxItem): readonly string[] {
  const sources: string[] = [];
  appendResource(sources, item.thumbnail);
  if (item.type === "img") appendResource(sources, item);
  else if (item.type === "video" && item.poster) appendResource(sources, { src: item.poster });
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
