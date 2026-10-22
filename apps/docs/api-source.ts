// The API reference's code comes from the package source, read on every build
// and on every change in dev, so the docs can't drift from what ships:
//
//   <!-- api: FluidboxOptions, Fluidbox -->   those declarations, as written
//   <!-- api-import: root -->                 the values an entry exports, as an import
//   <!-- api-index: root -->                  every type and value an entry exports
//   <!-- api-summary: kit -->                 a table of an entry's exports and their JSDoc
//   <!-- api-entry: react -->                 everything an entry declares beyond the root
//   <!-- api-entries -->                      a table of the published entries and their headers
//
// checkApiCoverage fails the build when a page names a Fluidbox type no entry
// exports, or when the API reference leaves out something an entry exports.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageDir = join(root, "packages/fluidbox");
const sourceDir = join(packageDir, "src");

interface Entry {
  /** What a consumer imports. */
  readonly path: string;
  /** The source file it is built or copied from. */
  readonly source: string;
  readonly kind: "module" | "stylesheet";
}

/**
 * The published entries, read from the package's `exports`. Each built file maps
 * back to its source through tsdown's `entry` or `copy`, and `dist/<binding>/`
 * to that binding's package. A directive names an entry by its subpath, `root`
 * for the package itself.
 */
function readEntries(): Map<string, Entry> {
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const built = tsdownSources();
  const result = new Map<string, Entry>();
  for (const [subpath, target] of Object.entries<Record<string, string>>(manifest.exports)) {
    const file = target.import ?? target.default;
    const name = subpath === "." ? "root" : subpath.slice(2);
    const own = /^\.\/dist\/([\w.-]+?)(?:\.js)?$/.exec(file ?? "");
    const binding = /^\.\/dist\/([\w-]+)\/index\.js$/.exec(file ?? "");
    const source = binding
      ? join(root, "packages", binding[1]!, "src/index.ts")
      : own && built.get(own[1]!) && join(packageDir, built.get(own[1]!)!);
    if (!source) throw new Error(`Can't tell which source builds ${subpath} (${file}).`);
    result.set(name, {
      path: subpath === "." ? manifest.name : `${manifest.name}/${name}`,
      source,
      kind: source.endsWith(".css") ? "stylesheet" : "module",
    });
  }
  return result;
}

/** tsdown's `entry` and `copy`: built file name → source file. */
function tsdownSources(): Map<string, string> {
  const path = join(packageDir, "tsdown.config.ts");
  const { program } = parseSync(path, readFileSync(path, "utf8"));
  const result = new Map<string, string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const value = node as Node;
    if (value.type === "Property" && value.key?.name === "entry") {
      for (const property of value.value.properties as Node[]) {
        result.set(property.key.name ?? property.key.value, property.value.value);
      }
      return;
    }
    if (value.type === "Property" && value.key?.name === "copy") {
      for (const element of value.value.elements as Node[]) {
        const field = (key: string) =>
          (element.properties as Node[]).find((property) => property.key.name === key)?.value
            .value as string | undefined;
        const from = field("from");
        if (from) result.set(field("rename") ?? from.split("/").at(-1)!, from);
      }
      return;
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(program);
  if (!result.size) throw new Error(`No entry in ${path}.`);
  return result;
}

const entries = readEntries();
const modules = [...entries.values()].filter((entry) => entry.kind === "module");

/** Entries built from outside the core's source: the bindings. */
const bindingEntries = modules
  .map((entry) => entry.source)
  .filter((source) => !source.startsWith(sourceDir));

// oxc's AST, as far as this reads it.
interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: any;
}
interface Comment {
  readonly type: "Line" | "Block";
  readonly start: number;
  readonly end: number;
}

interface SourceFile {
  readonly path: string;
  readonly text: string;
  readonly body: readonly Node[];
  readonly comments: readonly Comment[];
}

interface Declaration {
  readonly file: SourceFile;
  readonly node: Node;
  /** Where the declaration starts, its `export` included. */
  readonly start: number;
}

export interface ApiExport {
  readonly name: string;
  readonly kind: "type" | "value";
  readonly declaration: Declaration | null;
}

const files = new Map<string, SourceFile>();

function sourceFile(path: string): SourceFile {
  let file = files.get(path);
  if (!file) {
    const text = readFileSync(path, "utf8");
    const result = parseSync(path, text, { lang: path.endsWith(".tsx") ? "tsx" : "ts" });
    if (result.errors.length) {
      throw new Error(`Couldn't parse ${path}: ${result.errors[0]!.message}`);
    }
    file = { path, text, body: result.program.body as Node[], comments: result.comments };
    files.set(path, file);
  }
  return file;
}

function moduleFile(from: SourceFile, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    // The bindings import the core by its published paths.
    return [...entries.values()].find((entry) => entry.path === specifier)?.source ?? null;
  }
  const base = resolve(dirname(from.path), specifier.replace(/\.js$/, ""));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // Try the next.
    }
  }
  return null;
}

const nameOf = (node: Node): string | undefined =>
  node.id?.name ?? node.declarations?.[0]?.id?.name;

const specifierName = (node: Node): string => node.name ?? node.value;

/** The declaration a name refers to in a file, following imports and re-exports. */
function declarationIn(
  file: SourceFile,
  name: string,
  seen = new Set<string>(),
): Declaration | null {
  const key = `${file.path}#${name}`;
  if (seen.has(key)) return null;
  seen.add(key);
  for (const statement of file.body) {
    const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (node && nameOf(node) === name) return { file, node, start: statement.start };
  }
  for (const statement of file.body) {
    if (statement.type === "ExportNamedDeclaration") {
      for (const specifier of statement.specifiers as Node[]) {
        if (specifierName(specifier.exported) !== name) continue;
        const local = specifierName(specifier.local);
        const target = statement.source && moduleFile(file, statement.source.value);
        if (target) return declarationIn(sourceFile(target), local, seen);
        if (local !== name) return declarationIn(file, local, seen);
      }
    }
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers as Node[]) {
        if (specifier.local.name !== name) continue;
        const target = moduleFile(file, statement.source.value);
        const imported =
          specifier.type === "ImportSpecifier" ? specifierName(specifier.imported) : "default";
        return target ? declarationIn(sourceFile(target), imported, seen) : null;
      }
    }
  }
  return null;
}

const TYPE_NODES = new Set(["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]);

/** What a module exports, in source order. */
function exportsOf(path: string): ApiExport[] {
  const file = sourceFile(path);
  const result: ApiExport[] = [];
  for (const statement of file.body) {
    if (statement.type === "ExportAllDeclaration") {
      throw new Error(`${path} uses export *; list the exports so the docs can read them.`);
    }
    if (statement.type !== "ExportNamedDeclaration") continue;
    const names = statement.declaration
      ? [nameOf(statement.declaration)!]
      : (statement.specifiers as Node[]).map((specifier) => specifierName(specifier.exported));
    for (const name of names) {
      const declaration = declarationIn(file, name);
      const typeOnly =
        statement.exportKind === "type" ||
        (statement.specifiers as Node[]).some(
          (specifier) =>
            specifierName(specifier.exported) === name && specifier.exportKind === "type",
        );
      const kind =
        typeOnly || (declaration && TYPE_NODES.has(declaration.node.type)) ? "type" : "value";
      result.push({ name, kind, declaration });
    }
  }
  return result;
}

function entry(name: string): Entry {
  const found = entries.get(name);
  if (!found) throw new Error(`No published entry named "${name}".`);
  return found;
}

export function entryExports(name: string): ApiExport[] {
  return exportsOf(entry(name).source);
}

/** The JSDoc right above a node, with nothing but whitespace between. */
function leadingDoc(file: SourceFile, start: number): string {
  for (let index = file.comments.length - 1; index >= 0; index--) {
    const comment = file.comments[index]!;
    if (comment.end > start) continue;
    if (file.text.slice(comment.end, start).trim()) return "";
    const text = file.text.slice(comment.start, comment.end);
    return comment.type === "Block" && text.startsWith("/**") ? `${text}\n` : "";
  }
  return "";
}

/** A line's own indentation in the file, so a sliced member keeps its layout. */
function indentAt(file: SourceFile, position: number): string {
  const lineStart = file.text.lastIndexOf("\n", position - 1) + 1;
  return file.text.slice(lineStart, position);
}

function signature(file: SourceFile, node: Node, bodyStart: number): string {
  return `${file.text.slice(node.start, bodyStart).trimEnd()};`;
}

const isPublicMember = (member: Node) =>
  member.key?.type !== "PrivateIdentifier" &&
  member.accessibility !== "private" &&
  member.accessibility !== "protected" &&
  !member.static;

const isMethod = (member: Node) =>
  member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition";

const memberName = (member: Node): string =>
  member.key?.name ?? member.key?.value ?? (member.type === "StaticBlock" ? "static" : "");

/** Lifecycle callbacks, empty constructors and members marked @internal: not for consumers. */
function isPlumbing(file: SourceFile, member: Node): boolean {
  const name = memberName(member);
  if (/^ng[A-Z]|^(connected|disconnected|adopted|attributeChanged)Callback$/.test(name))
    return true;
  if (member.kind === "constructor" && !member.value.params.length) return true;
  return leadingDoc(file, member.start).includes("@internal");
}

/**
 * A member's declaration. A field keeps a literal default, and an initializer
 * that is its only type, such as an Angular output's `new EventEmitter<T>()`.
 */
function memberText(file: SourceFile, member: Node): string {
  if (isMethod(member) && member.value.body) {
    return signature(file, member, member.value.body.start);
  }
  const value = member.value;
  if (member.type !== "PropertyDefinition" || !value)
    return file.text.slice(member.start, member.end);
  const initializer = file.text.slice(value.start, value.end);
  const literal = /^(Literal|ArrayExpression|ObjectExpression|TemplateLiteral)$/.test(value.type);
  const keep = literal || !member.typeAnnotation ? !initializer.includes("\n") : false;
  if (keep) return file.text.slice(member.start, member.end);
  const end = member.typeAnnotation?.end ?? member.key.end;
  return `${file.text.slice(member.start, end)};`;
}

/**
 * An Angular decorator as a consumer needs it: the selector and the name to
 * export it as, without its host bindings and template.
 */
function selectorOf(file: SourceFile, decorator: Node): string {
  const call = decorator.expression;
  const name = file.text.slice(call.callee?.start ?? call.start, call.callee?.end ?? call.end);
  const options = call.arguments?.[0];
  const kept = ((options?.properties ?? []) as Node[])
    .filter((property) => ["selector", "exportAs"].includes(property.key?.name))
    .map((property) => file.text.slice(property.start, property.end));
  return kept.length ? `@${name}({ ${kept.join(", ")} })\n` : "";
}

/** A declaration as a consumer reads it: types as written, functions and classes without bodies. */
function print({ file, node, start }: Declaration): string {
  const doc = leadingDoc(file, start);
  switch (node.type) {
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
      return doc + file.text.slice(node.start, node.end);
    case "FunctionDeclaration":
      return doc + signature(file, node, node.body.start);
    case "TSDeclareFunction":
      // Overloads: every signature, none of the implementation.
      return file.body
        .map((statement) =>
          statement.type === "ExportNamedDeclaration" ? statement.declaration : statement,
        )
        .filter((other) => other?.type === "TSDeclareFunction" && nameOf(other) === nameOf(node))
        .map((other, index) => (index ? "" : doc) + file.text.slice(other.start, other.end))
        .join("\n");
    case "VariableDeclaration":
      return doc + file.text.slice(node.start, node.end);
    case "ClassDeclaration": {
      const body = node.body.body as Node[];
      // An overloaded method shows its overloads, not its implementation.
      const overloaded = new Set(
        body.filter((member) => isMethod(member) && !member.value.body).map(memberName),
      );
      const members = body
        .filter((member) => isPublicMember(member) && !isPlumbing(file, member))
        .filter(
          (member) =>
            !(isMethod(member) && member.value.body && overloaded.has(memberName(member))),
        )
        .map((member) => {
          const memberDoc = leadingDoc(file, member.start);
          const indent = indentAt(file, member.start);
          return `${memberDoc ? indent + memberDoc : ""}${indent}${memberText(file, member)}`;
        });
      const head = file.text
        .slice(node.start, node.body.start)
        .replace(/\bexport (default )?/, "")
        // What a class implements is how it works, not how it's used.
        .replace(/\s+implements[\s\S]*$/, "")
        .trimEnd();
      return `${doc}${(node.decorators as Node[] | undefined)?.map((decorator) => selectorOf(file, decorator)).join("") ?? ""}${head} {${members.length ? `\n${members.join("\n")}\n` : ""}}`;
    }
    default:
      throw new Error(`The docs can't print a ${node.type} (${nameOf(node)}).`);
  }
}

/** Every public export of the package, by name. */
function publicExports(): Map<string, ApiExport> {
  const all = new Map<string, ApiExport>();
  for (const { source } of modules) {
    if (bindingEntries.includes(source)) continue;
    for (const item of exportsOf(source)) if (!all.has(item.name)) all.set(item.name, item);
  }
  return all;
}

/** A comment as one line of prose, without its markers or its tags. */
function prose(comment: string): string {
  return comment
    .trim()
    .replace(/^\/\*\*?|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(\*|\/\/)\s?/, "").trim())
    .join(" ")
    .split(/\s@\w+/)[0]!
    .replace(/\s+/g, " ")
    .trim();
}

/** The comment a file starts with: its header. */
function header(path: string): string {
  const text = readFileSync(path, "utf8");
  const block = /^\s*(\/\*[\s\S]*?\*\/)/.exec(text);
  const lines = /^(?:\s*\/\/.*\n)+/.exec(text);
  const found = block?.[1] ?? lines?.[0];
  if (!found) throw new Error(`${path} needs a header comment saying what the entry is.`);
  return prose(found);
}

const cell = (text: string) => text.replace(/\|/g, "\\|");

const API_DIRECTIVE = /<!--\s*api:\s*([\w\s,]+?)\s*-->/g;
const IMPORT_DIRECTIVE = /<!--\s*api-import:\s*(\w+)\s*-->/g;
const INDEX_DIRECTIVE = /<!--\s*api-index:\s*(\w+)\s*-->/g;
const SUMMARY_DIRECTIVE = /<!--\s*api-summary:\s*(\w+)\s*-->/g;
const ENTRIES_DIRECTIVE = /<!--\s*api-entries\s*-->/g;
const ENTRY_DIRECTIVE = /<!--\s*api-entry:\s*(\w+)\s*-->/g;

const list = (names: readonly string[]) =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const code = (names: readonly string[]) => names.map((name) => `\`${name}\``);

/** Replaces the API directives in a page's Markdown with code read from the source. */
export function expandApi(markdown: string, page: string): string {
  if (!markdown.includes("<!--")) return markdown;
  files.clear();
  const known = publicExports();
  return markdown
    .replace(API_DIRECTIVE, (_, names: string) => {
      const blocks = names
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((name) => {
          const item = known.get(name);
          if (!item) throw new Error(`${page}: ${name} isn't exported by any entry.`);
          if (!item.declaration) throw new Error(`${page}: can't find where ${name} is declared.`);
          return print(item.declaration);
        });
      return `\`\`\`ts\n${blocks.join("\n\n")}\n\`\`\``;
    })
    .replace(IMPORT_DIRECTIVE, (_, entry: string) => {
      const values = entryExports(entry).filter((item) => item.kind === "value");
      const lines = values.map((item) => `  ${item.name},`).join("\n");
      return `\`\`\`ts\nimport {\n${lines}\n} from "${entryPath(entry)}";\n\`\`\``;
    })
    .replace(ENTRY_DIRECTIVE, (_, entry: string) => {
      // What the entry adds: the root's types it passes through are printed there.
      const shared = new Set(entryExports("root").map((item) => item.declaration?.node));
      const seen = new Set<string>();
      const blocks = entryExports(entry).flatMap((item) => {
        if (shared.has(item.declaration?.node) || seen.has(item.name)) return [];
        seen.add(item.name);
        if (!item.declaration)
          throw new Error(`${page}: can't find where ${item.name} is declared.`);
        return [print(item.declaration)];
      });
      return `\`\`\`ts\n${blocks.join("\n\n")}\n\`\`\``;
    })
    .replace(ENTRIES_DIRECTIVE, () => {
      const rows = [...entries.values()].map(
        (item) => `| \`${item.path}\` | ${cell(header(item.source))} |`,
      );
      return ["| Import | What it is |", "| --- | --- |", ...rows].join("\n");
    })
    .replace(SUMMARY_DIRECTIVE, (_, entry: string) => {
      const rows = entryExports(entry).map(({ name, declaration }) => {
        const doc = declaration && leadingDoc(declaration.file, declaration.start);
        if (!doc) throw new Error(`${page}: ${name} needs a JSDoc comment saying what it does.`);
        return `| \`${name}\` | ${cell(prose(doc))} |`;
      });
      return ["| Export | What it does |", "| --- | --- |", ...rows].join("\n");
    })
    .replace(INDEX_DIRECTIVE, (_, entry: string) => {
      const exports = entryExports(entry);
      const types = exports.filter((item) => item.kind === "type").map((item) => item.name);
      const values = exports.filter((item) => item.kind === "value");
      const classes = values.filter((item) => item.declaration?.node.type === "ClassDeclaration");
      const functions = values.filter((item) => !classes.includes(item));
      return [
        `Every type \`${entryPath(entry)}\` exports: ${list(code(types.sort()))}.`,
        `The classes ${list(code(classes.map((item) => item.name)))}, and the functions ${list(code(functions.map((item) => item.name)))}, are values.`,
      ].join(" ");
    });
}

/**
 * Fails when a page names a `Fluidbox…` type nothing exports, or when the API
 * reference leaves out an export of the root, an add-on entry or a kit value.
 */
export function checkApiCoverage(pages: readonly { slug: string; markdown: string }[]) {
  const known = publicExports();
  for (const file of bindingEntries) {
    for (const item of exportsOf(file)) if (!known.has(item.name)) known.set(item.name, item);
  }
  const problems: string[] = [];
  for (const { slug, markdown } of pages) {
    const named = new Set(markdown.match(/(?<!["'])\bFluidbox[A-Z]\w*/g));
    for (const name of named) {
      if (!known.has(name)) problems.push(`${slug} names ${name}, which no entry exports.`);
    }
  }
  const reference = pages.find((page) => page.slug === "api");
  if (reference) {
    const required = [
      ...entryExports("root"),
      ...entryExports("filmstrip"),
      ...entryExports("sheet"),
      ...entryExports("hover-zoom"),
      ...entryExports("kit").filter((item) => item.kind === "value"),
    ];
    for (const { name } of required) {
      if (!new RegExp(`\\b${name}\\b`).test(reference.markdown)) {
        problems.push(`The API reference doesn't mention ${name}.`);
      }
    }
  }
  if (problems.length)
    throw new Error(`The docs have drifted from the source:\n${problems.join("\n")}`);
}

const entryPath = (name: string) => entry(name).path;

/** What the docs read: the package source and the bindings' entries. */
export const apiSources = [sourceDir, ...bindingEntries];

export function isApiSource(file: string): boolean {
  return file.startsWith(sourceDir) || bindingEntries.includes(file);
}
