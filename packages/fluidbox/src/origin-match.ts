import type {
  FluidboxImageResource,
  FluidboxImageSource,
  FluidboxItem,
  FluidboxOrigin,
} from "./public-api";

function collect(resource: FluidboxImageResource | undefined, add: (src: string) => void) {
  if (!resource) return;
  add(resource.src);
  for (const set of [resource, ...(resource.sources ?? [])] as FluidboxImageSource[]) {
    for (const candidate of set.candidates ?? []) add(candidate.src);
    for (const part of set.srcset?.split(",") ?? []) add(part.trim().split(/\s+/)[0] ?? "");
  }
}

/**
 * Whether an origin image shows the item itself. Only then can the opening use
 * it as the slide preview and the flight skip the crossfade.
 */
export function originShowsItem(image: HTMLImageElement | undefined, item: FluidboxItem) {
  if (!image) return false;
  // Without a declared thumbnail or preview, the origin is the only preview there is.
  if (!item.thumbnail && !item.preview) return true;
  const declared = new Set<string>();
  const add = (src: string) => {
    if (!src) return;
    try {
      declared.add(new URL(src, image.baseURI).href);
    } catch {
      // An unparsable URL cannot match the origin.
    }
  };
  collect(item.thumbnail, add);
  collect(item.preview, add);
  if (item.media.type === "image") collect(item.media, add);
  else if (item.media.type === "video") collect(item.media.poster, add);
  // A framework may have just written `src`; `currentSrc` updates once loading starts.
  return [image.currentSrc, image.src].some((src) => !!src && declared.has(src));
}

/** Whether the origin's visual shows the item, so the flight needs no crossfade. */
export function originMatchesItem(origin: FluidboxOrigin | null | undefined, item: FluidboxItem) {
  if (!origin) return false;
  if (origin.thumbnail) return originShowsItem(origin.thumbnail, item);
  // A video origin shows the clip the viewer plays, whichever encoding it picked.
  return (
    item.media.type === "video" &&
    (origin.visual instanceof HTMLVideoElement || !!origin.visual.querySelector("video"))
  );
}
