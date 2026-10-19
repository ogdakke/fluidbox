import type {
  FluidboxFilmstripOptions,
  FluidboxReason,
  FluidboxSheet,
  FluidboxSheetOptions,
} from "./public-api";
import type { FluidboxExtension, FluidboxItem as RuntimeItem } from "./runtime-types";

export interface Addon<THandle> {
  readonly extension: FluidboxExtension<RuntimeItem>;
  readonly handle: THandle;
}

interface Addons {
  sheet?: (
    options: FluidboxSheetOptions<any>,
    onChange: (stop: number, reason: FluidboxReason) => void,
  ) => Addon<FluidboxSheet>;
  filmstrip?: (options: FluidboxFilmstripOptions<any>) => Addon<null>;
}

// One registry per page, however many copies of the entries a bundler makes.
const key = Symbol.for("@ogdakke/fluidbox/addons");
const registry = (): Addons => ((globalThis as { [key]?: Addons })[key] ??= {});

/** Called by an add-on's entry when it is imported. */
export function registerAddon<K extends keyof Addons>(name: K, create: NonNullable<Addons[K]>) {
  registry()[name] = create;
}

/** An add-on's factory, or an error that names the import it needs. */
export function addon<K extends keyof Addons>(name: K): NonNullable<Addons[K]> {
  const create = registry()[name];
  if (!create) {
    throw new Error(`The ${name} needs its entry: import "@ogdakke/fluidbox/${name}" once.`);
  }
  return create;
}

/** Whether an add-on's entry has been imported. */
export function hasAddon(name: keyof Addons): boolean {
  return !!registry()[name];
}

/** The add-ons that load from their own entry. */
export type FluidboxAddonName = "sheet" | "filmstrip";

/**
 * Load the entries of the add-ons a binding's parts turn on, so a binding
 * costs nothing for add-ons nobody renders. Returns null when they are all
 * loaded already, so the viewer can still be made synchronously.
 */
export function loadAddons(names: readonly FluidboxAddonName[]): Promise<void> | null {
  const missing = names.filter((name) => !hasAddon(name));
  if (!missing.length) return null;
  return Promise.all(
    missing.map((name) =>
      name === "sheet" ? import("./sheet-entry") : import("./filmstrip-entry"),
    ),
  ).then(() => {});
}
