/** The `#region example` parts of a pattern source, in order; the whole file if it has none. */
export function exampleRegions(source: string): string[] {
  const pattern =
    /(?:\/\/|<!--)\s*#region example\s*(?:-->)?\n([\s\S]*?)\n[ \t]*(?:\/\/|<!--)\s*#endregion example/g;
  const regions = [...source.matchAll(pattern)].map((match) => dedent(match[1]!));
  return regions.length ? regions : [source.trim()];
}

function dedent(text: string): string {
  const lines = text.split("\n");
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)![0].length),
  );
  return lines
    .map((line) => line.slice(indent))
    .join("\n")
    .trim();
}
