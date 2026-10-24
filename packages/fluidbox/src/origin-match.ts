import type { FluidboxItem, FluidboxOrigin } from "./runtime-types";
import { srcsetCandidates } from "./srcset";

function collect(
  resource:
    | {
        readonly src?: string;
        readonly srcset?: string;
        readonly sources?: readonly { readonly srcset: string }[];
      }
    | undefined,
  add: (src: string) => void,
) {
  if (!resource) return;
  if (resource.src) add(resource.src);
  for (const set of [resource, ...(resource.sources ?? [])]) {
    for (const candidate of srcsetCandidates(set.srcset)) add(candidate.src);
  }
}

/**
 * Whether an origin image shows the item itself. Only then can the opening use
 * it as the slide preview and the flight skip the crossfade.
 */
export function originShowsItem(image: HTMLImageElement | undefined, item: FluidboxItem) {
  if (!image) return false;
  // Without a declared thumbnail, the origin is the only preview there is: a
  // trigger usually shows a smaller copy of the same picture. Declare the
  // thumbnail when it shows something else, so the flight crossfades.
  if (!item.thumbnail) return true;
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
  if (item.type === "image") collect(item, add);
  else if (item.type === "video" && item.poster) add(item.poster);
  // A framework may have just written `src`; `currentSrc` updates once loading starts.
  return [image.currentSrc, image.src].some((src) => !!src && declared.has(src));
}

/** Whether the origin's visual shows the item, so the flight needs no crossfade. */
export function originMatchesItem(origin: FluidboxOrigin | null | undefined, item: FluidboxItem) {
  if (!origin) return false;
  if (origin.thumbnail) return originShowsItem(origin.thumbnail, item);
  // A video origin shows the clip the viewer plays, whichever encoding it picked.
  return (
    item.type === "video" &&
    (origin.visual instanceof HTMLVideoElement || !!origin.visual.querySelector("video"))
  );
}
