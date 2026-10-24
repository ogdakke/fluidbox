/**
 * Build @ogdakke/fluidbox: the core with tsdown, then each framework binding in
 * its own private workspace package, copied into the core's dist as the
 * ./react, ./solid, ./vue and ./angular entries. Each binding imports the core
 * by its public name, so a consumer loads one copy of the runtime.
 */
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { transform } from "lightningcss";
import { checkBaselineCss } from "./check-baseline-css";

const root = resolve(import.meta.dirname, "..");
const core = resolve(root, "packages/fluidbox");
const bindings = ["react", "solid", "vue", "angular"] as const;

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) {
    throw new Error(`${command.join(" ")} failed in ${cwd}`);
  }
}

// baseline.css is layered and the rest unlayered: a baseline rule on a property
// the functional CSS sets on the same element would be dead.
const deadRules = checkBaselineCss();
if (deadRules.length) throw new Error(deadRules.join("\n"));
await run(["bun", "run", "build:core"], core);
// The stylesheets' comments document them for the CSS reference; consumers get
// the rules alone, minified for the browsers in apps/docs/content/browser-support.md.
const major = (version: number) => version << 16;
const targets = {
  safari: major(18),
  ios_saf: major(18),
  chrome: major(140),
  android: major(140),
  edge: major(140),
  firefox: major(142),
};
for (const name of ["styles.css", "thumbnails.css", "sheet.css", "baseline.css"]) {
  const path = resolve(core, "dist", name);
  const { code } = transform({ filename: name, code: await readFile(path), minify: true, targets });
  await writeFile(path, code);
}
await Promise.all(
  bindings.map((name) => run(["bun", "run", "build"], resolve(root, "packages", name))),
);
for (const name of bindings) {
  const target = resolve(core, "dist", name);
  await rm(target, { recursive: true, force: true });
  await cp(resolve(root, "packages", name, "dist"), target, { recursive: true });
}
await run(["bunx", "publint", "--level", "error"], core);
await run(["bunx", "attw", "--pack", ".", "--profile", "esm-only", "--quiet"], core);
