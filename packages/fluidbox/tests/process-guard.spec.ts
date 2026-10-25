import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packages = join(import.meta.dirname, "../..");

/** Every source file of every package, but the tests. */
function* sources(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.(spec|test)\.tsx?$/.test(entry.name)) yield path;
  }
}

describe("process.env.NODE_ENV", () => {
  // A page without a bundler, as a theme's <script type="module"> is, has no
  // process, and a bundler that replaces process.env.NODE_ENV still leaves
  // typeof process "undefined". So each read sits in a try block of its own,
  // written out in place: a production build then folds it away with the code
  // it guards, which it wouldn't do through a shared helper.
  it("is read only inside a try block", () => {
    const raw: string[] = [];
    for (const dir of readdirSync(packages)) {
      let files: string[];
      try {
        files = [...sources(join(packages, dir, "src"))];
      } catch {
        continue;
      }
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(/process\.env\.NODE_ENV/g)) {
          const before = text.slice(0, match.index);
          if (before.lastIndexOf("try {") <= before.lastIndexOf("} catch")) {
            const line = before.split("\n").length;
            raw.push(`${file.slice(packages.length + 1)}:${line}`);
          }
        }
      }
    }
    expect(raw).toEqual([]);
  });
});
