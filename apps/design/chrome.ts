// The layer order first, then the package CSS, so the shared overrides in
// index.css win on equal specificity.
import "./layers.css";
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import "./index.css";
import { mountCopyButtons } from "./copy";
import { uiIcon } from "./icons";

export type NavLink = { readonly href: string; readonly label: string; readonly key?: string };

export type ChromeOptions = {
  readonly links: readonly NavLink[];
  /** Key of the current page's nav link. */
  readonly active?: string;
  readonly footer?: readonly NavLink[];
  /** Fixture pages pass a one-line description; their header scrolls away. */
  readonly fixture?: string;
};

const storageKey = "fluidbox-theme";

function readTheme(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeTheme(theme: string) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Private windows and blocked storage only lose the remembered choice.
  }
}

function currentTheme(): "light" | "dark" {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const link = (item: NavLink, active?: string) =>
  `<a href="${item.href}"${item.key !== undefined && item.key === active ? ' aria-current="page"' : ""}>${item.label}</a>`;

/** Insert the shared header and footer. */
export function mountChrome(options: ChromeOptions): void {
  const saved = readTheme();
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;

  const header = document.createElement("header");
  // Fixture headers scroll away so they never sit on top of an element a test clicks.
  header.className = options.fixture ? "fb-header fb-header--static" : "fb-header";
  header.innerHTML = `
    <div class="fb-shell fb-header__inner">
      <a class="fb-brand" href="/"><span class="fb-brand__mark" aria-hidden="true"></span><span>Fluidbox</span></a>
      <nav class="fb-nav" aria-label="Pages">
        ${options.links.map((item) => link(item, options.active)).join("")}
      </nav>
      <button type="button" class="fb-theme-toggle" aria-label="Toggle color theme">${uiIcon("sun", 15)}</button>
    </div>`;
  header.querySelector("button")!.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    writeTheme(next);
  });
  document.body.prepend(header);

  if (options.fixture) {
    const strip = document.createElement("div");
    strip.className = "fb-fixture-strip";
    strip.innerHTML = `<div class="fb-shell fb-pad fb-fixture-strip__inner"><p class="fb-label">Fixture</p><p class="fb-muted" style="margin:0;font-size:13px"></p></div>`;
    strip.querySelector(".fb-muted")!.textContent = options.fixture;
    header.after(strip);
  }

  const footer = document.createElement("footer");
  footer.className = "fb-footer";
  footer.innerHTML = `
    <div class="fb-shell fb-pad fb-footer__inner">
      <span>@ogdakke/fluidbox</span>
      <nav aria-label="Footer">${(options.footer ?? []).map((item) => link(item)).join("<span>/</span>")}</nav>
    </div>`;
  document.body.append(footer);
  mountCopyButtons();
}
