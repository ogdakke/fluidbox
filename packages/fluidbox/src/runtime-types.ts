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
import type {
  Fluidbox,
  FluidboxControlName,
  FluidboxOrigin,
  FluidboxState,
  FluidboxViewerRenderer,
} from "./public-api";

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
  /** The strip asked with `allows` first, so the move skips its before-event. */
  readonly approved?: boolean;
  /** Next or previous: which way a looping strip goes round. */
  readonly step?: 1 | -1;
  /** Open with no motion, once the image has decoded, as over a viewer the server rendered. */
  readonly instant?: boolean;
}

export type SessionCommandResult =
  | { readonly status: "completed"; readonly changed: boolean }
  | { readonly status: "superseded" }
  | { readonly status: "prevented" }
  | { readonly status: "aborted" };

export type FluidboxDispose = () => void;

export type { FluidboxRenderContext, FluidboxRenderer } from "./public-api";
import type { FluidboxRenderer } from "./public-api";

/** The viewer's layer for controls and captions: the default buttons, then your viewer content. */
export interface FluidboxViewerLayer {
  readonly fluidbox: Fluidbox<any>;
  readonly controls: readonly FluidboxControlName[];
  readonly viewer?: FluidboxViewerRenderer<any>;
  readonly labels: FluidboxLabels;
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
  /**
   * True when the page's thumbnail stays in view while the viewer is open, as
   * with a sheet's scroll dismiss, where the photo never flies home.
   */
  keepsThumbnail?(): boolean;
  destroy(): void;
}

/** A feature that plugs into the viewer, such as filmstrip() or sheet(). Each comes from its own entry, so it costs nothing until imported. */
export interface FluidboxExtension<TItem extends FluidboxItem = FluidboxItem> {
  mount(context: FluidboxExtensionContext<TItem>): FluidboxExtensionInstance<TItem>;
}

/** What the viewer and its add-ons drive the fluidbox with. */
export interface SessionController<TItem extends FluidboxItem = FluidboxItem> {
  readonly state: FluidboxState<TItem>;
  close(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  goTo(target: SessionTarget, options?: SessionCommandOptions): Promise<SessionCommandResult>;
  next(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  previous(options?: SessionCommandOptions): Promise<SessionCommandResult>;
  /** Fire the before-event for a move to `target` without making it. False when it was prevented. */
  allows(target: SessionTarget, reason: SessionReason): boolean;
  subscribe(listener: (state: FluidboxState<TItem>) => void): FluidboxDispose;
  /** The zoom came to rest at another scale, for the reason given or the last command's. */
  zoomed?(scale: number, reason: SessionReason | undefined): void;
}

export interface ViewerSessionMotionContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
  readonly origin: FluidboxOrigin | null;
  readonly signal: AbortSignal;
  readonly reason: SessionChangeReason;
  /** The move follows a continuous input, so the slide jumps rather than glides. */
  readonly scrub?: boolean;
  /** Next or previous: which way a looping strip goes round. */
  readonly step?: 1 | -1;
  /** Open with no motion, once the image has decoded. */
  readonly instant?: boolean;
}

export interface ViewerSessionCloseContext {
  readonly origin: FluidboxOrigin | null;
  readonly signal: AbortSignal;
  readonly reason: SessionChangeReason;
}

/** DOM motion and portal ownership: the viewer the fluidbox drives. */
export interface ViewerSessionDriver<TItem extends FluidboxItem = FluidboxItem> {
  setSource?(source: FluidboxSource<TItem>): void;
  prepare?(context: Omit<ViewerSessionMotionContext<TItem>, "signal" | "reason">): FluidboxDispose;
  open(context: ViewerSessionMotionContext<TItem>): void | boolean | Promise<void | boolean>;
  select(context: ViewerSessionMotionContext<TItem>): void | Promise<void>;
  close(context: ViewerSessionCloseContext): void | Promise<void>;
  registerThumbnailOverlay?(
    id: FluidboxItemId,
    registration: FluidboxThumbnailOverlayRegistration<TItem>,
  ): void | FluidboxDispose;
  /** The page may have scrolled to reveal an origin; follow it before the next frame. */
  revealed?(): void;
  destroy(): void;
}

/** Framework-independent viewer constructor exported from the package root. */
