import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type {
  FluidboxChangeEvent,
  FluidboxCommandOptions,
  FluidboxItem,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOptions,
  FluidboxOriginAdapter,
  FluidboxSheetOptions,
  FluidboxState,
  FluidboxTarget,
  FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
import type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

/** What a React renderer gets: the item it draws, and a signal aborted when it leaves. */
export interface FluidboxReactRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly signal: AbortSignal;
}

/** Draws a `custom` item as React content, rendered in place with the app's context. */
export type FluidboxReactRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxReactRenderContext<TItem>,
) => ReactNode;

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** An array, or a list read on demand. A new value replaces the items. */
  readonly items: FluidboxItems<TItem>;
  /** Your strings for the viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Zoom steps, or `false` to turn zoom off. Compared by value. */
  readonly zoom?: FluidboxOptions<TItem>["zoom"];
  /** Draw `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxReactRenderer<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter;
  /** Before the viewer opens or closes. `event.preventDefault()` stops it. */
  readonly onBeforeToggle?: (event: FluidboxToggleEvent) => void;
  /** As the viewer starts to open or close. */
  readonly onToggle?: (event: FluidboxToggleEvent) => void;
  /** Before the viewer moves to another item. `event.preventDefault()` stops it. */
  readonly onBeforeItemChange?: (event: FluidboxChangeEvent<TItem>) => void;
  /** When the active item changes, opening included. */
  readonly onItemChange?: (event: FluidboxChangeEvent<TItem>) => void;
  /** When the active item comes to rest. */
  readonly onSettle?: (event: FluidboxChangeEvent<TItem>) => void;
  readonly children?: ReactNode;
}

export interface FluidboxItemProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The item, its id or its index, for the `Trigger` and `ThumbnailOverlay` inside. */
  readonly item: TItem | FluidboxTarget;
  readonly children?: ReactNode;
}

/** What a trigger's render function gets: the item it shows, which follows the viewer. */
export type FluidboxTriggerRenderContext<TItem extends FluidboxItem = FluidboxItem> =
  FluidboxTriggerPreview<TItem>;

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Decorate the single child element instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /** The item to open: the item, its id or its index. Defaults to the first of `items`, then the enclosing Item. */
  readonly item?: TItem | FluidboxTarget;
  /** Every item that may return to this trigger on close, as for an album cover. */
  readonly items?: readonly (TItem | FluidboxTarget)[];
  readonly children: ReactNode | ((context: FluidboxTriggerRenderContext<TItem>) => ReactNode);
}

export interface FluidboxViewerProps {
  /** Your controls and captions, rendered into the viewer. */
  readonly children?: ReactNode;
}

export interface FluidboxActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export interface FluidboxFilmstripRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

export interface FluidboxFilmstripProps<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Renders one thumbnail into its button. Leave it out for the default
   * thumbnails. The selected button has `data-fluidbox-selected`.
   */
  readonly children?: (context: FluidboxFilmstripRenderContext<TItem>) => ReactNode;
}

export interface FluidboxSheetProps
  extends HTMLAttributes<HTMLDivElement>, Pick<FluidboxSheetOptions, "snapPoints" | "dismiss"> {
  /** The sheet's content for the active item. */
  readonly children?: ReactNode;
}

export interface FluidboxSheetStopProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The stop the button moves the sheet to. */
  readonly stop: number;
}

export interface FluidboxThumbnailOverlayProps extends HTMLAttributes<HTMLSpanElement> {
  /** Fly with the photo, rendered live in the flying frame. */
  readonly travel?: boolean;
}

/** The commands `useFluidbox` hands back with the state. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  readonly open: (target?: FluidboxTarget, options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly close: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly next: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly previous: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly setItems: (items: FluidboxItems<TItem>) => Promise<boolean>;
}

/** The viewer state and its commands. */
export type FluidboxValue<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

export interface UseFluidbox {
  <TItem extends FluidboxItem = FluidboxItem>(): FluidboxValue<TItem>;
  <TSelected, TItem extends FluidboxItem = FluidboxItem>(
    selector: (value: FluidboxValue<TItem>) => TSelected,
  ): TSelected;
}

/** The sheet's stop and a function that moves it. */
export interface FluidboxSheetValue {
  /** 0 at rest, then one per snap point. 0 while the sheet is not there. */
  readonly stop: number;
  readonly set: (stop: number, options?: { readonly animate?: boolean }) => void;
}
