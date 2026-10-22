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

/**
 * The candidate to load for `needed` pixels across, when the one on show has
 * `current`: the smallest that has them, else the largest, and only if it has
 * more than `current`. A width of 0 is unknown, and Infinity a master image
 * larger than any.
 */
export function sharperCandidate(
  candidates: readonly { src: string; width: number }[],
  current: number,
  needed: number,
): { src: string; width: number } | undefined {
  if (needed <= current) return undefined;
  const larger = candidates
    .filter((each) => each.width > current)
    .sort((a, b) => a.width - b.width);
  return larger.find((each) => each.width >= needed) ?? larger.at(-1);
}
