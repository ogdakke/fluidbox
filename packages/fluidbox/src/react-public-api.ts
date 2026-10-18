import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from "react";
import type {
  FluidboxBeforeCommandEvent,
  FluidboxController,
  FluidboxEvent,
  FluidboxExtension,
  FluidboxItem,
  FluidboxOriginAdapter,
  FluidboxSource,
  FluidboxState,
  FluidboxThumbnailOverlayBehavior,
} from "./public-api";

export interface FluidboxReactRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly signal: AbortSignal;
}

export type FluidboxReactRenderer<TItem extends FluidboxItem = FluidboxItem> = (
  context: FluidboxReactRenderContext<TItem>,
) => ReactNode;

export type FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> = {
  readonly origins?: FluidboxOriginAdapter;
  readonly renderers?: Readonly<Record<string, FluidboxReactRenderer<TItem>>>;
  /** From `@ogdakke/fluidbox/filmstrip`. Keep it stable, as with useMemo or a module constant. */
  readonly filmstrip?: FluidboxExtension<TItem>;
  /** From `@ogdakke/fluidbox/sheet`. Render its content with `data-fluidbox-sheet` in a Fluidbox.Sheet. */
  readonly sheet?: FluidboxExtension<TItem>;
  readonly onBeforeCommand?: (event: FluidboxBeforeCommandEvent) => void;
  readonly onEvent?: (event: FluidboxEvent) => void;
  readonly children?: ReactNode;
} & (
  | { readonly source: FluidboxSource<TItem>; readonly items?: never }
  | { readonly items: readonly TItem[]; readonly source?: never }
);

export interface FluidboxItemProps {
  readonly id: string;
  readonly children?: ReactNode;
}

export interface FluidboxTriggerRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  /** Null when this trigger's items have been removed by source replacement. */
  readonly item: TItem | null;
  readonly index: number | null;
  readonly status: FluidboxState["status"];
}

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  readonly asChild?: boolean;
  /** Item opened by this trigger. Defaults to the first ID in items or the enclosing Item. */
  readonly item?: TItem | string;
  /** Every item that may return to this origin on close. */
  readonly items?: readonly (TItem | string)[];
  readonly children:
    | ReactElement
    | ((context: FluidboxTriggerRenderContext<TItem>) => ReactElement);
}

export interface FluidboxPortalProps {
  readonly children?: ReactNode;
}

export interface FluidboxSheetProps {
  /** The sheet passed to Root. */
  readonly sheet: {
    readonly slot: HTMLElement | null;
    subscribe(listener: (stop: number) => void): () => void;
  };
  readonly children?: ReactNode;
}

export interface FluidboxContentProps extends HTMLAttributes<HTMLDivElement> {}

export interface FluidboxThumbnailOverlayProps extends HTMLAttributes<HTMLSpanElement> {
  readonly behavior?: FluidboxThumbnailOverlayBehavior;
}

export interface FluidboxActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export interface FluidboxFilmstripRenderContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly selected: boolean;
}

export interface FluidboxFilmstripProps<
  TItem extends FluidboxItem = FluidboxItem,
> extends HTMLAttributes<HTMLDivElement> {
  readonly renderItem?: (context: FluidboxFilmstripRenderContext<TItem>) => ReactNode;
}

/** Type contract for the composed values implemented during the React binding spike. */
export interface FluidboxReactParts {
  Root: <TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>) => ReactElement | null;
  Item: (props: FluidboxItemProps) => ReactElement | null;
  Trigger: <TItem extends FluidboxItem>(props: FluidboxTriggerProps<TItem>) => ReactElement | null;
  Portal: (props: FluidboxPortalProps) => ReactElement | null;
  Sheet: (props: FluidboxSheetProps) => ReactElement | null;
  Content: (props: FluidboxContentProps) => ReactElement | null;
  ThumbnailOverlay: (props: FluidboxThumbnailOverlayProps) => ReactElement | null;
  Close: (props: FluidboxActionProps) => ReactElement | null;
  Previous: (props: FluidboxActionProps) => ReactElement | null;
  Next: (props: FluidboxActionProps) => ReactElement | null;
  Filmstrip: <TItem extends FluidboxItem>(
    props: FluidboxFilmstripProps<TItem>,
  ) => ReactElement | null;
}

export type UseFluidbox = <
  TItem extends FluidboxItem = FluidboxItem,
>() => FluidboxController<TItem>;

export type UseFluidboxState = <TSelected>(
  selector: (state: FluidboxState) => TSelected,
) => TSelected;
