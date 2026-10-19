// HTML for the docs shell, shared by the prerender and the client router.

export type DocHeading = { depth: 2 | 3; id: string; text: string };

export type DocMeta = {
  slug: string;
  path: string;
  title: string;
  description: string;
  section: string;
  order: number;
  headings: DocHeading[];
};

const sections = ["Start", "Patterns", "Frameworks", "Guides", "Reference"];

export function renderNav(pages: readonly DocMeta[], current: string): string {
  return sections
    .map((section) => {
      const items = pages.filter((page) => page.section === section);
      if (!items.length) return "";
      return `<p class="fb-label">${section}</p><ul>${items
        .map(
          (page) =>
            `<li><a href="${page.path}"${page.path === current ? ' aria-current="page"' : ""}>${page.title}</a></li>`,
        )
        .join("")}</ul>`;
    })
    .join("");
}

export function renderArticle(
  page: DocMeta,
  html: string,
  previous: DocMeta | undefined,
  next: DocMeta | undefined,
): string {
  return `
    <article class="prose">
      <p class="fb-label">${page.section}</p>
      ${html}
    </article>
    <nav class="docs-pager fb-grid" aria-label="Pagination">
      ${previous ? `<a class="fb-cell" href="${previous.path}"><span class="fb-label">Previous</span>${previous.title}</a>` : "<span></span>"}
      ${next ? `<a class="fb-cell docs-pager__next" href="${next.path}"><span class="fb-label">Next</span>${next.title}</a>` : "<span></span>"}
    </nav>`;
}

export function renderToc(headings: readonly DocHeading[]): string {
  return headings
    .map(
      (heading) =>
        `<li class="docs-toc__${heading.depth}"><a href="#${heading.id}">${heading.text}</a></li>`,
    )
    .join("");
}
