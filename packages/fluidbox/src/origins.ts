import type { FluidboxItem, FluidboxOptions } from "./public-api";

type TriggerFinders<TItem extends FluidboxItem> = Pick<
  FluidboxOptions<TItem>,
  "findTrigger" | "revealTrigger"
>;

/**
 * Give fluidbox options a `findTrigger` and `revealTrigger` that read the
 * newest ones on every use, as a framework prop changes. Without a
 * `revealTrigger` then, the viewer scrolls the trigger into view.
 */
export function latestFindTrigger<
  TItem extends FluidboxItem,
  TOptions extends FluidboxOptions<TItem>,
>(options: TOptions, read: () => TriggerFinders<TItem> | null | undefined): TOptions {
  return Object.defineProperties(options, {
    findTrigger: { get: () => read()?.findTrigger, enumerable: true },
    revealTrigger: { get: () => read()?.revealTrigger, enumerable: true },
  });
}
