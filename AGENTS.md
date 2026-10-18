# Codex instructions

This is a Bun workspace. The only installable package is `packages/fluidbox`.

- Use `bun install` for dependencies and `bun run <script>` for scripts.
- Use `bun run build` for tsdown, `bun run test` for Vitest, `bun run test:ssr` and `bun run test:bundle` for package checks, `bun run lint:all` for oxlint and TypeScript 7, and `bun run format:check` for oxfmt.
- Keep the package root safe to import without browser globals. Custom-element registration belongs in the browser-only `./elements` entry.
- Keep gesture, zoom, transition, gallery, and portal behavior in the runtime package. Add framework bindings as subpath exports in the same package.
- Preserve the body-level custom portal. Do not replace it with a native `dialog`.
- `portfolio-v4` consumes this package through a sibling `file:` link and retains its own Markdown plugins and media registry.
- `apps/examples` is the example site and the Playwright fixture server; `apps/docs` is the docs site (Markdown in `apps/docs/content`, highlighted with `@pierre/highlights`). Both use the shared design system in `apps/design`; every page, fixtures included, uses it.
- Serve with portless: `bun run dev:share` (examples as `fluidbox`) and `bun run docs:share` (docs as `docs.fluidbox`), both with `--lan --tailscale`.
