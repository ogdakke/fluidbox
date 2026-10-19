/// <reference types="vite/client" />
declare module "virtual:docs-pages" {
  import type { DocMeta } from "./render";
  export const pages: DocMeta[];
  export const loaders: Record<string, () => Promise<{ default: string }>>;
}
