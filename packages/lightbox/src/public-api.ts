/** Stable identity used by sources, origins, commands, and events. */
export type LightboxItemId = string;

export interface LightboxImageCandidate {
  readonly src: string;
  readonly width: number;
}

export interface LightboxImageSource {
  readonly media?: string;
  readonly type?: string;
  readonly candidates: readonly LightboxImageCandidate[];
  readonly sizes?: string;
}

export interface LightboxImageResource {
  readonly src: string;
  readonly width?: number;
  readonly height?: number;
  readonly candidates?: readonly LightboxImageCandidate[];
  readonly sizes?: string;
  readonly sources?: readonly LightboxImageSource[];
}

export interface LightboxImageMedia extends LightboxImageResource {
  readonly type: "image";
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface LightboxVideoMedia {
  readonly type: "video";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly poster?: LightboxImageResource;
  readonly mimeType?: string;
}

export interface LightboxIframeMedia {
  readonly type: "iframe";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly allow?: string;
  readonly referrerPolicy?: ReferrerPolicy;
  readonly sandbox?: string;
}

/**
 * Application renderers resolve custom content by key. Framework nodes never
 * enter the source snapshot or become owned by the interaction runtime.
 */
export interface LightboxCustomMedia {
  readonly type: "custom";
  readonly renderer: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
}

export type LightboxMedia =
  | LightboxImageMedia
  | LightboxVideoMedia
  | LightboxIframeMedia
  | LightboxCustomMedia;

export interface LightboxItem<TMedia extends LightboxMedia = LightboxMedia> {
  readonly id: LightboxItemId;
  readonly media: TMedia;
  readonly thumbnail?: LightboxImageResource;
  readonly preview?: LightboxImageResource;
  readonly caption?: string;
  readonly description?: string;
}

/** A finite, immutable snapshot for one controller revision. */
export interface LightboxSource<TItem extends LightboxItem = LightboxItem> {
  readonly count: number;
  getItem(index: number): TItem;
  getIndex(id: LightboxItemId): number | null;
}

export interface LightboxOrigin {
  /** Interactive element used for activation and focus return. */
  readonly trigger: HTMLElement;
  /** Visible clipped box used for transition geometry and corner radii. */
  readonly visual: HTMLElement;
  /** Optional decoded preview used while the full media loads. */
  readonly thumbnail?: HTMLImageElement;
}

export type LightboxRevealReason = "open" | "selection";

export interface LightboxRevealContext {
  readonly signal: AbortSignal;
  readonly reason: LightboxRevealReason;
}

/** DOM and virtualizer integration, kept separate from source metadata. */
export interface LightboxOriginAdapter {
  getOrigin(id: LightboxItemId): LightboxOrigin | null;
  revealOrigin?(
    id: LightboxItemId,
    index: number,
    context: LightboxRevealContext,
  ): void | Promise<void>;
}

export type LightboxStatus = "closed" | "opening" | "open" | "closing";

export type LightboxCommandReason =
  | "api"
  | "trigger"
  | "keyboard"
  | "pointer"
  | "wheel"
  | "filmstrip";

export type LightboxChangeReason =
  | LightboxCommandReason
  | "source-update"
  | "source-empty"
  | "teardown";

export type LightboxTarget =
  | { readonly id: LightboxItemId; readonly index?: never }
  | { readonly id?: never; readonly index: number };

export interface LightboxCommandOptions {
  readonly signal?: AbortSignal;
  readonly reason?: LightboxCommandReason;
}

export type LightboxCommandResult =
  | { readonly status: "completed"; readonly changed: boolean }
  | { readonly status: "superseded" }
  | { readonly status: "prevented" }
  | { readonly status: "aborted" };

export interface LightboxState {
  readonly status: LightboxStatus;
  readonly count: number;
  readonly activeId: LightboxItemId | null;
  readonly activeIndex: number | null;
  readonly requestedId: LightboxItemId | null;
  readonly requestedIndex: number | null;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

export type LightboxEvent =
  | {
      readonly type: "open-request" | "change-request";
      readonly target: LightboxTarget;
      readonly reason: LightboxCommandReason;
    }
  | { readonly type: "close-request"; readonly reason: LightboxCommandReason }
  | {
      readonly type: "selection-change" | "selection-settle";
      readonly id: LightboxItemId;
      readonly index: number;
      readonly reason: LightboxChangeReason;
    }
  | { readonly type: "status-change"; readonly status: LightboxStatus };

export interface LightboxBeforeCommandEvent {
  readonly command: "open" | "close" | "goTo" | "next" | "previous";
  readonly target?: LightboxTarget;
  readonly reason: LightboxCommandReason;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export type LightboxDispose = () => void;

export interface LightboxMountContext<TItem extends LightboxItem = LightboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly target: HTMLElement;
  readonly signal: AbortSignal;
}

export interface LightboxRenderer<TItem extends LightboxItem = LightboxItem> {
  mount(context: LightboxMountContext<TItem>): void | LightboxDispose;
}

export interface LightboxPortalMountContext<TItem extends LightboxItem = LightboxItem> {
  /** Stable application-owned mount target inside the runtime body portal. */
  readonly target: HTMLElement;
  readonly controller: LightboxController<TItem>;
  readonly signal: AbortSignal;
}

export interface LightboxPortalRenderer<TItem extends LightboxItem = LightboxItem> {
  mount(context: LightboxPortalMountContext<TItem>): void | LightboxDispose;
}

export type LightboxThumbnailOverlayBehavior = "host" | "travel";

export type LightboxThumbnailOverlayRegistration<TItem extends LightboxItem = LightboxItem> =
  | {
      readonly behavior?: "host";
      /** Existing host overlay. The runtime publishes phase and progress here. */
      readonly element: HTMLElement;
      readonly renderer?: never;
    }
  | {
      readonly behavior: "travel";
      /** Existing host overlay. The runtime publishes phase and progress here. */
      readonly element: HTMLElement;
      /** Mounts application-owned content into a runtime transition target. */
      readonly renderer: LightboxRenderer<TItem>;
    };

export interface LightboxZoomOptions {
  /** Scale used by double-click, double-tap, and keyboard zoom. @default 2 */
  readonly step?: number;
  /** Maximum pinch, wheel, and keyboard zoom scale. @default 4 */
  readonly max?: number;
}

export interface LightboxOptions<TItem extends LightboxItem = LightboxItem> {
  readonly source: LightboxSource<TItem>;
  readonly origins?: LightboxOriginAdapter;
  readonly renderers?: Readonly<Record<string, LightboxRenderer<TItem>>>;
  readonly portal?: LightboxPortalRenderer<TItem>;
  /** Set to false to disable zoom interaction. */
  readonly zoom?: false | LightboxZoomOptions;
  readonly onBeforeCommand?: (event: LightboxBeforeCommandEvent) => void;
  readonly onEvent?: (event: LightboxEvent) => void;
}

export interface LightboxController<TItem extends LightboxItem = LightboxItem> {
  readonly state: LightboxState;
  /** Prepare a closed viewer for a likely open. Dispose to cancel unused work. */
  prepare(target: LightboxTarget): LightboxDispose;
  open(target: LightboxTarget, options?: LightboxCommandOptions): Promise<LightboxCommandResult>;
  close(options?: LightboxCommandOptions): Promise<LightboxCommandResult>;
  goTo(target: LightboxTarget, options?: LightboxCommandOptions): Promise<LightboxCommandResult>;
  next(options?: LightboxCommandOptions): Promise<LightboxCommandResult>;
  previous(options?: LightboxCommandOptions): Promise<LightboxCommandResult>;
  setSource(source: LightboxSource<TItem>): Promise<LightboxCommandResult>;
  registerOrigin(id: LightboxItemId, origin: LightboxOrigin): LightboxDispose;
  registerThumbnailOverlay(
    id: LightboxItemId,
    registration: LightboxThumbnailOverlayRegistration<TItem>,
  ): LightboxDispose;
  subscribe(listener: (state: LightboxState) => void): LightboxDispose;
  destroy(): void;
}

/** Framework-independent lightbox constructor exported from the package root. */
export type CreateLightbox = <TItem extends LightboxItem = LightboxItem>(
  options: LightboxOptions<TItem>,
) => LightboxController<TItem>;
