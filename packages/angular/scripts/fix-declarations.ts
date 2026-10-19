/**
 * ngc writes the NgModule's declaration imports without an extension
 * (`import * as i1 from "./root"`), which Node's ESM resolution rejects.
 * Give every relative specifier in the declarations its `.js`.
 */
import { Glob } from "bun";

const dist = new URL("../dist/", import.meta.url).pathname;
for await (const file of new Glob("**/*.d.ts").scan(dist)) {
  const path = dist + file;
  const source = await Bun.file(path).text();
  const fixed = source.replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(?<!\.js)(["'])/g, "$1$2.js$3");
  if (fixed !== source) await Bun.write(path, fixed);
}
