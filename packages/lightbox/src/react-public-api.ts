import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from "react";
import type {
  LightboxBeforeCommandEvent,
  LightboxController,
  LightboxEvent,
  LightboxExtension,
  LightboxItem,
  LightboxOriginAdapter,
  LightboxSource,
  LightboxState,
  LightboxThumbnailOverlayBehavior,
} from "./public-api";

export interface LightboxReactRenderContext<TItem extends LightboxItem = LightboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly signal: AbortSignal;
}

export type LightboxReactRenderer<TItem extends LightboxItem = LightboxItem> = (
  context: LightboxReactRenderContext<TItem>,
) => ReactNode;

export type LightboxRootProps<TItem extends LightboxItem = LightboxItem> = {
  readonly origins?: LightboxOriginAdapter;
  readonly renderers?: Readonly<Record<string, LightboxReactRenderer<TItem>>>;
  /** From `@ogdakke/fluidbox/filmstrip`. Keep it stable, as with useMemo or a module constant. */
  readonly filmstrip?: LightboxExtension<TItem>;
  /** From `@ogdakke/fluidbox/sheet`. Render its content with `data-lightbox-sheet` in a Portal. */
  readonly sheet?: LightboxExtension<TItem>;
  readonly onBeforeCommand?: (event: LightboxBeforeCommandEvent) => void;
  readonly onEvent?: (event: LightboxEvent) => void;
  readonly children?: ReactNode;
} & (
  | { readonly source: LightboxSource<TItem>; readonly items?: never }
  | { readonly items: readonly TItem[]; readonly source?: never }
);

export interface LightboxItemProps {
  readonly id: string;
  readonly children?: ReactNode;
}

export interface LightboxTriggerRenderContext<TItem extends LightboxItem = LightboxItem> {
  /** Null when this trigger's items have been removed by source replacement. */
  readonly item: TItem | null;
  readonly index: number | null;
  readonly status: LightboxState["status"];
}

export interface LightboxTriggerProps<TItem extends LightboxItem = LightboxItem> extends Omit<
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
    | ((context: LightboxTriggerRenderContext<TItem>) => ReactElement);
}

export interface LightboxPortalProps {
  readonly children?: ReactNode;
}

export interface LightboxContentProps extends HTMLAttributes<HTMLDivElement> {}

export interface LightboxThumbnailOverlayProps extends HTMLAttributes<HTMLSpanElement> {
  readonly behavior?: LightboxThumbnailOverlayBehavior;
}

export interface LightboxActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export interface LightboxFilmstripRenderContext<TItem extends LightboxItem = LightboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly selected: boolean;
}

export interface LightboxFilmstripProps<
  TItem extends LightboxItem = LightboxItem,
> extends HTMLAttributes<HTMLDivElement> {
  readonly renderItem?: (context: LightboxFilmstripRenderContext<TItem>) => ReactNode;
}

/** Type contract for the composed values implemented during the React binding spike. */
export interface LightboxReactParts {
  Root: <TItem extends LightboxItem>(props: LightboxRootProps<TItem>) => ReactElement | null;
  Item: (props: LightboxItemProps) => ReactElement | null;
  Trigger: <TItem extends LightboxItem>(props: LightboxTriggerProps<TItem>) => ReactElement | null;
  Portal: (props: LightboxPortalProps) => ReactElement | null;
  Content: (props: LightboxContentProps) => ReactElement | null;
  ThumbnailOverlay: (props: LightboxThumbnailOverlayProps) => ReactElement | null;
  Close: (props: LightboxActionProps) => ReactElement | null;
  Previous: (props: LightboxActionProps) => ReactElement | null;
  Next: (props: LightboxActionProps) => ReactElement | null;
  Filmstrip: <TItem extends LightboxItem>(
    props: LightboxFilmstripProps<TItem>,
  ) => ReactElement | null;
}

export type UseLightbox = <
  TItem extends LightboxItem = LightboxItem,
>() => LightboxController<TItem>;

export type UseLightboxState = <TSelected>(
  selector: (state: LightboxState) => TSelected,
) => TSelected;
