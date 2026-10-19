import { codeToHtml, isSupportedLanguage } from "@pierre/highlights";
import { pierreDark, pierreLight } from "@pierre/highlights/themes";

const decoder = new TextDecoder();

/** Highlight code to HTML at build time, for the docs and the examples alike. */
export function highlight(code: string, lang: string): string {
  const language = isSupportedLanguage(lang) ? lang : "text";
  // `light-dark()` follows the page's color-scheme, so the theme toggle needs no extra CSS.
  return decoder.decode(
    codeToHtml(code.replace(/\n$/, ""), {
      lang: language,
      themes: { light: pierreLight, dark: pierreDark },
      defaultColor: "light-dark()",
    }),
  );
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

/**
 * A Vite plugin that highlights `<pre data-lang="…"><code>…</code></pre>`
 * blocks in HTML pages at build time. Classes on the `pre` carry over.
 */
export function highlightHtml() {
  return {
    name: "fluidbox-highlight-html",
    transformIndexHtml(html: string) {
      return html.replace(
        /<pre([^>]*?)\sdata-lang="([^"]+)"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g,
        (_match, before: string, lang: string, after: string, body: string) => {
          const code = body.replace(
            /&(amp|lt|gt|quot|#39);/g,
            (_, name: string) => entities[name]!,
          );
          const className = /\sclass="([^"]*)"/.exec(before + after)?.[1];
          const output = highlight(code, lang);
          return className
            ? output.replace('class="highlights"', `class="highlights ${className}"`)
            : output;
        },
      );
    },
  };
}
