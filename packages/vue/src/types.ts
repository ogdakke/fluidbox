import type { VNodeChild } from "vue";
import type {
  FluidboxCommandOptions,
  FluidboxItem,
  FluidboxItems,
  FluidboxState,
  FluidboxTarget,
} from "@ogdakke/fluidbox";

/** What a renderer gets: the item, its index and an abort signal. */
export interface FluidboxVueRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** Aborted when the viewer lets go of the slide. */
  readonly signal: AbortSignal;
}

/** Draws a `custom` item, keyed by its `render`. Return any Vue content, such as `h(Note)`. */
export type FluidboxVueRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxVueRenderContext<TItem>,
) => VNodeChild;

/** What the Sheet and Filmstrip slots get: the item they draw and its index. */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

/** The viewer's commands. Each resolves true once it happened, false when it was prevented. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  /** Open on an item, its index or its id, or move to it while open. */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void;
  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean>;
}

/**
 * What `useFluidbox()` returns and Root's default slot gets: the state and the
 * commands, in one reactive object. Read its fields where you use them; a
 * destructured field in `<script setup>` stops following the viewer.
 */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

/** Reads and moves the sheet, from `useFluidboxSheet()`. `stop` follows `sheetchange`. */
export interface FluidboxSheetApi {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: number;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}
