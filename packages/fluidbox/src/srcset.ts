/** The URLs of a `srcset`, with their width descriptors (0 for none). */
export function srcsetCandidates(srcset: string | undefined): { src: string; width: number }[] {
  if (!srcset) return [];
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter(([src]) => !!src)
    .map(([src, descriptor]) => ({
      src: src!,
      width: descriptor?.endsWith("w") ? Number.parseFloat(descriptor) : 0,
    }));
}
