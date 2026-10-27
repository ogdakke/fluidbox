import type { VNodeChild } from "vue";
import type {
  FluidboxCommandOptions,
  FluidboxHotspotCoordinate,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItems,
  FluidboxItemTypes,
  FluidboxLabels,
  FluidboxOptions,
  FluidboxPlaybackSource,
  FluidboxSheetOptions,
  FluidboxSlideOrigin,
  FluidboxSlideRenderer,
  FluidboxState,
  FluidboxTarget,
  FluidboxValue,
  FluidboxVideoItem,
  FluidboxVideoOptions,
  FluidboxZoomCommandOptions,
  FluidboxZoomPose,
} from "@ogdakke/fluidbox";

/** What the Sheet's, the Caption's and a slide's slots get: the item they draw. */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  readonly index: number;
}

/** What a thumbnail's slot gets: its item, and whether it is the one on show. */
export interface FluidboxThumbnailContext<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxItemContext<TItem> {
  readonly active: boolean;
}

/** A slide's content: rendered into the slide's layer, with `Media` for its box. */
export type FluidboxSlideContent<TItem extends FluidboxItem = FluidboxItem> = (
  slide: FluidboxItemContext<TItem>,
) => VNodeChild;

/**
 * The slots of `Slides`: one per item type, your own or the built-in ones, and
 * `default` for any type without its own slot and without a built-in slide.
 */
export type FluidboxSlidesSlots = {
  readonly [K in keyof FluidboxItemTypes]?: FluidboxSlideContent<FluidboxItemTypes[K]>;
} & {
  readonly default?: FluidboxSlideContent;
};

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** An array, or a list read on demand. Reactive, also in place. */
  readonly items: FluidboxItems<TItem>;
  /**
   * The open item's id, or `null` for closed, for `v-model`. It is a request:
   * when it changes, the viewer opens, moves or closes to match. Leave it out
   * to let the viewer own its value.
   */
  readonly modelValue?: FluidboxValue;
  /** The item to open with, when the viewer owns its value. */
  readonly defaultValue?: FluidboxValue;
  /** Go round: past the last item comes the first. A single item never loops. */
  readonly loop?: boolean;
  /**
   * Where the viewer's controls lead before JavaScript runs: `null` for Close,
   * the previous or next item's id for Previous and Next. Share shares it too,
   * unless `shareUrl` says otherwise.
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
  /** How near the end `@reach-end` fires. @default 2 */
  readonly reachEndThreshold?: number;
}

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Decorate the one child element instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /**
   * The item to open: the item, its id or its index. A list opens its first,
   * and every one closes back onto this trigger, as for an album cover.
   */
  readonly value: FluidboxTarget<TItem> | readonly FluidboxTarget<TItem>[];
}

export interface FluidboxMediaProps {
  /**
   * Whether pinch, double-tap, wheel and the zoom controls zoom the box.
   * @default true when it holds an Image, else false
   */
  readonly zoom?: boolean;
  /** Draw into the box with a plain-JS slide renderer, as the add-on parts do. */
  readonly render?: FluidboxSlideRenderer<any>;
}

export interface FluidboxHotspotProps {
  /** Across the painted media: `"42%"`, or pixels counted on the media's `width`. */
  readonly x: FluidboxHotspotCoordinate;
  /** Down the painted media: `"30%"`, or pixels counted on the media's `height`. */
  readonly y: FluidboxHotspotCoordinate;
  /** Grow with the zoom instead of keeping its screen size. @default false */
  readonly scaleWithZoom?: boolean;
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
export interface FluidboxControlProps {
  /**
   * A string names this control instead of the labels. `false` names it by
   * its content: use it when the content holds visible text.
   */
  readonly label?: string | false;
}

export interface FluidboxOverlayProps {
  /**
   * How it goes with the photo's flight: it stays on the card, a still copy
   * flies, its content renders live in the flying frame, or the element itself
   * moves into the frame and scales with it, as a scrim does.
   * @default "none"
   */
  readonly flight?: "none" | "copy" | "live" | "frame";
}

export interface FluidboxSheetProps<TItem extends FluidboxItem = FluidboxItem> extends Pick<
  FluidboxSheetOptions<TItem>,
  "snapPoints" | "dismissMotion"
> {}

export interface FluidboxSheetSnapProps extends FluidboxControlProps {
  /** The snap the button moves the sheet to. */
  readonly to: number;
}

/** The viewer's commands. Each resolves true once it happened, false when it was prevented. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  /** Open on an item, its index or its id, or move to it while open. */
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

/**
 * What `useFluidbox()` returns and Root's default slot gets: the state and the
 * commands, in one reactive object. Read its fields where you use them; a
 * destructured field in `<script setup>` stops following the viewer.
 */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

/** The sheet's snap and a function that moves it, from `useFluidboxSheet()`. */
export interface FluidboxSheetApi {
  /** 0 at rest, then one per snap point. 0 while the sheet is not there. */
  readonly snap: number;
  readonly setSnap: (snap: number, options?: { readonly animate?: boolean }) => void;
}

/** The slide a part is inside, from `useFluidboxSlide()`, in one reactive object. */
export interface FluidboxSlideApi<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: TItem;
  /**
   * The item's index, read live: new items keep a slide whose item moved, and
   * a template that reads it renders again. Read it where you use it, not once
   * into a variable.
   */
  readonly index: number;
  /** Whether the slide is the one on show. Reactive. */
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
   * this slide. Call it once mounted, and call what it returns as you unmount.
   */
  returnPlayback(this: void, source: FluidboxPlaybackSource): () => void;
  /**
   * Hear a close start from this slide, once per close, with what the trigger
   * it lands on shows. Call it once mounted, and call what it returns as you
   * unmount.
   */
  onClose(this: void, listener: (landing: FluidboxSlideOrigin | null) => void): () => void;
  /** Make the opening flight also wait for this promise. Call it in `setup` or `onMounted`. */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /** Put the slide in its error state, with `error` as the `mediaerror`'s cause. */
  fail(this: void, error?: unknown): void;
  /** Follow the box's zoom pose. Returns a function that stops listening. */
  onZoom(this: void, listener: (pose: FluidboxZoomPose) => void): () => void;
}
