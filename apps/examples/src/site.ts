import { mountChrome, type NavLink } from "@ogdakke/fluidbox-design/chrome";

export type PageKey =
  | "overview"
  | "elements"
  | "javascript"
  | "react"
  | "solid"
  | "vue"
  | "angular"
  | "fixtures";

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
/** The docs app runs separately; `bun run docs:share` exposes it as docs.fluidbox. */
export const docsUrl = env.VITE_DOCS_URL ?? "https://docs.fluidbox.local";

const links: NavLink[] = [
  { key: "overview", href: "/", label: "Overview" },
  { key: "elements", href: "/elements/", label: "Elements" },
  { key: "javascript", href: "/javascript/", label: "JavaScript" },
  { key: "react", href: "/react/", label: "React" },
  { key: "solid", href: "/solid/", label: "Solid" },
  { key: "vue", href: "/vue/", label: "Vue" },
  { key: "angular", href: "/angular/", label: "Angular" },
  { key: "fixtures", href: "/fixtures/", label: "Fixtures" },
  { href: docsUrl, label: "Docs ↗" },
];

/** Mount the example site's header and footer. */
export function mountSite(active: PageKey, options: { fixture?: string } = {}): void {
  mountChrome({
    links,
    active,
    fixture: options.fixture,
    footer: [
      { href: docsUrl, label: "Docs" },
      { href: "/fixtures/", label: "Fixtures" },
      { href: "/react/", label: "React" },
    ],
  });
}
