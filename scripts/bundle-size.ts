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
 * A chunk the viewer loads on a rarely used feature's first use: fullscreen,
 * download and share, or a slide's zoom pose.
 */
const isOnDemand = (chunk: { facadeModuleId?: string | null } | undefined) =>
  !!chunk?.facadeModuleId && /[/\\](viewer-actions|zoom-pose)\.[jt]s$/.test(chunk.facadeModuleId);

/**
 * Build `tests/bundle/<name>.ts` as a consumer would and walk its chunk graph. Initial is what
 * the entry imports statically; activation adds what opening a viewer loads, minus add-ons,
 * which load only for a viewer that uses them, and on-demand features, which load on first
 * use. Reachable is activation and on demand together.
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
  const onDemandRoots = new Set<string>();
  const onDemand = new Set<string>();
  const visitActivation = (fileName: string, into = visited): void => {
    if (visited.has(fileName) || into.has(fileName)) return;
    into.add(fileName);
    const chunk = byName.get(fileName);
    if (!chunk) throw new Error(`${name}: missing emitted chunk ${fileName}`);
    for (const imported of [...chunk.imports, ...chunk.dynamicImports]) {
      const lazy = chunk.dynamicImports.includes(imported);
      // An add-on loads only for a viewer that uses it; it has its own budget.
      if (lazy && isAddon(byName.get(imported))) continue;
      if (lazy && isOnDemand(byName.get(imported))) onDemandRoots.add(imported);
      else if (byName.has(imported)) visitActivation(imported, into);
      else if (peerFor(imported)) externals.add(imported);
      else unresolved.add(imported);
    }
  };
  visitInitial(entry.fileName);
  visitActivation(entry.fileName);
  // What the on-demand features load beyond what activation already has.
  for (const fileName of onDemandRoots) visitActivation(fileName, onDemand);

  const initialChunks = [...initial].map((fileName) => byName.get(fileName)!);
  const activationChunks = [...visited].map((fileName) => byName.get(fileName)!);
  // Preserve the concatenated static-graph calculation used by earlier reports.
  const initialJs = sizeOf(initialChunks.map((chunk) => chunk.code).join("\n"));
  const chunkSizes = [...activationChunks, ...[...onDemand].map((f) => byName.get(f)!)].map(
    (chunk) => ({
      fileName: chunk.fileName,
      phase: (initial.has(chunk.fileName)
        ? "initial"
        : onDemand.has(chunk.fileName)
          ? "on demand"
          : "lazy") as "initial" | "lazy" | "on demand",
      ...sizeOf(chunk.code),
    }),
  );
  const total = (phases: readonly string[]) =>
    chunkSizes
      .filter((chunk) => phases.includes(chunk.phase))
      .reduce<Size>(
        (sum, chunk) => ({
          rawBytes: sum.rawBytes + chunk.rawBytes,
          gzipBytes: sum.gzipBytes + chunk.gzipBytes,
        }),
        { rawBytes: 0, gzipBytes: 0 },
      );
  const activationJs = total(["initial", "lazy"]);
  return {
    initialJs,
    activationJs,
    onDemandJs: total(["on demand"]),
    reachableJs: total(["initial", "lazy", "on demand"]),
    chunks: chunkSizes,
    externals,
    unresolved,
    initialCode: initialChunks.map((chunk) => chunk.code).join("\n"),
    activationCode: activationChunks.map((chunk) => chunk.code).join("\n"),
  };
}
