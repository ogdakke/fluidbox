/** Stable identity used by sources, origins, commands, and events. */
export type FluidboxItemId = string;

export interface FluidboxImageCandidate {
  readonly src: string;
  readonly width: number;
}

export interface FluidboxImageSource {
  readonly media?: string;
  readonly type?: string;
  readonly candidates?: readonly FluidboxImageCandidate[];
  /** Native srcset text. Use this or candidates, never both. */
  readonly srcset?: string;
  readonly sizes?: string;
}

export interface FluidboxImageResource {
  readonly src: string;
  readonly width?: number;
  readonly height?: number;
  readonly candidates?: readonly FluidboxImageCandidate[];
  /** Native srcset text. Use this or candidates, never both. */
  readonly srcset?: string;
  readonly sizes?: string;
  readonly sources?: readonly FluidboxImageSource[];
}

export interface FluidboxImageMedia extends FluidboxImageResource {
  readonly type: "image";
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface FluidboxVideoMedia {
  readonly type: "video";
  readonly src: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly poster?: FluidboxImageResource;
  readonly mimeType?: string;
}

export interface FluidboxIframeMedia {
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
export interface FluidboxCustomMedia {
  readonly type: "custom";
  readonly renderer: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
}

export type FluidboxMedia =
  | FluidboxImageMedia
  | FluidboxVideoMedia
  | FluidboxIframeMedia
  | FluidboxCustomMedia;

export interface FluidboxItem<TMedia extends FluidboxMedia = FluidboxMedia> {
  readonly id: FluidboxItemId;
  readonly media: TMedia;
  readonly thumbnail?: FluidboxImageResource;
  /** Immediate image shown behind media until a decoded preview or full image is ready. */
  readonly placeholder?: FluidboxImageResource;
  readonly preview?: FluidboxImageResource;
  readonly caption?: string;
  readonly description?: string;
}

/** A finite, immutable snapshot for one controller revision. */
export interface FluidboxSource<TItem extends FluidboxItem = FluidboxItem> {
  readonly count: number;
  getItem(index: number): TItem;
  getIndex(id: FluidboxItemId): number | null;
}

export interface FluidboxOrigin {
  /** Interactive element used for activation and focus return. */
  readonly trigger: HTMLElement;
  /** Visible clipped box used for transition geometry and corner radii. */
  readonly visual: HTMLElement;
  /** Optional decoded preview used while the full media loads. */
  readonly thumbnail?: HTMLImageElement;
  /** Update authored preview content before the close target is measured. */
  readonly prepareClose?: (item: FluidboxItem, index: number) => void;
}

export type FluidboxRevealReason = "open" | "selection";

export interface FluidboxRevealContext {
  readonly signal: AbortSignal;
  readonly reason: FluidboxRevealReason;
}

/** DOM and virtualizer integration, kept separate from source metadata. */
export interface FluidboxOriginAdapter {
  getOrigin(id: FluidboxItemId): FluidboxOrigin | null;
  revealOrigin?(
    id: FluidboxItemId,
    index: number,
    context: FluidboxRevealContext,
  ): void | Promise<void>;
}

export type FluidboxStatus = "closed" | "opening" | "open" | "closing";

export type FluidboxCommandReason =
  | "api"
  | "trigger"
  | "keyboard"
  | "pointer"
  | "wheel"
  | "filmstrip";

export type FluidboxChangeReason =
  | FluidboxCommandReason
  | "source-update"
  | "source-empty"
  | "teardown";

export type FluidboxTarget =
  | { readonly id: FluidboxItemId; readonly index?: never }
  | { readonly id?: never; readonly index: number };

export interface FluidboxCommandOptions {
  readonly signal?: AbortSignal;
  readonly reason?: FluidboxCommandReason;
}

export type FluidboxCommandResult =
  | { readonly status: "completed"; readonly changed: boolean }
  | { readonly status: "superseded" }
  | { readonly status: "prevented" }
  | { readonly status: "aborted" };

export interface FluidboxState {
  readonly status: FluidboxStatus;
  readonly count: number;
  readonly activeId: FluidboxItemId | null;
  readonly activeIndex: number | null;
  readonly requestedId: FluidboxItemId | null;
  readonly requestedIndex: number | null;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

export type FluidboxEvent =
  | {
      readonly type: "open-request" | "change-request";
      readonly target: FluidboxTarget;
      readonly reason: FluidboxCommandReason;
    }
  | { readonly type: "close-request"; readonly reason: FluidboxCommandReason }
  | {
      readonly type: "selection-change" | "selection-settle";
      readonly id: FluidboxItemId;
      readonly index: number;
      readonly reason: FluidboxChangeReason;
    }
  | { readonly type: "status-change"; readonly status: FluidboxStatus };

export interface FluidboxBeforeCommandEvent {
  readonly command: "open" | "close" | "goTo" | "next" | "previous";
  readonly target?: FluidboxTarget;
  readonly reason: FluidboxCommandReason;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export type FluidboxDispose = () => void;

export interface FluidboxMountContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly target: HTMLElement;
  readonly signal: AbortSignal;
}

export interface FluidboxRenderer<TItem extends FluidboxItem = FluidboxItem> {
  mount(context: FluidboxMountContext<TItem>): void | FluidboxDispose;
}

export interface FluidboxPortalMountContext<TItem extends FluidboxItem = FluidboxItem> {
  /** Stable application-owned mount target inside the runtime body portal. */
  readonly target: HTMLElement;
  readonly controller: FluidboxController<TItem>;
  readonly signal: AbortSignal;
}

export interface FluidboxPortalRenderer<TItem extends FluidboxItem = FluidboxItem> {
  mount(context: FluidboxPortalMountContext<TItem>): void | FluidboxDispose;
}

export type FluidboxThumbnailOverlayBehavior = "host" | "travel";

export type FluidboxThumbnailOverlayRegistration<TItem extends FluidboxItem = FluidboxItem> =
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
      readonly renderer: FluidboxRenderer<TItem>;
    };

export interface FluidboxZoomOptions {
  /** Scale used by double-click, double-tap, and keyboard zoom. @default 2 */
  readonly step?: number;
  /** Maximum pinch, wheel, and keyboard zoom scale. @default 4 */
  readonly max?: number;
}

export interface FluidboxExtensionContext<TItem extends FluidboxItem = FluidboxItem> {
  /** The viewer dialog. Extensions add their own elements and attributes to it. */
  readonly dialog: HTMLElement;
  readonly controller: FluidboxController<TItem>;
  readonly source: FluidboxSource<TItem>;
  /** Aborted when the lightbox is destroyed. */
  readonly signal: AbortSignal;
}

/** What the viewer asks of a mounted extension. Every hook is optional. */
export interface FluidboxExtensionInstance<TItem extends FluidboxItem = FluidboxItem> {
  setSource?(source: FluidboxSource<TItem>): void;
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
export interface FluidboxExtension<TItem extends FluidboxItem = FluidboxItem> {
  mount(context: FluidboxExtensionContext<TItem>): FluidboxExtensionInstance<TItem>;
}

export interface FluidboxOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly source: FluidboxSource<TItem>;
  /** A thumbnail strip along the bottom, from `@ogdakke/fluidbox/filmstrip`. */
  readonly filmstrip?: FluidboxExtension<TItem>;
  /** A panel that rises from the bottom over the photo, from `@ogdakke/fluidbox/sheet`. */
  readonly sheet?: FluidboxExtension<TItem>;
  readonly origins?: FluidboxOriginAdapter;
  readonly renderers?: Readonly<Record<string, FluidboxRenderer<TItem>>>;
  readonly portal?: FluidboxPortalRenderer<TItem>;
  /** Set to false to disable zoom interaction. */
  readonly zoom?: false | FluidboxZoomOptions;
  readonly onBeforeCommand?: (event: FluidboxBeforeCommandEvent) => void;
  readonly onEvent?: (event: FluidboxEvent) => void;
}

export interface FluidboxController<TItem extends FluidboxItem = FluidboxItem> {
  readonly state: FluidboxState;
  /** Prepare a closed viewer for a likely open. Dispose to cancel unused work. */
  prepare(target: FluidboxTarget): FluidboxDispose;
  open(target: FluidboxTarget, options?: FluidboxCommandOptions): Promise<FluidboxCommandResult>;
  close(options?: FluidboxCommandOptions): Promise<FluidboxCommandResult>;
  goTo(target: FluidboxTarget, options?: FluidboxCommandOptions): Promise<FluidboxCommandResult>;
  next(options?: FluidboxCommandOptions): Promise<FluidboxCommandResult>;
  previous(options?: FluidboxCommandOptions): Promise<FluidboxCommandResult>;
  setSource(source: FluidboxSource<TItem>): Promise<FluidboxCommandResult>;
  registerOrigin(
    id: FluidboxItemId | readonly FluidboxItemId[],
    origin: FluidboxOrigin,
  ): FluidboxDispose;
  registerThumbnailOverlay(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): FluidboxDispose;
  subscribe(listener: (state: FluidboxState) => void): FluidboxDispose;
  destroy(): void;
}

/** Framework-independent lightbox constructor exported from the package root. */
export type CreateFluidbox = <TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxOptions<TItem>,
) => FluidboxController<TItem>;
