/**
 * Build @ogdakke/fluidbox: the core with tsdown, then each framework binding in
 * its own private workspace package, copied into the core's dist as the
 * ./react, ./solid, ./vue and ./angular entries. Each binding imports the core
 * by its public name, so a consumer loads one copy of the runtime.
 */
import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const core = resolve(root, "packages/fluidbox");
const bindings = ["react", "solid", "vue", "angular"] as const;

async function run(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) {
    throw new Error(`${command.join(" ")} failed in ${cwd}`);
  }
}

await run(["bun", "run", "build:core"], core);
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
