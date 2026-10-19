import "@ogdakke/fluidbox/elements";
import "@ogdakke/fluidbox/styles.css";
import { mountChrome } from "@ogdakke/fluidbox-design/chrome";
import { loaders, pages } from "virtual:docs-pages";
import "./docs.css";
import { mountDemos } from "./demos";
import { renderArticle, renderNav, renderToc } from "./render";
import { mountTabs, unmountTabs } from "./tabs";
import { siteLinks } from "./site";

mountChrome({ ...siteLinks, active: "docs" });

const nav = document.querySelector<HTMLElement>("#docs-nav")!;
const content = document.querySelector<HTMLElement>("#content")!;
const toc = document.querySelector<HTMLOListElement>("#docs-toc")!;
const menu = document.querySelector<HTMLDetailsElement>(".docs-nav__menu")!;

const normalize = (path: string) => (path.endsWith("/") ? path : `${path}/`);
let renderId = 0;

async function render(path: string, hash: string) {
  const id = ++renderId;
  const index = pages.findIndex((page) => page.path === normalize(path));
  const page = pages[index];
  nav.innerHTML = renderNav(pages, page?.path ?? "");
  if (!page) {
    unmountTabs();
    document.title = "Not found — Fluidbox docs";
    content.innerHTML = `<article class="prose"><p class="fb-label">404</p><h1>Page not found</h1><p>Try the <a href="/docs/">introduction</a>.</p></article>`;
    toc.replaceChildren();
    return;
  }
  const html = (await loaders[page.path]!()).default;
  if (id !== renderId) return;
  unmountTabs();
  document.title = page.slug === "index" ? "Fluidbox docs" : `${page.title} — Fluidbox docs`;
  content.innerHTML = renderArticle(page, html, pages[index - 1], pages[index + 1]);
  toc.innerHTML = renderToc(page.headings);
  show(hash);
}

function show(hash: string) {
  mountDemos(content);
  mountTabs(content);
  if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  else window.scrollTo(0, 0);
}

// Client-side navigation between docs pages; everything else behaves normally.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.origin !== location.origin) return;
  if (link.pathname === location.pathname && link.hash) return;
  if (!pages.some((page) => page.path === normalize(link.pathname))) return;
  event.preventDefault();
  history.pushState(null, "", link.pathname + link.hash);
  if (matchMedia("(max-width: 900px)").matches) menu.open = false;
  void render(link.pathname, link.hash);
});

addEventListener("popstate", () => void render(location.pathname, location.hash));
if (matchMedia("(max-width: 900px)").matches) menu.open = false;
// The page arrives prerendered; only wire it up.
if (content.childElementCount) {
  const hash = location.hash;
  mountDemos(content);
  mountTabs(content);
  if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
} else {
  void render(location.pathname, location.hash);
}
