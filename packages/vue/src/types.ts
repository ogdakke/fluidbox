import type { VNodeChild } from "vue";
import type {
  FluidboxItem,
  FluidboxItems,
  FluidboxState,
  FluidboxStatus,
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

/** The viewer's commands. Each resolves true once it happened, false when it was prevented. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  /** Open on an item, by index or id, or move to it while open. */
  open(target?: FluidboxTarget): Promise<boolean>;
  close(): Promise<boolean>;
  next(): Promise<boolean>;
  previous(): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
}

/**
 * What `useFluidbox()` returns and Root's default slot gets: the state and the
 * commands, in one reactive object. Read its fields where you use them; a
 * destructured field in `<script setup>` stops following the viewer.
 */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

/** Reads and moves the sheet, from `useFluidboxSheet()` or the Sheet slot. */
export interface FluidboxSheetApi {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: number;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}

/** The default slot of Trigger: the item it shows, which follows the viewer while it is open. */
export interface FluidboxTriggerSlotProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Null when the trigger's items have left the list. */
  readonly item: TItem | null;
  readonly index: number | null;
  readonly status: FluidboxStatus;
}

/** The default slot of Filmstrip: one thumbnail. The strip marks the selected button `data-fluidbox-selected`. */
export interface FluidboxFilmstripSlotProps<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

/** The default slot of Sheet: the active item, and the sheet. */
export interface FluidboxSheetSlotProps<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxSheetApi {
  readonly item: TItem;
  readonly index: number;
}
