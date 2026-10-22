import type { Accessor, JSX, ValidComponent } from "solid-js";
import type {
  FluidboxCommandOptions,
  FluidboxItem,
  FluidboxItemChangeEvent,
  FluidboxItems,
  FluidboxLabels,
  FluidboxLoading,
  FluidboxOriginAdapter,
  FluidboxSheetEvent,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxTarget,
  FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
import type { FluidboxChangeDetails, FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

export type { FluidboxChangeDetails, FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

export interface FluidboxSolidRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** Aborted when the content is no longer shown. */
  readonly signal: AbortSignal;
  /** Whether the slide is the one on show. */
  readonly active: boolean;
  /**
   * Call `listener` with the new `active` as the slide comes to be the one on
   * show or stops being it, to play and pause. Returns a function that stops it.
   */
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
}

/** Renders a custom item. It runs under Root, so context provided around Root reaches it. */
export type FluidboxSolidRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxSolidRenderContext<TItem>,
) => JSX.Element;

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The gallery's items: an array or a lazy list. Tracked: pass a new one to change the gallery. */
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
  /** Your strings for the viewer. Changes apply to an open viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Pinch, double-tap, wheel and keyboard zoom of images. `false` turns it off. Changes apply to an open viewer. */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Render `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxSolidRenderer<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter<TItem>;
  /** When the viewer's code loads: on `"hover"` (the default), on `"press"`, or `"eager"`ly. */
  readonly loading?: FluidboxLoading;
  /** Before the viewer opens or closes. `event.preventDefault()` cancels a command. */
  readonly onBeforeToggle?: (event: FluidboxToggleEvent) => void;
  /** As the viewer starts to open or close. */
  readonly onToggle?: (event: FluidboxToggleEvent) => void;
  /** Before the viewer moves to another item. `event.preventDefault()` keeps it still. */
  readonly onBeforeItemChange?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the active item changes, opening included. */
  readonly onItemChange?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the active item comes to rest. */
  readonly onSettle?: (event: FluidboxItemChangeEvent<TItem>) => void;
  /** When the sheet comes to rest at another stop. */
  readonly onSheetChange?: (event: FluidboxSheetEvent) => void;
  readonly children?: JSX.Element;
}

export type FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "ref"
> & {
  /** The element or component to render instead of a button. It must forward `ref` and events. */
  readonly as?: ValidComponent;
  /** The item to open: the item, its id or its index. */
  readonly item: FluidboxTarget<TItem>;
  /** More items that close back onto this trigger, as for an album cover. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
  readonly ref?: HTMLElement | ((element: HTMLElement) => void);
  /** Content, or a function of the preview, which follows the viewer while it is open. */
  readonly children?:
    | JSX.Element
    | ((preview: Accessor<FluidboxTriggerPreview<TItem>>) => JSX.Element);
  /** Attributes for an `as` element or component. */
  readonly [attribute: string]: unknown;
};

export interface FluidboxViewerProps {
  /** Your controls and captions, rendered into the viewer. */
  readonly children?: JSX.Element;
}

export interface FluidboxActionProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface FluidboxSheetStopProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The stop to move the sheet to. Pressed at that stop, it lowers the sheet to 0. */
  readonly stop: number;
}

export interface FluidboxThumbnailOverlayProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  /** Fly with the photo: the children render again, live, in the flying frame. */
  readonly travel?: boolean;
}

export interface FluidboxFrameLayerProps extends JSX.HTMLAttributes<HTMLSpanElement> {}

export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

export interface FluidboxFilmstripProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Renders one thumbnail into its button. Without it, the strip shows the default images. */
  readonly children?: (thumb: FluidboxItemContext<TItem>) => JSX.Element;
}

/** Attributes for the sheet's `<section data-fluidbox-sheet>`, and its content. */
export interface FluidboxSheetProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  JSX.HTMLAttributes<HTMLElement>,
  "children"
> {
  /**
   * The stops above the resting one, lowest first.
   * @default ["60%", "content"]
   */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /** What a swipe down on the photo does with the sheet down. @default "flight" */
  readonly dismiss?: "flight" | "scroll" | "none";
  /** Renders the sheet's content for the active item. */
  readonly children?: (active: FluidboxItemContext<TItem>) => JSX.Element;
}

/**
 * The viewer's state and commands. The state fields are reactive getters:
 * read them in JSX or an effect, and don't destructure them.
 */
export interface FluidboxApi<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxState<TItem> {
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

export interface FluidboxSheetApi {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. Follows `sheetchange`. */
  readonly stop: Accessor<number>;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}

export interface FluidboxSolidParts {
  Root: <TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>) => JSX.Element;
  Trigger: <TItem extends FluidboxItem>(props: FluidboxTriggerProps<TItem>) => JSX.Element;
  Viewer: (props: FluidboxViewerProps) => JSX.Element;
  Controls: () => JSX.Element;
  Close: (props: FluidboxActionProps) => JSX.Element;
  Previous: (props: FluidboxActionProps) => JSX.Element;
  Next: (props: FluidboxActionProps) => JSX.Element;
  Filmstrip: <TItem extends FluidboxItem>(props: FluidboxFilmstripProps<TItem>) => JSX.Element;
  Sheet: <TItem extends FluidboxItem>(props: FluidboxSheetProps<TItem>) => JSX.Element;
  SheetStop: (props: FluidboxSheetStopProps) => JSX.Element;
  ThumbnailOverlay: (props: FluidboxThumbnailOverlayProps) => JSX.Element;
  FrameLayer: (props: FluidboxFrameLayerProps) => JSX.Element;
}
