# Codex instructions

This is a Bun workspace. The only published package is `packages/fluidbox` (`@ogdakke/fluidbox`). The framework bindings live in private workspace packages (`packages/react`, `solid`, `vue`, `angular`), each with its own build; `scripts/build.ts` copies their `dist` into the core's `dist/<framework>/`, published as `@ogdakke/fluidbox/<framework>`.

- Use `bun install` for dependencies and `bun run <script>` for scripts.
- Use `bun run build` for tsdown, `bun run test` for Vitest, `bun run test:ssr` and `bun run test:bundle` for package checks, `bun run lint:all` for oxlint and TypeScript 7, and `bun run format:check` for oxfmt.
- Keep the package root safe to import without browser globals. Custom-element registration belongs in the browser-only `./elements` entry. The sheet and filmstrip register through side-effect imports of `./sheet` and `./filmstrip`.
- Items are flat (`type: "img" | "video" | "iframe" | "custom"` with HTML attribute names) in the public API and inside the runtime alike; there is no conversion layer.
- Keep gesture, zoom, transition, gallery, and portal behavior in the runtime package. Bindings use only the plain JS API, the add-on entries and the binding kit (`@ogdakke/fluidbox/kit`, `src/kit.ts`), never the custom elements. Every binding, the custom elements and the plain JS API support the same patterns.
- Preserve the body-level custom portal. Do not replace it with a native `dialog`.
- `portfolio-v4` consumes this package through a sibling `file:` link and retains its own Markdown plugins and media registry.
- Every framework implements the ten patterns in `apps/examples/src/patterns/<framework>/` against `CONTRACT.md` there; `tests/browser/patterns.spec.ts` checks them, and the docs show the `#region example` parts.
- `apps/examples` is the example site and the Playwright fixture server; `apps/docs` is the docs site (Markdown in `apps/docs/content`, highlighted with `@pierre/highlights`). Both use the shared design system in `apps/design`; every page, fixtures included, uses it.
- Serve with portless: `bun run dev:share` (examples as `fluidbox`) and `bun run docs:share` (docs as `docs.fluidbox`), both with `--lan --tailscale`.
