# Codex instructions

This is a Bun workspace. The only installable package is `packages/lightbox`.

- Use `bun install` for dependencies and `bun run <script>` for scripts.
- Use `bun run test` for Vitest, `bun run lint:all` for oxlint and TypeScript 7, and `bun run format:check` for oxfmt.
- Keep the package root safe to import without browser globals. Custom-element registration belongs in the browser-only `./elements` entry.
- Keep gesture, zoom, transition, gallery, and portal behavior in the runtime package. Add framework bindings as subpath exports in the same package.
- Preserve the body-level custom portal. Do not replace it with a native `dialog`.
- `portfolio-v4` consumes this package through a sibling `file:` link and retains its own Markdown plugins and media registry.
