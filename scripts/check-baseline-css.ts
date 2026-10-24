/**
 * baseline.css sits in a cascade layer and the functional CSS (styles.css,
 * thumbnails.css, sheet.css and the add-ons' injected rules) in none, so the
 * functional rule always wins where both set a property on the same element.
 * Such a baseline declaration is dead. This check finds them, by selector:
 * `:where()` and `:is()` lists are expanded, since they change only weight, a
 * functional selector counts for every baseline one it plainly includes
 * (`scope [a]` includes `scope [b] [a][c]`), and a functional rule under a
 * condition the baseline one isn't under (reduced motion, forced colours) only
 * overrides it there, so it doesn't count. It also refuses `!important` in
 * baseline.css, which in a layer would beat the app's own.
 *
 * Run it alone with `bun scripts/check-baseline-css.ts`; the build and
 * `bun run test` run it too.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Declaration {
  readonly property: string;
  readonly important: boolean;
}

interface Rule {
  readonly selectors: readonly string[];
  readonly conditions: readonly string[];
  readonly declarations: readonly Declaration[];
  readonly source: string;
}

const src = resolve(import.meta.dirname, "../packages/fluidbox/src");

/** The index just past the bracket that closes the one at `open`. */
function closing(text: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: string[] = [];
  for (let index = open; index < text.length; index++) {
    const char = text[index]!;
    if (char === '"' || char === "'") {
      index = text.indexOf(char, index + 1);
      continue;
    }
    if (pairs[char]) stack.push(pairs[char]);
    else if (char === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return index + 1;
    }
  }
  throw new Error(`Unclosed bracket at ${open}`);
}

/** Split at commas or semicolons outside brackets and strings. */
function split(text: string, separator: "," | ";"): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === '"' || char === "'") index = text.indexOf(char, index + 1);
    else if (char === "(" || char === "[" || char === "{") index = closing(text, index) - 1;
    else if (char === separator) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Every plain selector a complex selector stands for, with `:where()` and `:is()` spelled out. */
function expand(selector: string): string[] {
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]!;
    if (char === '"' || char === "'") {
      index = selector.indexOf(char, index + 1);
      continue;
    }
    if (char === "[") {
      index = closing(selector, index) - 1;
      continue;
    }
    if (char !== ":") continue;
    const name = /^:([\w-]+)\(/.exec(selector.slice(index))?.[1];
    if (!name) continue;
    const open = index + name.length + 1;
    const end = closing(selector, open);
    if (name !== "where" && name !== "is") {
      // :not(), :has() and :nth-child() keep their arguments as written.
      index = end - 1;
      continue;
    }
    const before = selector.slice(0, index);
    const after = selector.slice(end);
    return split(selector.slice(open + 1, end - 1), ",").flatMap((choice) =>
      expand(`${before}${choice}${after}`),
    );
  }
  return [
    selector
      .replace(/\s*([>+~])\s*/g, " $1 ")
      .replace(/\s+/g, " ")
      .trim(),
  ];
}

/** The style rules of a stylesheet, with the at-rule conditions each sits under. */
export function rules(css: string, source: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Rule[] = [];
  const walk = (body: string, conditions: readonly string[]) => {
    let index = 0;
    while (index < body.length) {
      const brace = body.indexOf("{", index);
      const semicolon = body.indexOf(";", index);
      if (brace < 0) break;
      if (semicolon >= 0 && semicolon < brace) {
        index = semicolon + 1;
        continue;
      }
      const prelude = body.slice(index, brace).trim();
      const end = closing(body, brace);
      const inner = body.slice(brace + 1, end - 1);
      index = end;
      if (/^@(media|supports|container|layer)\b/.test(prelude)) {
        walk(inner, /^@layer\b/.test(prelude) ? conditions : [...conditions, prelude]);
      } else if (!prelude.startsWith("@")) {
        found.push({
          selectors: split(prelude, ",").flatMap(expand),
          conditions,
          declarations: split(inner, ";").map((declaration) => {
            const colon = declaration.indexOf(":");
            return {
              property: declaration
                .slice(0, colon)
                .trim()
                .replace(/^-(webkit|moz)-/, ""),
              important: /!\s*important\s*$/.test(declaration),
            };
          }),
          source,
        });
      }
    }
  };
  walk(text, []);
  return found;
}

/** Properties named after a shorthand that the shorthand doesn't set. */
const apart =
  /^(border-(radius|image|collapse|spacing)|outline-offset|flex-(direction|wrap|flow)|overflow-(anchor|wrap)|transform-(origin|style|box)|background-blend-mode)/;

/** Whether two properties set the same thing, as a shorthand and its longhand do. */
function overlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.startsWith("--") || b.startsWith("--")) return false;
  if (a === "all" || b === "all") return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return long.startsWith(`${short}-`) && !apart.test(long);
}

/** A complex selector as its compounds, each a set of simple selectors, and its combinators. */
function compounds(selector: string): { parts: string[][]; combinators: string[] } {
  const parts: string[][] = [[]];
  const combinators: string[] = [];
  let index = 0;
  while (index < selector.length) {
    const char = selector[index]!;
    if (char === " ") {
      const combinator = /^ ([>+~]) /.exec(selector.slice(index));
      combinators.push(combinator ? combinator[1]! : " ");
      parts.push([]);
      index += combinator ? 3 : 1;
      continue;
    }
    let end = index + 1;
    if (char === "[") end = closing(selector, index);
    else {
      while (end < selector.length && !"[:.# ".includes(selector[end]!)) {
        if (selector[end] === "(") end = closing(selector, end) - 1;
        end++;
      }
      // A pseudo-element keeps its double colon.
      if (char === ":" && selector[index + 1] === ":") {
        end = index + 2;
        while (end < selector.length && /[\w-]/.test(selector[end]!)) end++;
      }
    }
    parts.at(-1)!.push(selector.slice(index, end));
    index = end;
  }
  return { parts, combinators };
}

/**
 * Whether every element `general` matches includes those `specific` matches:
 * the same selector, or a general one whose compounds each sit, in order, in
 * the specific one's, as `scope [a]` covers `scope [b][c] [a][d]`. A
 * functional rule that covers a baseline one leaves its shared properties dead.
 */
function covers(general: string, specific: string): boolean {
  if (general === specific) return true;
  const outer = compounds(general);
  const inner = compounds(specific);
  if (outer.combinators.some((combinator) => combinator !== " ")) return false;
  const subset = (small: string[], large: string[]) => {
    const pseudo = (list: string[]) => list.filter((part) => part.startsWith("::")).join();
    return pseudo(small) === pseudo(large) && small.every((part) => large.includes(part));
  };
  if (!subset(outer.parts.at(-1)!, inner.parts.at(-1)!)) return false;
  let at = 0;
  for (const part of outer.parts.slice(0, -1)) {
    while (at < inner.parts.length - 1 && !subset(part, inner.parts[at]!)) at++;
    if (at >= inner.parts.length - 1) return false;
    at++;
  }
  return true;
}

/** The functional stylesheets and the add-ons' injected rules, as [name, css]. */
export function functionalSources(): [string, string][] {
  const sheets = ["styles.css", "thumbnails.css", "sheet.css"].map((name): [string, string] => [
    name,
    readFileSync(resolve(src, name), "utf8"),
  ]);
  const injected = ["addon-styles.ts", "embeds.ts", "spin.ts", "model.ts"].flatMap((name) =>
    [...readFileSync(resolve(src, name), "utf8").matchAll(/const (\w+Styles) = `([^`]*)`/g)].map(
      ([, constant, css]): [string, string] => [`${name} ${constant}`, css!],
    ),
  );
  return [...sheets, ...injected];
}

/** What is wrong with baseline.css against the functional CSS; empty when nothing is. */
export function checkBaselineCss(
  baseline = readFileSync(resolve(src, "baseline.css"), "utf8"),
  functional = functionalSources(),
): string[] {
  const problems: string[] = [];
  const look = rules(baseline, "baseline.css");
  const mechanics = functional.flatMap(([name, css]) => rules(css, name));
  for (const rule of look) {
    for (const { property, important } of rule.declarations) {
      if (important)
        problems.push(`baseline.css: ${property} is !important in ${rule.selectors[0]}`);
    }
  }
  for (const rule of look) {
    for (const other of mechanics) {
      // A functional rule under a condition of its own, such as forced colours,
      // overrides the look only there; the baseline rule lives on elsewhere.
      if (!other.conditions.every((condition) => rule.conditions.includes(condition))) continue;
      const shared = rule.selectors.find((selector) =>
        other.selectors.some((general) => covers(general, selector)),
      );
      if (!shared) continue;
      for (const { property } of rule.declarations) {
        const clash = other.declarations.find((declaration) =>
          overlap(property, declaration.property),
        );
        if (clash) {
          problems.push(
            `baseline.css sets ${property} on ${shared}, which ${other.source} sets there (${clash.property}); the unlayered rule always wins`,
          );
        }
      }
    }
  }
  return [...new Set(problems)];
}

if (import.meta.main) {
  const problems = checkBaselineCss();
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exit(1);
  console.log("baseline.css sets nothing the functional CSS sets, and has no !important.");
}
