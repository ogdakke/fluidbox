import "@ogdakke/fluidbox/elements";
import { mountChrome } from "@ogdakke/fluidbox-design/chrome";
import "./docs.css";
import type { DocModule } from "../markdown";
import { mountDemos } from "./demos";

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
/** The example site runs separately; `bun run dev:share` exposes it as fluidbox. */
const examplesUrl = env.VITE_EXAMPLES_URL ?? "https://fluidbox.local";

const sections = ["Start", "Guides", "Frameworks", "Reference"];
const pages = Object.values(
  import.meta.glob<{ default: DocModule }>("../content/*.md", { eager: true }),
)
  .map((module) => module.default)
  .sort(
    (a, b) =>
      sections.indexOf(a.section) - sections.indexOf(b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );

mountChrome({
  links: [
    { key: "docs", href: "/", label: "Docs" },
    { href: `${examplesUrl}/`, label: "Examples ↗" },
    { href: `${examplesUrl}/react/`, label: "React ↗" },
    { href: `${examplesUrl}/fixtures/`, label: "Fixtures ↗" },
  ],
  active: "docs",
  footer: [
    { href: `${examplesUrl}/`, label: "Examples" },
    { href: "/getting-started/", label: "Getting started" },
    { href: "/api/", label: "API" },
  ],
});

const nav = document.querySelector<HTMLElement>("#docs-nav")!;
const content = document.querySelector<HTMLElement>("#content")!;
const toc = document.querySelector<HTMLOListElement>("#docs-toc")!;
const menu = document.querySelector<HTMLDetailsElement>(".docs-nav__menu")!;

nav.innerHTML = sections
  .map((section) => {
    const items = pages.filter((page) => page.section === section);
    if (!items.length) return "";
    return `<p class="fb-label">${section}</p><ul>${items
      .map((page) => `<li><a href="${page.path}">${page.title}</a></li>`)
      .join("")}</ul>`;
  })
  .join("");

const normalize = (path: string) => (path.endsWith("/") ? path : `${path}/`);

function render(path: string, hash: string) {
  const index = pages.findIndex((page) => page.path === normalize(path));
  const page = pages[index];
  for (const link of nav.querySelectorAll("a")) {
    if (link.getAttribute("href") === page?.path) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (!page) {
    document.title = "Not found — Fluidbox docs";
    content.innerHTML = `<article class="prose"><p class="fb-label">404</p><h1>Page not found</h1><p>Try the <a href="/">introduction</a>.</p></article>`;
    toc.replaceChildren();
    return;
  }
  document.title = page.slug === "index" ? "Fluidbox docs" : `${page.title} — Fluidbox docs`;
  const previous = pages[index - 1];
  const next = pages[index + 1];
  content.innerHTML = `
    <article class="prose">
      <p class="fb-label">${page.section}</p>
      ${page.html}
    </article>
    <nav class="docs-pager fb-grid" aria-label="Pagination">
      ${previous ? `<a class="fb-cell" href="${previous.path}"><span class="fb-label">Previous</span>${previous.title}</a>` : "<span></span>"}
      ${next ? `<a class="fb-cell docs-pager__next" href="${next.path}"><span class="fb-label">Next</span>${next.title}</a>` : "<span></span>"}
    </nav>`;
  toc.innerHTML = page.headings
    .map(
      (heading) =>
        `<li class="docs-toc__${heading.depth}"><a href="#${heading.id}">${heading.text}</a></li>`,
    )
    .join("");
  mountDemos(content);
  if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  else window.scrollTo(0, 0);
}

// Client-side navigation for internal links; everything else behaves normally.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.origin !== location.origin) return;
  if (link.pathname === location.pathname && link.hash) return;
  if (!pages.some((page) => page.path === normalize(link.pathname))) return;
  event.preventDefault();
  history.pushState(null, "", link.pathname + link.hash);
  if (matchMedia("(max-width: 900px)").matches) menu.open = false;
  render(link.pathname, link.hash);
});

addEventListener("popstate", () => render(location.pathname, location.hash));
if (matchMedia("(max-width: 900px)").matches) menu.open = false;
render(location.pathname, location.hash);
