import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  DOMAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import type {
  FluidboxCommandOptions,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItems,
  FluidboxLabels,
  FluidboxMediaErrorEvent,
  FluidboxOptions,
  FluidboxSheetEvent,
  FluidboxSheetOptions,
  FluidboxSlideRenderer,
  FluidboxState,
  FluidboxTarget,
  FluidboxValue,
  FluidboxValueChangeDetails,
  FluidboxVideoItem,
  FluidboxVideoOptions,
  FluidboxZoomCommandOptions,
  FluidboxZoomEvent,
  FluidboxZoomPose,
  FluidboxPlaybackSource,
  FluidboxSlideOrigin,
} from "@ogdakke/fluidbox";
import type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";

/** What the Sheet's, the Caption's and a slide's render functions get: the item they draw. */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

/** What a thumbnail's render function gets: its item, and whether it is the one on show. */
export interface FluidboxThumbnailContext<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxItemContext<TItem> {
  readonly active: boolean;
}

/** A slide's content: rendered into the slide's layer, with `Media` for its box. */
export type FluidboxSlideContent<TItem extends FluidboxItem = FluidboxItem> = (
  slide: FluidboxItemContext<TItem>,
) => ReactNode;

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** An array, or a list read on demand. A new array equal field by field to the current one changes nothing. */
  readonly items: FluidboxItems<TItem>;
  /**
   * The open item's id, or `null` for closed, when your state owns it. It is a
   * request: when it changes, the viewer opens, moves or closes to match.
   */
  readonly value?: FluidboxValue;
  /** The item to open with, when the viewer owns its value. */
  readonly defaultValue?: FluidboxValue;
  /**
   * Before every open, move and close, from any input, with the value the
   * viewer goes to: an id, or null for a close. `details.cancel()` stops it.
   */
  readonly onValueChange?: (
    value: FluidboxValue,
    details: FluidboxValueChangeDetails<TItem>,
  ) => void;
  /** Once the motion of a value change settled: the flight landed, a move came to rest, or a close finished. */
  readonly onValueChangeComplete?: (
    value: FluidboxValue,
    details: FluidboxValueChangeDetails<TItem>,
  ) => void;
  /** Go round: past the last item comes the first. A single item never loops. */
  readonly loop?: boolean;
  /**
   * Where the viewer's controls lead before JavaScript runs, when the server
   * renders it open: `null` for Close, the previous or next item's id for
   * Previous and Next. Share shares it too, unless `shareUrl` says otherwise.
   */
  readonly href?: (value: string | null) => string | undefined;
  /** Your strings for the viewer. Compared by value; they change the open viewer in place. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Zoom steps, or `false` to turn zoom off. Compared by value. */
  readonly zoom?: FluidboxOptions<TItem>["zoom"];
  /** Find the trigger of an item without a mounted Trigger, as in a virtualised grid. */
  readonly findTrigger?: FluidboxOptions<TItem>["findTrigger"];
  /** Bring an item's trigger into view. Without it, the viewer scrolls it into view. */
  readonly revealTrigger?: FluidboxOptions<TItem>["revealTrigger"];
  /** When the viewer's code loads: on `"intent"` (the default), on `"press"`, or `"eager"`ly. */
  readonly preload?: FluidboxOptions<TItem>["preload"];
  /** Which gestures close the viewer. Compared by value. */
  readonly dismiss?: FluidboxOptions<TItem>["dismiss"];
  /** What a vertical wheel or trackpad scroll does on an unzoomed slide. */
  readonly wheel?: FluidboxOptions<TItem>["wheel"];
  /** The link Share shares for an item. @default the `href` of its id */
  readonly shareUrl?: FluidboxOptions<TItem>["shareUrl"];
  /** Advance on a timer, once `play()`, the Slideshow part or `autoplay` starts it. Compared by value. */
  readonly slideshow?: FluidboxOptions<TItem>["slideshow"];
  /** When the image on show comes to rest at another zoom. */
  readonly onZoomChange?: (event: FluidboxZoomEvent) => void;
  /** When a slide's media fails to load, as it shows its error. */
  readonly onMediaError?: (event: FluidboxMediaErrorEvent<TItem>) => void;
  readonly children?: ReactNode;
}

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "value"
> {
  /** Decorate the single child element instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /**
   * The item to open: the item, its id or its index. A list opens its first,
   * and every one closes back onto this trigger, as for an album cover.
   */
  readonly value: FluidboxTarget<TItem> | readonly FluidboxTarget<TItem>[];
  /** A function gets the item the trigger shows, which follows the viewer while it is open. */
  readonly children: ReactNode | ((preview: FluidboxTriggerPreview<TItem>) => ReactNode);
}

export interface FluidboxViewerProps {
  /** Your controls and captions, rendered into the viewer's layer. */
  readonly children?: ReactNode;
}

/**
 * The slide for each item type: your own types, or the built-in ones. Types
 * it doesn't list draw the built-in slide, or `default`.
 */
export type FluidboxSlidesProps<TItem extends FluidboxItem = FluidboxItem> = {
  readonly [K in TItem["type"]]?: FluidboxSlideContent<Extract<TItem, { readonly type: K }>>;
} & {
  /** Any type without its own prop and without a built-in slide. */
  readonly default?: FluidboxSlideContent<TItem>;
};

/** The attributes a part gives an element the viewer made: no event handlers. */
type ElementAttributes = Omit<HTMLAttributes<HTMLElement>, keyof DOMAttributes<HTMLElement>>;

export interface FluidboxMediaProps extends ElementAttributes {
  /**
   * Whether pinch, double-tap, wheel and the zoom controls zoom the box.
   * @default true when it holds an Image, else false
   */
  readonly zoom?: boolean;
  /** Draw into the box with a plain-JS slide renderer, as the add-on parts do. */
  readonly render?: FluidboxSlideRenderer<any>;
  /** Portalled into the box. Fill it: the box is sized from the item. */
  readonly children?: ReactNode;
}

export interface FluidboxImageProps {
  /** @default the slide's item */
  readonly item?: FluidboxImageItem;
}

export interface FluidboxVideoProps extends Pick<FluidboxVideoOptions, "attach"> {
  /** @default the slide's item */
  readonly item?: FluidboxVideoItem;
}

export interface FluidboxIframeProps {
  /** @default the slide's item */
  readonly item?: FluidboxIframeItem;
}

/** What every control part takes besides its element's attributes. */
export interface FluidboxControlLabel {
  /**
   * A string names this control instead of the labels. `false` names it by
   * its children: use it when they hold visible text.
   */
  readonly label?: string | false;
}

export interface FluidboxControlProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, FluidboxControlLabel {}

export interface FluidboxDownloadProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>, FluidboxControlLabel {}

export interface FluidboxGroupProps extends HTMLAttributes<HTMLDivElement> {}

export interface FluidboxCounterProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The counter's text. @default labels.counter */
  readonly children?: (counter: { readonly index: number; readonly count: number }) => ReactNode;
}

export interface FluidboxCaptionProps<TItem extends FluidboxItem = FluidboxItem> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** The caption. @default the item's `caption` */
  readonly children?: (context: FluidboxItemContext<TItem>) => ReactNode;
}

export interface FluidboxOverlayProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * How it goes with the photo's flight: it stays on the card, a still copy
   * flies, its children render live in the flying frame, or the element itself
   * moves into the frame and scales with it, as a scrim does.
   * @default "none"
   */
  readonly flight?: "none" | "copy" | "live" | "frame";
}

export interface FluidboxThumbnailsProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Fills each thumbnail button. Leave it out for the default images. */
  readonly children?: (thumbnail: FluidboxThumbnailContext<TItem>) => ReactNode;
}

export interface FluidboxSheetProps<TItem extends FluidboxItem = FluidboxItem>
  extends ElementAttributes, Pick<FluidboxSheetOptions<TItem>, "snapPoints" | "dismissMotion"> {
  /** When the sheet comes to rest at another snap. */
  readonly onSnapChange?: (event: FluidboxSheetEvent) => void;
  /** The sheet's content for the item on show. */
  readonly children?: (context: FluidboxItemContext<TItem>) => ReactNode;
}

export interface FluidboxSheetSnapProps extends FluidboxControlProps {
  /** The snap the button moves the sheet to. */
  readonly to: number;
}

export interface FluidboxLoadingProps {
  /** Shown while the item on show is loading. */
  readonly children?: ReactNode;
}

export interface FluidboxErrorProps<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Shown while the item on show failed, in place of the default error. A
   * function gets the item and the `cause` of its last `mediaerror`.
   */
  readonly children?:
    | ReactNode
    | ((failed: { readonly item: TItem; readonly error: unknown }) => ReactNode);
}

/** The commands `useFluidbox` hands back with the state. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  readonly open: (
    target?: FluidboxTarget<TItem>,
    options?: FluidboxCommandOptions,
  ) => Promise<boolean>;
  readonly close: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly next: (options?: FluidboxCommandOptions) => Promise<boolean>;
  readonly previous: (options?: FluidboxCommandOptions) => Promise<boolean>;
  /** Zoom the image on show to a scale between 1 and the zoom's `max`. */
  readonly zoomTo: (scale: number, options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom in by 1.5. */
  readonly zoomIn: (options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom out by 1.5. */
  readonly zoomOut: (options?: FluidboxZoomCommandOptions) => Promise<boolean>;
  /** Zoom back out to fit. */
  readonly zoomReset: (options?: Pick<FluidboxZoomCommandOptions, "signal">) => Promise<boolean>;
  /** Make the open viewer fullscreen, or leave it; without an argument, toggle. */
  readonly setFullscreen: (on?: boolean) => Promise<boolean>;
  /** Download the open item's file. */
  readonly download: () => Promise<boolean>;
  /** Share the open item's link, or copy it. */
  readonly share: () => Promise<boolean>;
  /** Start the slideshow on the open viewer. */
  readonly play: () => void;
  /** Stop the slideshow, until `play()` or the Slideshow part. */
  readonly pause: () => void;
  readonly setItems: (items: FluidboxItems<TItem>) => Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  readonly preload: (target: FluidboxTarget<TItem>) => () => void;
  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  readonly load: () => Promise<boolean>;
}

/** The viewer state and its commands. */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

export interface UseFluidbox {
  <TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
  <TSelected, TItem extends FluidboxItem = FluidboxItem>(
    selector: (value: FluidboxApi<TItem>) => TSelected,
  ): TSelected;
}

/** The sheet's snap and a function that moves it. */
export interface FluidboxSheetApi {
  /** 0 at rest, then one per snap point. 0 while the sheet is not there. */
  readonly snap: number;
  readonly setSnap: (snap: number, options?: { readonly animate?: boolean }) => void;
}

/** The slide a part is inside, from `useFluidboxSlide`. */
export interface FluidboxSlideApi<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  /**
   * The item's index, read live: new items keep a slide whose item moved. Read
   * it where you use it, not once into a ref or an effect's closure.
   */
  readonly index: number;
  /** Whether the slide is the one on show. It re-renders as this changes. */
  readonly active: boolean;
  /** True while an open waits for this slide. */
  readonly opening: boolean;
  /** Aborted when the slide unloads. */
  readonly signal: AbortSignal;
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
  /**
   * What the trigger showed, on the slide an open started from it: `video`
   * reads the trigger's `<video>` live, and `model` is its live
   * `<model-viewer>`. Null on the other slides. Read live, as an open can start
   * from a trigger after the slide rendered.
   */
  readonly origin: FluidboxSlideOrigin | null;
  /**
   * Hand the playback back to the trigger's video as the viewer closes from
   * this slide. Call it in an effect, and return what it returns as the cleanup.
   * The video helper for `onClose`, read just after its listeners on a close that flies.
   */
  returnPlayback(this: void, source: FluidboxPlaybackSource): () => void;
  /**
   * Hear a close start from this slide, once per close, with what the trigger
   * it lands on shows. Call it in an effect, and return what it returns as the
   * cleanup.
   */
  onClose(this: void, listener: (landing: FluidboxSlideOrigin | null) => void): () => void;
  /** Make the opening flight also wait for this promise. Call it during render or in a layout effect. */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /** Put the slide in its error state, with `error` as the `mediaerror`'s cause. */
  fail(this: void, error?: unknown): void;
  /** Follow the box's zoom pose. Returns a function that stops listening. */
  onZoom(this: void, listener: (pose: FluidboxZoomPose) => void): () => void;
}
