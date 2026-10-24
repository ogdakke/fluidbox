// The CSS reference's tables come from the package source, read on every build
// and on every change in dev:
//
//   <!-- css: theme -->        the theme variables
//   <!-- css: inputs -->       the other properties styles.css and thumbnails.css read
//   <!-- css: sheet -->        the properties sheet.css reads
//   <!-- css: published -->    the properties the runtime sets
//   <!-- css: parts -->        the viewer's parts, and the attributes that mark yours
//   <!-- css: sheet-parts -->  the sheet's parts
//   <!-- css: states -->       the state attributes
//
// Names after the table's name keep the rows whose names are all among them:
// `<!-- css: parts data-fluidbox-viewer data-fluidbox-dialog -->`.
//
// Inputs are documented where the stylesheets declare or read them, in a
// `/** … */` comment. Before a declaration, the comment takes its name and
// value from it; elsewhere, `@input --name` names it. `@default` overrides the
// default read from the stylesheets, `@on` says where it is read and `@theme`
// puts it with the theme variables. Published values, parts and states come
// from the map in packages/fluidbox/src/css-api.ts.
//
// checkCss fails the build when a documented name is in neither the runtime
// nor the stylesheets, or a `--fluidbox-*` or `data-fluidbox-*` name there is
// neither documented nor listed as internal in the map.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = join(root, "packages/fluidbox/src");
const mapPath = join(sourceDir, "css-api.ts");
const bindingDirs = ["react", "solid", "vue", "angular"].map((name) =>
  join(root, "packages", name, "src"),
);

/** What the CSS reference reads, so dev can watch it. */
export const cssSources = [sourceDir, ...bindingDirs];

interface Row {
  readonly names: readonly string[];
  readonly doc: string;
  readonly on?: string;
  readonly fallback?: string;
}

type Table = "theme" | "inputs" | "sheet" | "published" | "parts" | "sheet-parts" | "states";

interface Source {
  readonly path: string;
  /** The text with its comments blanked, so names in prose don't count as use. */
  readonly code: string;
}

const files = (dir: string, pattern: RegExp): string[] => {
  try {
    return readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((name) => pattern.test(name))
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
};

const blank = (text: string, start: number, end: number) =>
  text.slice(0, start) + text.slice(start, end).replace(/[^\n]/g, " ") + text.slice(end);

function stylesheets(): (Source & { readonly text: string })[] {
  // In the order the reference lists them.
  const order = ["styles.css", "thumbnails.css", "sheet.css"];
  const missing = files(sourceDir, /\.css$/).filter((path) => !order.includes(basename(path)));
  if (missing.length) throw new Error(`css-source.ts doesn't read ${missing.join(", ")}.`);
  return order.map((name) => {
    const path = join(sourceDir, name);
    const text = readFileSync(path, "utf8");
    return { path, text, code: text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")) };
  });
}

function scripts(): Source[] {
  return [sourceDir, ...bindingDirs]
    .flatMap((dir) => files(dir, /\.(ts|tsx|vue)$/))
    .filter((path) => path !== mapPath && !path.endsWith(".d.ts"))
    .map((path) => {
      let code = readFileSync(path, "utf8");
      if (path.endsWith(".vue")) return { path, code };
      const { comments } = parseSync(path, code, { lang: path.endsWith(".tsx") ? "tsx" : "ts" });
      for (const comment of comments) code = blank(code, comment.start, comment.end);
      return { path, code };
    });
}

// Comments.

const TAG = /\s@(input|default|on|theme)\b/;

function tags(comment: string) {
  const text = comment
    .replace(/^\/\*\*|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ");
  const [doc, ...rest] = ` ${text}`.split(TAG);
  const found: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 2) {
    found[rest[index]!] = rest[index + 1]!.trim();
  }
  return { doc: doc!.trim(), tags: found };
}

// Values a custom property takes in the stylesheets.

function closing(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")" && --depth === 0) return index;
  }
  return text.length;
}

function valuesOf(name: string, sheets: readonly Source[]): string[] {
  const values: string[] = [];
  const escaped = name.replace(/[-]/g, "\\-");
  for (const { code } of sheets) {
    for (const match of code.matchAll(
      new RegExp(`(?<![\\w-])${escaped}\\s*:\\s*([^;{}]+);`, "g"),
    )) {
      values.push(match[1]!.replace(/\s+/g, " ").trim());
    }
    for (const match of code.matchAll(
      new RegExp(`@property\\s+${escaped}\\s*\\{[^}]*initial-value:\\s*([^;]+);`, "g"),
    )) {
      values.push(match[1]!.trim());
    }
    for (const match of code.matchAll(new RegExp(`var\\(\\s*${escaped}\\s*,`, "g"))) {
      const open = match.index + 3;
      const value = code.slice(match.index + match[0].length, closing(code, open));
      values.push(value.replace(/\s+/g, " ").trim());
    }
  }
  return values;
}

function registered(name: string, sheets: readonly Source[]): string | undefined {
  const escaped = name.replace(/[-]/g, "\\-");
  for (const { code } of sheets) {
    const match = new RegExp(`@property\\s+${escaped}\\s*\\{[^}]*initial-value:\\s*([^;]+);`).exec(
      code,
    );
    if (match) return match[1]!.trim();
  }
}

// The inputs, from the stylesheets' doc comments.

interface Input extends Row {
  readonly table: "theme" | "inputs" | "sheet";
  readonly path: string;
}

const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+);/;

function inputs(): Input[] {
  const sheets = stylesheets();
  const found: Input[] = [];
  const problems: string[] = [];
  for (const sheet of sheets) {
    for (const match of sheet.text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
      const { doc, tags: tag } = tags(match[0]);
      const declared = DECLARATION.exec(sheet.text.slice(match.index + match[0].length));
      const names = tag.input ? tag.input.split(/\s+/) : declared ? [declared[1]!] : [];
      const where = `${sheet.path.slice(root.length + 1)}: ${doc.slice(0, 40)}…`;
      if (!names.length) {
        problems.push(`${where} documents no input. Put it before a declaration, or add @input.`);
        continue;
      }
      let fallback = tag.default;
      if (!fallback) {
        // Its own declaration, else its registration, else the one fallback it has.
        const own = declared && names.includes(declared[1]!) ? declared[2]!.trim() : undefined;
        const initial = new Set(names.map((name) => registered(name, sheets)));
        const values = new Set(names.flatMap((name) => valuesOf(name, sheets)));
        const value =
          own ??
          (initial.size === 1 ? [...initial][0] : undefined) ??
          (values.size === 1 ? [...values][0] : undefined);
        if (!value) {
          problems.push(
            `${names[0]} takes ${values.size ? `several values (${[...values].join(" | ")})` : "no value"} in the stylesheets. Give it a @default.`,
          );
          continue;
        }
        fallback = `\`${value}\``;
      } else {
        const values = names.flatMap((name) => valuesOf(name, sheets)).join(" ");
        for (const [, quoted] of fallback.matchAll(/`([^`]+)`/g)) {
          if (values && !values.includes(quoted!)) {
            problems.push(`${names[0]}'s @default names ${quoted}, which no stylesheet gives it.`);
          }
        }
      }
      const table = sheet.path.endsWith("sheet.css")
        ? "sheet"
        : "theme" in tag
          ? "theme"
          : "inputs";
      found.push({ names, doc, on: tag.on, fallback, table, path: sheet.path });
    }
  }
  if (problems.length) throw new Error(`The stylesheets' doc comments:\n${problems.join("\n")}`);
  return found;
}

// The map of published values, parts and states.

interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: any;
}

const MAP_TABLES: Record<string, Table> = {
  publishedValues: "published",
  parts: "parts",
  sheetParts: "sheet-parts",
  states: "states",
};

function map(): { rows: Map<Table, Row[]>; internal: string[] } {
  const text = readFileSync(mapPath, "utf8");
  const { program, comments } = parseSync(mapPath, text, { lang: "ts" });
  const docBefore = (start: number) => {
    const comment = comments.findLast((candidate) => candidate.end <= start);
    if (!comment || text.slice(comment.end, start).trim()) return "";
    return tags(text.slice(comment.start, comment.end)).doc;
  };
  const string = (node: Node | undefined) => {
    if (node?.type !== "Literal" || typeof node.value !== "string") {
      throw new Error(`css-api.ts: expected a string at ${node?.start}.`);
    }
    return node.value as string;
  };
  const rows = new Map<Table, Row[]>();
  let internal: string[] = [];
  for (const statement of program.body as Node[]) {
    const declaration = statement.declaration as Node | undefined;
    if (
      statement.type !== "ExportNamedDeclaration" ||
      declaration?.type !== "VariableDeclaration"
    ) {
      continue;
    }
    const [declarator] = declaration.declarations as Node[];
    const name = declarator!.id.name as string;
    const elements = (declarator!.init as Node).elements as Node[];
    if (name === "internal") {
      internal = elements.map(string);
      continue;
    }
    const table = MAP_TABLES[name];
    if (!table) throw new Error(`css-api.ts exports ${name}, which no table shows.`);
    rows.set(
      table,
      elements.map((element) => {
        const property = (key: string) =>
          (element.properties as Node[]).find((candidate) => candidate.key.name === key)?.value;
        const names = (property("names") as Node).elements.map(string) as string[];
        const on = property("on");
        const doc = docBefore(element.start);
        if (!doc) throw new Error(`css-api.ts: ${names.join(", ")} needs a doc comment.`);
        return { names, doc, on: on && string(on) };
      }),
    );
  }
  return { rows, internal };
}

// Tables.

const cell = (text: string) => text.replace(/\|/g, "\\|");
const code = (names: readonly string[], selector = false) =>
  names.map((name) => `\`${selector ? `[${name}]` : name}\``).join(", ");

const COLUMNS: Record<Table, { head: string[]; row: (row: Row) => string[] }> = {
  theme: {
    head: ["Variable", "Default", "Used for"],
    row: (r) => [code(r.names), r.fallback!, r.doc],
  },
  inputs: {
    head: ["Property", "Default", "Read on", "What it does"],
    row: (r) => [code(r.names), r.fallback!, r.on ?? "", r.doc],
  },
  sheet: {
    head: ["Property", "Default", "What it does"],
    row: (r) => [code(r.names), r.fallback!, r.doc],
  },
  published: { head: ["Property", "On", "Value"], row: (r) => [code(r.names), r.on ?? "", r.doc] },
  parts: { head: ["Selector", "Part"], row: (r) => [code(r.names, true), r.doc] },
  "sheet-parts": { head: ["Selector", "Part"], row: (r) => [code(r.names, true), r.doc] },
  states: { head: ["Attribute", "On", "Meaning"], row: (r) => [code(r.names), r.on ?? "", r.doc] },
};

function tables(): Map<Table, Row[]> {
  const { rows } = map();
  for (const table of ["theme", "inputs", "sheet"] as const) rows.set(table, []);
  for (const input of inputs()) rows.get(input.table)!.push(input);
  return rows;
}

const CSS_DIRECTIVE = /<!--\s*css:\s*([\w-]+)((?:\s+[\w-]+)*)\s*-->/g;

/** Replaces the CSS directives in a page's Markdown with tables read from the source. */
export function expandCss(markdown: string, page: string): string {
  if (!markdown.includes("<!-- css:")) return markdown;
  const all = tables();
  return markdown.replace(CSS_DIRECTIVE, (_, name: string, filter: string) => {
    const table = name as Table;
    const rows = all.get(table);
    if (!rows) throw new Error(`${page}: there is no CSS table called ${name}.`);
    const wanted = filter.trim() ? filter.trim().split(/\s+/) : [];
    const kept = wanted.length
      ? rows.filter((row) => row.names.every((each) => wanted.includes(each)))
      : rows;
    for (const want of wanted) {
      if (!kept.some((row) => row.names.includes(want))) {
        throw new Error(`${page}: the ${name} table has no row of ${want} alone among the names.`);
      }
    }
    const { head, row } = COLUMNS[table];
    return [
      `| ${head.join(" | ")} |`,
      `| ${head.map(() => "---").join(" | ")} |`,
      ...kept.map((entry) => `| ${row(entry).map(cell).join(" | ")} |`),
    ].join("\n");
  });
}

// Drift.

const camel = (name: string) => name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function used(name: string, sheets: readonly Source[], code: readonly Source[]): boolean {
  if ([...sheets, ...code].some((source) => source.code.includes(name))) return true;
  if (!name.startsWith("data-")) return false;
  const key = camel(name.slice(5));
  return code.some((source) =>
    new RegExp(`dataset\\.${key}\\b|dataset\\[["']${key}["']\\]`).test(source.code),
  );
}

/** Fails when the CSS the docs list and the CSS the package uses disagree. */
export function checkCss() {
  const sheets = stylesheets();
  const code = scripts();
  const { internal } = map();
  const documented = [...tables().values()].flat().flatMap((row) => row.names);
  const problems: string[] = [];
  for (const name of new Set([...documented, ...internal])) {
    if (!used(name, sheets, code)) problems.push(`${name} is documented, but nothing uses it.`);
  }
  for (const name of internal) {
    if (documented.includes(name)) problems.push(`${name} is both documented and internal.`);
  }
  const known = new Set([...documented, ...internal]);
  const found = new Set<string>();
  for (const source of [...sheets, ...code]) {
    // A name ending in a dash is a template's prefix, as in `--fluidbox-stage-${side}`.
    for (const [name] of source.code.matchAll(/(?:--|data-)fluidbox-[a-z0-9-]+/g)) {
      if (!name.endsWith("-")) found.add(name);
    }
    for (const [, key] of source.code.matchAll(/dataset\.(fluidbox[A-Z]\w*)/g)) {
      found.add(`data-${kebab(key!)}`);
    }
  }
  for (const name of found) {
    if (known.has(name)) continue;
    problems.push(
      `${name} is in the source but not in the docs. Document it, or list it in internal in css-api.ts.`,
    );
  }
  if (problems.length) {
    throw new Error(`The CSS reference has drifted from the source:\n${problems.join("\n")}`);
  }
}
