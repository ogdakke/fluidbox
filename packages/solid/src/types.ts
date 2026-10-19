import type { Accessor, JSX, ValidComponent } from "solid-js";
import type {
  FluidboxChangeEvent,
  FluidboxCommandOptions,
  FluidboxItem,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOriginAdapter,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxTarget,
  FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
import type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

export type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

export interface FluidboxSolidRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  /** Aborted when the content is no longer shown. */
  readonly signal: AbortSignal;
}

/** Renders a custom item. It runs under Root, so context provided around Root reaches it. */
export type FluidboxSolidRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxSolidRenderContext<TItem>,
) => JSX.Element;

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The gallery's items: an array or a lazy list. Tracked: pass a new one to change the gallery. */
  readonly items: FluidboxItems<TItem>;
  /** Your strings for the viewer. Changing it rebuilds the viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Pinch, double-tap, wheel and keyboard zoom of images. `false` turns it off. */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Render `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxSolidRenderer<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter;
  /** Before the viewer opens or closes. `event.preventDefault()` cancels a command. */
  readonly onBeforeToggle?: (event: FluidboxToggleEvent) => void;
  /** As the viewer starts to open or close. */
  readonly onToggle?: (event: FluidboxToggleEvent) => void;
  /** Before the viewer moves to another item. `event.preventDefault()` keeps it still. */
  readonly onBeforeItemChange?: (event: FluidboxChangeEvent<TItem>) => void;
  /** When the active item changes, opening included. */
  readonly onItemChange?: (event: FluidboxChangeEvent<TItem>) => void;
  /** When the active item comes to rest. */
  readonly onSettle?: (event: FluidboxChangeEvent<TItem>) => void;
  readonly children?: JSX.Element;
}

export interface FluidboxItemProps {
  /** The item id that the Trigger and ThumbnailOverlay inside default to. */
  readonly id: string;
  readonly children?: JSX.Element;
}

export type FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "ref"
> & {
  /** The element or component to render instead of a button. It must forward `ref` and events. */
  readonly as?: ValidComponent;
  /** The item to open: the item, its id or its index. Defaults to the first of `items`, then the enclosing Item. */
  readonly item?: TItem | FluidboxTarget;
  /** Every item that may return to this trigger on close, as for an album cover. */
  readonly items?: readonly (TItem | FluidboxTarget)[];
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
  /** Fly with the photo: the children render again in the flying frame. */
  readonly travel?: boolean;
}

export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

export interface FluidboxFilmstripProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Renders one thumbnail into its button. Without it, the strip shows the default images. */
  readonly children?: (thumb: FluidboxItemContext<TItem>) => JSX.Element;
}

export interface FluidboxSheetProps<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * The stops above the resting one, lowest first.
   * @default ["60%", "content"]
   */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /** What a swipe down on the photo does with the sheet down. @default "flight" */
  readonly dismiss?: "flight" | "scroll" | "none";
  /** The sheet's content for the active item, or a function of it. */
  readonly children?: JSX.Element | ((active: FluidboxItemContext<TItem>) => JSX.Element);
}

/**
 * The viewer's state and commands. The state fields are reactive getters:
 * read them in JSX or an effect, and don't destructure them.
 */
export interface FluidboxApi<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxState<TItem> {
  open(target?: FluidboxTarget, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
}

export interface FluidboxSheetApi {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. */
  readonly stop: Accessor<number>;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}

export interface FluidboxSolidParts {
  Root: <TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>) => JSX.Element;
  Item: (props: FluidboxItemProps) => JSX.Element;
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
}
