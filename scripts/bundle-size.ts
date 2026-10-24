// Bundle measurement shared by the budget check and the docs landing page.
import { gzipSync } from "node:zlib";
import { build } from "tsdown";

export const frameworkPeers = ["react", "react-dom", "solid-js", "vue", "@angular/core"] as const;

type Chunk = Extract<
  Awaited<ReturnType<typeof build>>["bundles"][number]["chunks"][number],
  { type: "chunk" }
>;
export type Size = { rawBytes: number; gzipBytes: number };

export const sizeOf = (code: string | Uint8Array): Size => ({
  rawBytes: Buffer.byteLength(code),
  gzipBytes: gzipSync(code).byteLength,
});
const isFrameworkImport = (specifier: string, peer: string): boolean =>
  specifier === peer || specifier.startsWith(`${peer}/`);
export const peerFor = (specifier: string): (typeof frameworkPeers)[number] | undefined =>
  frameworkPeers.find((peer) => isFrameworkImport(specifier, peer));

/**
 * A chunk that loads only for a viewer that uses it: the sheet's or the
 * thumbnails' entry, or the thumbnail overlays' runtime.
 */
const isAddon = (chunk: { facadeModuleId?: string | null } | undefined) =>
  !!chunk?.facadeModuleId &&
  /[/\\](sheet|thumbnails|thumbnail-overlay-runtime)(-entry)?\.[jt]s$/.test(chunk.facadeModuleId);

/**
 * Build `tests/bundle/<name>.ts` as a consumer would and walk its chunk graph. Initial is what
 * the entry imports statically; activation adds what opening a viewer loads, minus add-ons,
 * which load only for a viewer that uses them.
 */
export async function measureEntry(name: string, cwd = process.cwd()) {
  const result = await build({
    cwd,
    entry: `tests/bundle/${name}.ts`,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    dts: false,
    sourcemap: false,
    report: false,
    clean: false,
    write: false,
    logLevel: "silent",
    // A framework and its subpaths, such as solid-js/web, come from the app.
    deps: { neverBundle: (id: string) => !!peerFor(id) },
  });
  const chunks = result.bundles
    .flatMap((bundle) => bundle.chunks)
    .filter((chunk): chunk is Chunk => chunk.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const entry = chunks.find((chunk) => chunk.isEntry);
  if (!entry) throw new Error(`tsdown did not emit an entry for ${name}`);

  const visited = new Set<string>();
  const initial = new Set<string>();
  const externals = new Set<string>();
  const unresolved = new Set<string>();
  const visitInitial = (fileName: string): void => {
    if (initial.has(fileName)) return;
    initial.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) throw new Error(`${name}: missing emitted chunk ${fileName}`);
    for (const imported of chunk.imports) {
      if (byName.has(imported)) visitInitial(imported);
    }
  };
  const visitActivation = (fileName: string): void => {
    if (visited.has(fileName)) return;
    visited.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) throw new Error(`${name}: missing emitted chunk ${fileName}`);
    for (const imported of [...chunk.imports, ...chunk.dynamicImports]) {
      // An add-on loads only for a viewer that uses it; it has its own budget.
      if (chunk.dynamicImports.includes(imported) && isAddon(byName.get(imported))) continue;
      if (byName.has(imported)) visitActivation(imported);
      else if (peerFor(imported)) externals.add(imported);
      else unresolved.add(imported);
    }
  };
  visitInitial(entry.fileName);
  visitActivation(entry.fileName);

  const initialChunks = [...initial].map((fileName) => byName.get(fileName)!);
  const activationChunks = [...visited].map((fileName) => byName.get(fileName)!);
  // Preserve the concatenated static-graph calculation used by earlier reports.
  const initialJs = sizeOf(initialChunks.map((chunk) => chunk.code).join("\n"));
  const chunkSizes = activationChunks.map((chunk) => ({
    fileName: chunk.fileName,
    phase: (initial.has(chunk.fileName) ? "initial" : "lazy") as "initial" | "lazy",
    ...sizeOf(chunk.code),
  }));
  const activationJs = chunkSizes.reduce<Size>(
    (total, chunk) => ({
      rawBytes: total.rawBytes + chunk.rawBytes,
      gzipBytes: total.gzipBytes + chunk.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
  return {
    initialJs,
    activationJs,
    chunks: chunkSizes,
    externals,
    unresolved,
    initialCode: initialChunks.map((chunk) => chunk.code).join("\n"),
    activationCode: activationChunks.map((chunk) => chunk.code).join("\n"),
  };
}
