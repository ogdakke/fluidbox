import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from "react";
import type {
  LightboxBeforeCommandEvent,
  LightboxController,
  LightboxEvent,
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

export interface LightboxRootProps<TItem extends LightboxItem = LightboxItem> {
  readonly source: LightboxSource<TItem>;
  readonly origins?: LightboxOriginAdapter;
  readonly renderers?: Readonly<Record<string, LightboxReactRenderer<TItem>>>;
  readonly onBeforeCommand?: (event: LightboxBeforeCommandEvent) => void;
  readonly onEvent?: (event: LightboxEvent) => void;
  readonly children?: ReactNode;
}

export interface LightboxItemProps {
  readonly id: string;
  readonly children?: ReactNode;
}

export interface LightboxTriggerProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  readonly asChild?: boolean;
  readonly children: ReactElement;
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
  Trigger: (props: LightboxTriggerProps) => ReactElement | null;
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
