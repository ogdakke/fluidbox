import type { ButtonHTMLAttributes, DOMAttributes, HTMLAttributes, ReactNode } from "react";
import type {
  FluidboxCommandOptions,
  FluidboxItem,
  FluidboxItemChangeEvent,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOptions,
  FluidboxOriginAdapter,
  FluidboxSheetEvent,
  FluidboxSheetOptions,
  FluidboxState,
  FluidboxTarget,
  FluidboxToggleEvent,
  FluidboxZoomCommandOptions,
  FluidboxZoomEvent,
} from "@ogdakke/fluidbox";
import type { FluidboxChangeDetails, FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

/** What a React renderer gets: the item it draws, and a signal aborted when it leaves. */
export interface FluidboxReactRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly signal: AbortSignal;
  /** Whether the slide is the one on show. */
  readonly active: boolean;
  /**
   * Call `listener` with the new `active` as the slide comes to be the one on
   * show or stops being it, to play and pause. Returns a function that stops it.
   */
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
}

/** Draws a `custom` item as React content, rendered in place with the app's context. */
export type FluidboxReactRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxReactRenderContext<TItem>,
) => ReactNode;

/** What the Sheet's and the Filmstrip's render functions get: the item they draw. */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** An array, or a list read on demand. A new value replaces the items. */
  readonly items: FluidboxItems<TItem>;
  /**
   * Whether the viewer is open, when your state owns it. The viewer opens on
   * `index` and closes when this changes. Leave it out to let triggers own it.
   */
  readonly open?: boolean;
  /** The item the viewer shows, when your state owns it. */
  readonly index?: number;
  /** As the viewer opens or closes, from any input. Set `open` to follow it. */
  readonly onOpenChange?: (open: boolean, details: FluidboxChangeDetails) => void;
  /** As the viewer moves to another item, opening included. Set `index` to follow it. */
  readonly onIndexChange?: (index: number, details: FluidboxChangeDetails) => void;
  /** Go round: past the last item comes the first. A single item never loops. */
  readonly loop?: boolean;
  /**
   * Where the viewer's controls lead before JavaScript runs, when the server
   * renders it open: `null` for Close, an index for Previous and Next.
   */
  readonly href?: (index: number | null) => string | undefined;
  /** Your strings for the viewer. They change the open viewer in place. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Zoom steps, or `false` to turn zoom off. Compared by value. */
  readonly zoom?: FluidboxOptions<TItem>["zoom"];
  /** Draw `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxReactRenderer<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter<TItem>;
  /** When the viewer's code loads: on `"hover"` (the default), on `"press"`, or `"eager"`ly. */
  readonly loading?: FluidboxOptions<TItem>["loading"];
  /** Before the viewer opens or closes. `event.preventDefault()` stops it. */
  readonly onBeforeToggle?: (event: FluidboxToggleEvent) => void;
  /** As the viewer starts to open or close. */
  readonly onToggle?: (event: FluidboxToggleEvent) => void;
  /** Before the viewer moves to another item. `event.preventDefault()` stops it. */
  readonly onBeforeItemChange?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the active item changes, opening included. */
  readonly onItemChange?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the active item comes to rest. */
  readonly onSettle?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the sheet comes to rest at another stop. */
  readonly onSheetChange?: (event: FluidboxSheetEvent) => void;
  /** When the image on show comes to rest at another zoom. */
  readonly onZoomChange?: (event: FluidboxZoomEvent) => void;
  readonly children?: ReactNode;
}

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Decorate the single child element instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /** The item to open: the item, its id or its index. */
  readonly item: FluidboxTarget<TItem>;
  /** More items that close back onto this trigger, as for an album cover. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  readonly children: ReactNode | ((preview: FluidboxTriggerPreview<TItem>) => ReactNode);
}

export interface FluidboxViewerProps {
  /** Your controls and captions, rendered into the viewer. */
  readonly children?: ReactNode;
}

export interface FluidboxActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export interface FluidboxControlsProps {
  /** Add the zoom-in, zoom-out and fit controls, in their group. */
  readonly zoom?: boolean;
}

export interface FluidboxFilmstripProps<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Renders one thumbnail into its button. Leave it out for the default
   * thumbnails. The selected button has `data-fluidbox-selected`.
   */
  readonly children?: (context: FluidboxItemContext<TItem>) => ReactNode;
}

export interface FluidboxSheetProps<TItem extends FluidboxItem = FluidboxItem>
  extends
    Omit<HTMLAttributes<HTMLElement>, keyof DOMAttributes<HTMLElement>>,
    Pick<FluidboxSheetOptions<TItem>, "snapPoints" | "dismiss"> {
  /** The sheet's content for the item on show. */
  readonly children?: (context: FluidboxItemContext<TItem>) => ReactNode;
}

export interface FluidboxSheetStopProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The stop the button moves the sheet to. */
  readonly stop: number;
}

export interface FluidboxThumbnailOverlayProps extends HTMLAttributes<HTMLSpanElement> {
  /** Fly with the photo, rendered live in the flying frame. */
  readonly travel?: boolean;
}

export interface FluidboxFrameLayerProps extends HTMLAttributes<HTMLSpanElement> {}

/** The commands `useFluidbox` hands back with the state. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  readonly open: (
    target?: FluidboxTarget<TItem>,
    options?: FluidboxCommandOptions,
  ) => Promise<boolean>;
  readonly close: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly next: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly previous: (options?: FluidboxCommandOptions) => Promise<boolean>;
  /** Zoom the image on show to a scale between 1 and the zoom's `max`. */
  readonly zoomTo: (scale: number, options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom in by 1.5. */
  readonly zoomIn: (options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom out by 1.5. */
  readonly zoomOut: (options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom back out to fit. */
  readonly resetZoom: (options?: Pick<FluidboxZoomCommandOptions, "signal">) => Promise<boolean>;
  readonly setItems: (items: FluidboxItems<TItem>) => Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  readonly preload: (target: FluidboxTarget<TItem>) => () => void;
  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  readonly load: () => Promise<boolean>;
}

/** The viewer state and its commands. */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

export interface UseFluidbox {
  <TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
  <TSelected, TItem extends FluidboxItem = FluidboxItem>(
    selector: (value: FluidboxApi<TItem>) => TSelected,
  ): TSelected;
}

/** The sheet's stop and a function that moves it. */
export interface FluidboxSheetApi {
  /** 0 at rest, then one per snap point. 0 while the sheet is not there. */
  readonly stop: number;
  readonly set: (stop: number, options?: { readonly animate?: boolean }) => void;
}
