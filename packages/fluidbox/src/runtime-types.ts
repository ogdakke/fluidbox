import type { FluidboxLabels } from "./labels";

/** Stable identity used by sources, origins, commands, and events. */
export type FluidboxItemId = string;

export type {
  FluidboxCustomItem,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxPictureSource,
  FluidboxThumbnail,
  FluidboxVideoItem,
} from "./public-api";
import type { FluidboxItem } from "./public-api";

/** A finite, immutable snapshot for one controller revision. */
export interface FluidboxSource<TItem extends FluidboxItem = FluidboxItem> {
  readonly count: number;
  getItem(index: number): TItem;
  getIndex(id: FluidboxItemId): number | null;
}

export type {
  FluidboxOrigin,
  FluidboxOriginAdapter,
  FluidboxRevealContext,
  FluidboxStatus,
} from "./public-api";
import type { FluidboxOrigin, FluidboxOriginAdapter, FluidboxStatus } from "./public-api";

export type SessionReason = "api" | "trigger" | "keyboard" | "pointer" | "wheel";

export type SessionChangeReason = SessionReason | "source-update" | "source-empty";

export type SessionTarget =
  | { readonly id: FluidboxItemId; readonly index?: never }
  | { readonly id?: never; readonly index: number };

export interface SessionCommandOptions {
  readonly signal?: AbortSignal;
  readonly reason?: SessionReason;
  /** A move that follows a continuous input; see FluidboxCommandOptions. */
  readonly scrub?: boolean;
}

export type SessionCommandResult =
  | { readonly status: "completed"; readonly changed: boolean }
  | { readonly status: "superseded" }
  | { readonly status: "prevented" }
  | { readonly status: "aborted" };

export interface SessionState {
  readonly status: FluidboxStatus;
  readonly count: number;
  readonly activeId: FluidboxItemId | null;
  readonly activeIndex: number | null;
  readonly requestedId: FluidboxItemId | null;
  readonly requestedIndex: number | null;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

export type SessionEvent =
  | {
      readonly type: "open-request" | "change-request";
      readonly target: SessionTarget;
      readonly reason: SessionReason;
    }
  | { readonly type: "close-request"; readonly reason: SessionReason }
  | {
      readonly type: "selection-change" | "selection-settle";
      readonly id: FluidboxItemId;
      readonly index: number;
      readonly reason: SessionChangeReason;
    }
  | { readonly type: "status-change"; readonly status: FluidboxStatus };

export interface SessionBeforeCommandEvent {
  readonly command: "open" | "close" | "goTo" | "next" | "previous";
  readonly target?: SessionTarget;
  readonly reason: SessionReason;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export type FluidboxDispose = () => void;

export type { FluidboxRenderContext, FluidboxRenderer } from "./public-api";
import type { FluidboxRenderer } from "./public-api";

/** Draws the viewer's layer for controls and captions, once. */
export type FluidboxPortalRenderer = (context: {
  readonly target: HTMLElement;
  readonly signal: AbortSignal;
}) => void | FluidboxDispose;

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
  /** Scale of a double-click or double-tap zoom. The keys zoom by 1.5 per press. @default 2 */
  readonly step?: number;
  /** Maximum pinch, wheel, and keyboard zoom scale. @default 4 */
  readonly max?: number;
}

export interface FluidboxExtensionContext<TItem extends FluidboxItem = FluidboxItem> {
  /** The viewer dialog. Extensions add their own elements and attributes to it. */
  readonly dialog: HTMLElement;
  /**
   * Beside the viewer's layer, for what floats over the slides, as a
   * filmstrip. A redraw of the layer never touches it. Mark what goes in it
   * data-fluidbox-chrome to reveal and hide with the layer.
   */
  readonly layer: HTMLElement;
  readonly controller: SessionController<TItem>;
  readonly source: FluidboxSource<TItem>;
  readonly labels: FluidboxLabels;
  /** Aborted when the viewer is destroyed. */
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
  /** The labels changed in place; show them again. */
  relabel?(): void;
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

/** What the session needs; the fluidbox gives the driver the rest. */
export interface SessionOptions<TItem extends FluidboxItem = FluidboxItem> {
  readonly source: FluidboxSource<TItem>;
  readonly origins?: FluidboxOriginAdapter;
  readonly onBeforeCommand?: (event: SessionBeforeCommandEvent) => void;
  readonly onEvent?: (event: SessionEvent) => void;
}

export interface SessionController<TItem extends FluidboxItem = FluidboxItem> {
  readonly state: SessionState;
  /** The source the viewer reads, as last given to createFluidbox or setSource. */
  readonly source: FluidboxSource<TItem>;
  /** Prepare a closed viewer for a likely open. Dispose to cancel unused work. */
  prepare(target: SessionTarget): FluidboxDispose;
  open(target: SessionTarget, options?: SessionCommandOptions): Promise<SessionCommandResult>;
  close(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  goTo(target: SessionTarget, options?: SessionCommandOptions): Promise<SessionCommandResult>;
  /** Fire the before-event for a move to `target` without making it. False when it was prevented. */
  allows(target: SessionTarget, reason: SessionReason): boolean;
  next(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  previous(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  setSource(source: FluidboxSource<TItem>): Promise<SessionCommandResult>;
  registerOrigin(
    id: FluidboxItemId | readonly FluidboxItemId[],
    origin: FluidboxOrigin,
  ): FluidboxDispose;
  registerThumbnailOverlay(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): FluidboxDispose;
  subscribe(listener: (state: SessionState) => void): FluidboxDispose;
  destroy(): void;
}

/** Framework-independent viewer constructor exported from the package root. */
