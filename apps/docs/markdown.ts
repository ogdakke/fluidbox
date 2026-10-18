// Vite plugin that compiles content/*.md into modules the docs app routes between.
import MarkdownIt from "markdown-it";
import { codeToHtml, isSupportedLanguage } from "@pierre/highlights";
import { pierreDark, pierreLight } from "@pierre/highlights/themes";
import type { Plugin } from "vite";

export type DocHeading = { depth: 2 | 3; id: string; text: string };

export type DocModule = {
  slug: string;
  path: string;
  title: string;
  description: string;
  section: string;
  order: number;
  html: string;
  headings: DocHeading[];
};

const decoder = new TextDecoder();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function frontmatter(source: string): [Record<string, string>, string] {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return [{}, source];
  const data: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return [data, source.slice(match[0].length)];
}

/** `getting-started.md` → `/getting-started/`; `index.md` → `/`. */
export function routeFor(slug: string): string {
  return slug === "index" ? "/" : `/${slug}/`;
}

function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: true });

  md.options.highlight = (code, lang) => {
    const language = isSupportedLanguage(lang) ? lang : "text";
    // `light-dark()` follows the page's color-scheme, so the theme toggle needs no extra CSS.
    const html = decoder.decode(
      codeToHtml(code.replace(/\n$/, ""), {
        lang: language,
        themes: { light: pierreLight, dark: pierreDark },
        defaultColor: "light-dark()",
      }),
    );
    return `<div class="doc-code"><span class="doc-code__lang">${lang || "text"}</span>${html}</div>`;
  };

  // Rewrite `./other.md#hash` links to routes so content stays readable on GitHub too.
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx]!.attrGet("href");
    const match = href && /^\.\/([\w-]+)\.md(#.*)?$/.exec(href);
    if (match) tokens[idx]!.attrSet("href", routeFor(match[1]!) + (match[2] ?? ""));
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // Tables scroll inside a hairline frame instead of overflowing the column.
  md.renderer.rules.table_open = () => '<div class="doc-table"><table>';
  md.renderer.rules.table_close = () => "</table></div>";

  return md;
}

function render(md: MarkdownIt, slug: string, source: string): DocModule {
  const [data, body] = frontmatter(source);
  const tokens = md.parse(body, {});
  const headings: DocHeading[] = [];
  let title = data.title ?? slug;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (token.type !== "heading_open") continue;
    const inline = tokens[index + 1]!;
    const text = inline.content;
    const depth = Number(token.tag.slice(1));
    if (depth === 1) {
      title = data.title ?? text;
      continue;
    }
    if (depth !== 2 && depth !== 3) continue;
    const id = slugify(text);
    token.attrSet("id", id);
    headings.push({ depth, id, text: text.replace(/`/g, "") });
    // Reuse the parser's Token class so the anchor renders like any inline HTML.
    const TokenClass = inline.constructor as new (
      type: string,
      tag: string,
      nesting: number,
    ) => typeof inline;
    const anchor = new TokenClass("html_inline", "", 0);
    anchor.content = `<a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a>`;
    inline.children?.push(anchor);
  }
  return {
    slug,
    path: routeFor(slug),
    title,
    description: data.description ?? "",
    section: data.section ?? "Docs",
    order: Number(data.order ?? 99),
    html: md.renderer.render(tokens, md.options, {}),
    headings,
  };
}

export function markdownPages(): Plugin {
  const md = createRenderer();
  return {
    name: "fluidbox-docs-markdown",
    transform(source, id) {
      if (!id.endsWith(".md")) return null;
      const slug = id.split("/").pop()!.slice(0, -".md".length);
      return { code: `export default ${JSON.stringify(render(md, slug, source))};`, map: null };
    },
  };
}
