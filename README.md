# Lightbox

The viewer extracted from `portfolio-v4`. This repository is a Bun workspace with one installable package, `@dw/lightbox`. It is private and linked locally while the public API is being developed.

## Current usage

```ts
import "@dw/lightbox/elements";
import "@dw/lightbox/styles.css";
```

The `elements` entry registers `<app-lightbox>`, `<app-gallery>`, and `<app-filmstrip>`. The CSS entry is explicit. See [the styling and markup contract](docs/LIGHTBOX.md) for slots, state attributes, and styling hooks.

The root import is safe to evaluate during server rendering:

```ts
import { registerLightboxElements } from "@dw/lightbox";

// Run after hydration or in a client-only entry.
await registerLightboxElements();
```

The current element implementation remains browser-only. Framework bindings and an imperative controller are the next API layer; they are not exported yet. Bindings will use distinct `/react`, `/solid`, `/vue`, and `/angular` entries in this same package.

## Development

```sh
bun install
bun run dev                 # Standalone vanilla example
bun run build:example       # Build that example
bun run test
bun run lint:all
bun run format:check
bun run format
```

The repository has one package under `packages/lightbox`. Workspace example apps can be added under `examples/` to exercise framework bindings and SSR without creating more installable packages.

`portfolio-v4` links the package with `file:../lightbox/packages/lightbox`. A checkout of both repositories as siblings is required for its local install and build.
