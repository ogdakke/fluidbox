/** Stable identity used by sources, origins, commands, and events. */
export type LightboxItemId = string;

export interface LightboxImageCandidate {
  readonly src: string;
  readonly width: number;
}

export interface LightboxImageSource {
  readonly media?: string;
  readonly type?: string;
  readonly candidates?: readonly LightboxImageCandidate[];
  /** Native srcset text. Use this or candidates, never both. */
  readonly srcset?: string;
  readonly sizes?: string;
}

export interface LightboxImageResource {
  readonly src: string;
  readonly width?: number;
  readonly height?: number;
  readonly candidates?: readonly LightboxImageCandidate[];
  /** Native srcset text. Use this or candidates, never both. */
  readonly srcset?: string;
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
  /** Immediate image shown behind media until a decoded preview or full image is ready. */
  readonly placeholder?: LightboxImageResource;
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
  /** Update authored preview content before the close target is measured. */
  readonly prepareClose?: (item: LightboxItem, index: number) => void;
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
      /** Optional mask to move into the animated frame and restore on close. */
      readonly frameLayer?: HTMLElement;
      /** Mounts application-owned content into a runtime transition target. */
      readonly renderer: LightboxRenderer<TItem>;
    };

export interface LightboxZoomOptions {
  /** Scale used by double-click, double-tap, and keyboard zoom. @default 2 */
  readonly step?: number;
  /** Maximum pinch, wheel, and keyboard zoom scale. @default 4 */
  readonly max?: number;
}

export interface LightboxExtensionContext<TItem extends LightboxItem = LightboxItem> {
  /** The viewer dialog. Extensions add their own elements and attributes to it. */
  readonly dialog: HTMLElement;
  readonly controller: LightboxController<TItem>;
  readonly source: LightboxSource<TItem>;
  /** Aborted when the lightbox is destroyed. */
  readonly signal: AbortSignal;
}

/** What the viewer asks of a mounted extension. Every hook is optional. */
export interface LightboxExtensionInstance<TItem extends LightboxItem = LightboxItem> {
  setSource?(source: LightboxSource<TItem>): void;
  /** The overlay has just been put in the document, before the opening is measured. */
  attach?(): void;
  /** A vertical touch drag on the photo. Return true to take it from the dismiss gesture. */
  claimDrag?(deltaY: number): boolean;
  drag?(phase: "start" | "move" | "end" | "cancel", clientY: number): void;
  /**
   * A vertical wheel or trackpad scroll over the photo. Return true to consume it,
   * or "native" to leave it to the browser, as a sheet that scrolls does.
   */
  wheel?(deltaY: number): boolean | "native";
  /** Return true to consume the key, as a sheet does with Escape. */
  keydown?(event: KeyboardEvent): boolean;
  /** False while zoom would fight the extension. */
  allowsZoom?(): boolean;
  /** Runs before the closing flight, so the viewer can settle into its resting pose. */
  beforeClose?(): void | Promise<void>;
  /**
   * True when the extension has already carried the photo out of sight, as a
   * sheet's scroll dismiss does; the viewer then closes without a flight.
   */
  closesInPlace?(): boolean;
  destroy(): void;
}

/** A feature that plugs into the viewer, such as filmstrip() or sheet(). Each comes from its own entry, so it costs nothing until imported. */
export interface LightboxExtension<TItem extends LightboxItem = LightboxItem> {
  mount(context: LightboxExtensionContext<TItem>): LightboxExtensionInstance<TItem>;
}

export interface LightboxOptions<TItem extends LightboxItem = LightboxItem> {
  readonly source: LightboxSource<TItem>;
  /** A thumbnail strip along the bottom, from `@ogdakke/fluidbox/filmstrip`. */
  readonly filmstrip?: LightboxExtension<TItem>;
  /** A panel that rises from the bottom over the photo, from `@ogdakke/fluidbox/sheet`. */
  readonly sheet?: LightboxExtension<TItem>;
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
  registerOrigin(
    id: LightboxItemId | readonly LightboxItemId[],
    origin: LightboxOrigin,
  ): LightboxDispose;
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
