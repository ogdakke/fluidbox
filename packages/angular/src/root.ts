import {
  Directive,
  ElementRef,
  NgZone,
  Renderer2,
  booleanAttribute,
  computed,
  numberAttribute,
  inject,
  input,
  model,
  output,
  signal,
  type AfterContentInit,
  type OnChanges,
  type OnDestroy,
  type Signal,
  type SimpleChanges,
} from "@angular/core";
import {
  createFluidbox,
  type Fluidbox,
  type FluidboxCommandOptions,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxMediaErrorEvent,
  type FluidboxOptions,
  type FluidboxReachEndEvent,
  type FluidboxRenderer,
  type FluidboxSheetSnapPoint,
  type FluidboxSlide,
  type FluidboxSlideRenderer,
  type FluidboxSlides,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxUpdateOptions,
  type FluidboxValue,
  type FluidboxValueChangeEvent,
  type FluidboxViewerRenderer,
  type FluidboxZoomCommandOptions,
  type FluidboxZoomEvent,
} from "@ogdakke/fluidbox";
import {
  createFluidboxSync,
  fluidboxStaticViewerNodes,
  holdSlideCommit,
  idOf,
  latestFindTrigger,
  resolveLabels,
  takeOverFluidbox,
  unloadFluidbox,
  type FluidboxStaticNode,
} from "@ogdakke/fluidbox/kit";
import { injectIsBrowser } from "./mount.js";

// The package build leaves the NODE_ENV check for the app's bundler, which
// drops the messages in production. A page without a bundler has no process.
declare const process: { env: { NODE_ENV?: string } };

/** The commands `injectFluidbox()` hands back with the state. */
export interface FluidboxCommands<TItem extends FluidboxItem = FluidboxItem> {
  /** Open an item, by the item, its index or its id, or move to it while open. Without one, the current item, else the first. */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean>;
  close(options?: FluidboxCommandOptions): Promise<boolean>;
  next(options?: FluidboxCommandOptions): Promise<boolean>;
  previous(options?: FluidboxCommandOptions): Promise<boolean>;
  /** Zoom the image on show to a scale between 1 and the zoom's `max`. */
  zoomTo(scale: number, options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom in by 1.5. */
  zoomIn(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom out by 1.5. */
  zoomOut(options?: FluidboxZoomCommandOptions): Promise<boolean>;
  /** Zoom back out to fit. */
  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean>;
  /** Make the open viewer fullscreen, or leave it; without an argument, toggle. */
  setFullscreen(on?: boolean): Promise<boolean>;
  /** Download the open item's file. */
  download(): Promise<boolean>;
  /** Share the open item's link, or copy it. */
  share(): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void;
  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean>;
}

/** The fluidbox as `injectFluidbox()` gives it: its state, and its commands. */
export type FluidboxApi<TItem extends FluidboxItem = FluidboxItem> = FluidboxState<TItem> &
  FluidboxCommands<TItem>;

/** The sheet as `injectFluidboxSheet()` gives it. */
export interface FluidboxSheetApi {
  /** The snap the sheet rests at: 0 at rest, then one per snap point. 0 while there is no sheet. */
  readonly snap: Signal<number>;
  /** Move the sheet to a snap. Ignored while the viewer is not open. */
  setSnap(snap: number, options?: { readonly animate?: boolean }): void;
}

/** A `fluidboxViewer` template, as the root sees it. */
export interface FluidboxViewerPart<TItem extends FluidboxItem = FluidboxItem> {
  /** Draws the template into the viewer's layer. Stable for the part's life. */
  readonly render: FluidboxViewerRenderer<TItem>;
}

/** A `fluidboxThumbnails`, as the root sees it. */
export interface FluidboxThumbnailsPart<TItem extends FluidboxItem = FluidboxItem> {
  /** Draws each thumbnail, or null for the default ones. Stable for the part's life. */
  readonly render: FluidboxRenderer<TItem> | null;
}

/** A `fluidboxSheet` template, as the root sees it. */
export interface FluidboxSheetPart<TItem extends FluidboxItem = FluidboxItem> {
  readonly snapPoints: () => readonly FluidboxSheetSnapPoint[] | undefined;
  readonly dismissMotion: () => "flight" | "scroll" | undefined;
  /** Fills the sheet for the active item. Stable for the part's life. */
  readonly render: FluidboxRenderer<TItem>;
}

/** A `fluidboxSlide` template, as the root sees it. */
export interface FluidboxSlidePart<TItem extends FluidboxItem = FluidboxItem> {
  /**
   * Render the slide into its layer, and call `release` once its content has
   * committed. Returns its disposer.
   */
  render(slide: FluidboxSlide<TItem>, release: () => void): () => void;
}

interface Parts<TItem extends FluidboxItem> {
  viewer: FluidboxViewerPart<TItem> | null;
  thumbnails: FluidboxThumbnailsPart<TItem> | null;
  sheet: FluidboxSheetPart<TItem> | null;
}

/** What the parts reach of their root, and apps don't. */
export interface RootInternals<TItem extends FluidboxItem = FluidboxItem> {
  /** Called when the state or the items change. */
  watch(listener: () => void): () => void;
  /** Plug a viewer, thumbnails or sheet into the viewer. */
  connect<K extends keyof Parts<TItem>>(kind: K, part: NonNullable<Parts<TItem>[K]>): () => void;
  /** Hand the viewer the parts again, once the current check is done. */
  schedule(): void;
  /** Register the slide of an item type, or `"default"`. */
  slide(type: string, part: FluidboxSlidePart<TItem>): () => void;
}

const internals = new WeakMap<object, RootInternals<any>>();

const zoomOption = (zoom: FluidboxOptions["zoom"]) =>
  zoom === false ? false : zoom ? { ...zoom } : undefined;

/**
 * Owns one viewer for a gallery. Parts inside find it through DI. Exported as
 * `fluidbox`: `<div fluidboxRoot #fb="fluidbox">`, then `fb.state()` and
 * `fb.open(2)`.
 *
 * The fluidbox is made with the root and touches nothing until a viewer is
 * pressed or opened. New labels or zoom, and a `fluidboxViewer`,
 * `fluidboxThumbnails` or `fluidboxSheet` coming, going or changing its inputs,
 * apply to it in place, open or not.
 */
@Directive({ selector: "[fluidboxRoot]", exportAs: "fluidbox", standalone: true })
export class FluidboxRootDirective<TItem extends FluidboxItem = FluidboxItem>
  implements OnChanges, AfterContentInit, OnDestroy
{
  /** The gallery's items: an array, or a list read on demand. */
  readonly items = input<FluidboxItems<TItem>>([]);
  /**
   * The open item's id, or `null` for closed, for `[(value)]`. It is a request:
   * when it changes, the viewer opens, moves or closes to match. Leave it out
   * to let the triggers own it.
   */
  readonly value = model<FluidboxValue | undefined>(undefined);
  /** The item to open with, when the viewer owns its value. */
  readonly defaultValue = input<FluidboxValue | undefined>(undefined);
  /** Your strings for the viewer. */
  readonly labels = input<Partial<FluidboxLabels>>();
  /** Zoom steps, or false to turn zoom off. */
  readonly zoom = input<FluidboxOptions<TItem>["zoom"]>();
  /** Go round: past the last item comes the first. A single item never loops. */
  readonly loop = input(false, { transform: booleanAttribute });
  /** Find the trigger of an item without a bound trigger, as in a virtualised grid. */
  readonly findTrigger = input<FluidboxOptions<TItem>["findTrigger"]>();
  /** Bring an item's trigger into view. Without it, the viewer scrolls it into view. */
  readonly revealTrigger = input<FluidboxOptions<TItem>["revealTrigger"]>();
  /** When the viewer's code loads: on `"intent"` (the default), on `"press"`, or `"eager"`ly. */
  readonly preloadMode = input<FluidboxOptions<TItem>["preload"]>(undefined, { alias: "preload" });
  /** Which gestures close the viewer: a drag down, a backdrop tap. */
  readonly dismiss = input<FluidboxOptions<TItem>["dismiss"]>();
  /** What a vertical wheel or trackpad scroll does on an unzoomed slide. */
  readonly wheel = input<FluidboxOptions<TItem>["wheel"]>();
  /**
   * Where an item's page is: an id, or null for the gallery. Share shares it,
   * unless `shareUrl` says otherwise, and the server's copy of an open viewer
   * links its controls to it.
   */
  readonly href = input<(value: string | null) => string | undefined>();
  /** The link Share shares for an item. @default the `href` of its id */
  readonly shareUrl = input<FluidboxOptions<TItem>["shareUrl"]>();

  /**
   * Before every open, move and close, from any input. `$event.preventDefault()`
   * cancels it where it can be canceled.
   */
  readonly beforeValueChange = output<FluidboxValueChangeEvent<TItem>>();
  /** Once the motion of a value change settled: the flight landed, a move came to rest, or a close finished. */
  readonly valueChangeComplete = output<FluidboxValueChangeEvent<TItem>>();
  /** When the image on show comes to rest at another zoom. */
  readonly zoomChange = output<FluidboxZoomEvent>();
  /** When a slide's media fails to load, as it shows its error. */
  readonly mediaError = output<FluidboxMediaErrorEvent<TItem>>();
  /** How near the end `(reachEnd)` fires. @default 2 */
  readonly reachEndThreshold = input<number | undefined, unknown>(undefined, {
    transform: (value) => (value == null || value === "" ? undefined : numberAttribute(value)),
  });
  /** When the open item comes within `reachEndThreshold` of the last, once per count: load more. */
  readonly reachEnd = output<FluidboxReachEndEvent<TItem>>();

  readonly #zone = inject(NgZone);
  readonly #browser = injectIsBrowser();
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #renderer = inject(Renderer2);
  /** The copy of the open viewer, rendered while the root opens on its first render. */
  #copy: { element: HTMLElement; value: string } | null = null;
  readonly #slides = new Map<string, FluidboxSlidePart<TItem>>();
  /** The fluidbox. Parts bind to it as they are made. */
  // findTrigger and revealTrigger are read from the newest inputs on each use.
  readonly fluidbox: Fluidbox<TItem> = createFluidbox<TItem>(
    latestFindTrigger<TItem, FluidboxOptions<TItem>>(
      {
        items: [],
        // Share shares the item's href unless shareUrl says otherwise.
        shareUrl: (item) => {
          const shareUrl = this.shareUrl();
          return shareUrl ? shareUrl(item) : this.href()?.(idOf(item));
        },
        // Slides are looked up by type as one mounts, so the newest template is used.
        slides: new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
          get: (_, type) => {
            const part = typeof type === "string" ? this.#slides.get(type) : undefined;
            if (!part) return undefined;
            const renderer: FluidboxSlideRenderer<TItem> = (slide) => {
              // The open waits until the slide's content has committed.
              const release = holdSlideCommit(slide);
              const dispose = part.render(slide, release);
              return () => {
                release();
                dispose();
              };
            };
            return renderer;
          },
          has: (_, type) => typeof type === "string" && this.#slides.has(type),
        }) as FluidboxSlides<TItem>,
      },
      () => ({ findTrigger: this.findTrigger(), revealTrigger: this.revealTrigger() }),
    ),
  );
  readonly #state = signal(this.fluidbox.state);
  readonly #list = signal(this.fluidbox.items);
  readonly #labels = signal(resolveLabels(undefined));
  readonly #snap = signal(0);
  /** The viewer's state. */
  readonly state: Signal<FluidboxState<TItem>> = this.#state.asReadonly();
  /** The item list, which changes with `items`. */
  readonly list: Signal<FluidboxItemList<TItem>> = this.#list.asReadonly();
  /** The labels, with the defaults filled in. */
  readonly resolvedLabels: Signal<FluidboxLabels> = this.#labels.asReadonly();
  /** State and commands, as `injectFluidbox()` gives them. */
  readonly api: Signal<FluidboxApi<TItem>>;
  /** The sheet's snap and command, as `injectFluidboxSheet()` gives them. */
  readonly sheet: FluidboxSheetApi = {
    snap: this.#snap.asReadonly(),
    setSnap: (snap, options) => this.fluidbox.sheet?.setSnap(snap, options),
  };

  readonly #parts: Parts<TItem> = { viewer: null, thumbnails: null, sheet: null };
  readonly #events = new AbortController();
  #scheduled = false;
  #destroyed = false;
  #started = false;
  readonly #sync = createFluidboxSync(this.fluidbox);

  constructor() {
    const fluidbox = this.fluidbox;
    const commands: FluidboxCommands<TItem> = {
      open: (target, options) => this.open(target, options),
      close: (options) => this.close(options),
      next: (options) => this.next(options),
      previous: (options) => this.previous(options),
      zoomTo: (scale, options) => this.zoomTo(scale, options),
      zoomIn: (options) => this.zoomIn(options),
      zoomOut: (options) => this.zoomOut(options),
      zoomReset: (options) => this.zoomReset(options),
      setFullscreen: (on) => this.setFullscreen(on),
      download: () => this.download(),
      share: () => this.share(),
      setItems: (items) => this.setItems(items),
      preload: (target) => this.preload(target),
      load: () => this.load(),
    };
    this.api = computed(() => ({ ...this.#state(), ...commands }));
    const { signal: events } = this.#events;
    fluidbox.subscribe(() =>
      this.#zone.run(() => {
        this.#state.set(fluidbox.state);
        this.#list.set(fluidbox.items);
        // A sheet that loads or goes changes the snap too.
        this.#snap.set(fluidbox.sheet?.snap ?? 0);
      }),
    );
    const listen = <
      K extends
        | "beforevaluechange"
        | "valuechangecomplete"
        | "zoomchange"
        | "mediaerror"
        | "reachend"
        | "sheetchange"
        | "valuechange",
    >(
      type: K,
      handle: (event: never) => void,
    ) =>
      fluidbox.addEventListener(type, (event) => this.#zone.run(() => handle(event as never)), {
        signal: events,
      });
    listen("sheetchange", (event: { snap: number }) => this.#snap.set(event.snap));
    listen("beforevaluechange", (event: FluidboxValueChangeEvent<TItem>) =>
      this.beforeValueChange.emit(event),
    );
    // The value the viewer heads for, once nothing canceled the change.
    listen("valuechange", (event: FluidboxValueChangeEvent<TItem>) => this.value.set(event.value));
    listen("valuechangecomplete", (event: FluidboxValueChangeEvent<TItem>) =>
      this.valueChangeComplete.emit(event),
    );
    listen("zoomchange", (event: FluidboxZoomEvent) => this.zoomChange.emit(event));
    listen("mediaerror", (event: FluidboxMediaErrorEvent<TItem>) => this.mediaError.emit(event));
    listen("reachend", (event: FluidboxReachEndEvent<TItem>) => this.reachEnd.emit(event));
    internals.set(this, {
      watch: (listener) => fluidbox.subscribe(() => listener()),
      connect: (kind, part) => {
        this.#parts[kind] = part;
        this.#schedule();
        return () => {
          if (this.#parts[kind] !== part) return;
          this.#parts[kind] = null;
          this.#schedule();
        };
      },
      schedule: () => this.#schedule(),
      slide: (type, part) => {
        if (this.#slides.has(type))
          throw new Error(
            (() => {
              try {
                if (process.env.NODE_ENV !== "production")
                  return type === "default"
                    ? "A fluidboxRoot takes one default fluidboxSlide."
                    : `A fluidboxRoot takes one fluidboxSlide="${type}".`;
              } catch {}
              return "fluidbox";
            })(),
          );
        this.#slides.set(type, part);
        return () => {
          if (this.#slides.get(type) === part) this.#slides.delete(type);
        };
      },
    } satisfies RootInternals<TItem>);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["items"]) void this.setItems(this.items() ?? []);
    if (changes["labels"]) {
      this.#labels.set(resolveLabels(this.labels()));
      this.#update({ labels: this.labels() });
    }
    if (changes["zoom"]) this.#update({ zoom: zoomOption(this.zoom()) });
    if (changes["loop"]) this.#update({ loop: this.loop() });
    if (changes["preloadMode"]) this.#update({ preload: this.preloadMode() });
    if (changes["dismiss"]) this.#update({ dismiss: this.dismiss() && { ...this.dismiss() } });
    if (changes["wheel"]) this.#update({ wheel: this.wheel() });
    if (changes["reachEndThreshold"]) {
      this.#update({ reachEndThreshold: this.reachEndThreshold() });
    }
    // Your value wins whenever it changes, once the triggers inside have
    // registered, so an open flies from the item's own. The default value
    // opens once, as the root starts.
    if (!this.#browser || (this.#started && !changes["value"])) return;
    const starting = !this.#started;
    this.#started = true;
    queueMicrotask(() => {
      if (this.#destroyed) return;
      const copy = this.#copy;
      if (starting && copy) {
        // The viewer opens on the copy's item with no motion and hides the copy.
        const done = () => {
          if (this.#copy === copy) this.#dropCopy();
        };
        this.#zone.runOutsideAngular(
          () => void takeOverFluidbox(this.fluidbox, copy.element, copy.value).then(done, done),
        );
        return;
      }
      const value = this.value();
      this.#zone.runOutsideAngular(() =>
        this.#sync(starting && value === undefined ? (this.defaultValue() ?? undefined) : value),
      );
    });
  }

  /**
   * Open on the first render, the root renders a copy of the open viewer at
   * the end of its element, once the parts inside have said what it shows:
   * on the server, so the page shows the photo before any script runs, and in
   * the browser, where the viewer takes it over without a flight. A copy the
   * server rendered and hydration kept is taken over as it is. It is built as
   * elements, not HTML, so it renders under Trusted Types and a strict style-src.
   */
  ngAfterContentInit(): void {
    const value = this.value() !== undefined ? this.value() : (this.defaultValue() ?? null);
    if (value === null || value === undefined) return;
    const { viewer, thumbnails, sheet } = this.#parts;
    const nodes = fluidboxStaticViewerNodes({
      items: this.items() ?? [],
      value,
      labels: this.resolvedLabels(),
      loop: this.loop(),
      href: this.href(),
      thumbnails: !!thumbnails,
      sheet: !!sheet,
      controls: !viewer,
    });
    if (!nodes) return;
    const host = this.#element.nativeElement;
    const kept = this.#browser
      ? [...host.children].find((child) => child.hasAttribute("data-fluidbox-server-viewer"))
      : undefined;
    let element = kept as HTMLElement | undefined;
    if (!element) {
      element = this.#renderer.createElement("div") as HTMLElement;
      this.#renderer.setAttribute(element, "data-fluidbox-server-viewer", "");
      this.#renderer.appendChild(element, this.#build(nodes));
      this.#renderer.appendChild(host, element);
    }
    this.#copy = { element, value };
  }

  #build(each: FluidboxStaticNode | string): Node {
    const renderer = this.#renderer;
    if (typeof each === "string") return renderer.createText(each) as Node;
    const element = renderer.createElement(each.tag) as Element;
    for (const [name, value] of Object.entries(each.attributes))
      renderer.setAttribute(element, name, value);
    for (const child of each.children) renderer.appendChild(element, this.#build(child));
    return element;
  }

  #dropCopy(): void {
    const copy = this.#copy;
    this.#copy = null;
    if (copy) this.#renderer.removeChild(this.#element.nativeElement, copy.element);
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.#dropCopy();
    // The outputs stop first, so dropping the viewer reports no close.
    this.#events.abort();
    // Drops the viewer and closes it at once.
    unloadFluidbox(this.fluidbox);
    this.#snap.set(0);
  }

  /** Open an item, by the item, its index or its id, or move to it while open. */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean> {
    // Opening can load the viewer, whose listeners stay outside the zone.
    return this.#zone.runOutsideAngular(() => this.fluidbox.open(target, options));
  }

  close(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.close(options));
  }

  next(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.next(options));
  }

  previous(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.previous(options));
  }

  // A zoom can load the zoom's code, whose listeners stay outside the zone.
  zoomTo(scale: number, options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.zoomTo(scale, options));
  }

  zoomIn(options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.zoomIn(options));
  }

  zoomOut(options?: FluidboxZoomCommandOptions): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.zoomOut(options));
  }

  zoomReset(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.zoomReset(options));
  }

  /** Make the open viewer fullscreen, or leave it; without an argument, toggle. */
  setFullscreen(on?: boolean): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.setFullscreen(on));
  }

  /** Download the open item's file. */
  download(): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.download());
  }

  /** Share the open item's link, or copy it. */
  share(): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.share());
  }

  setItems(items: FluidboxItems<TItem>): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.setItems(items));
  }

  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void {
    return this.#zone.runOutsideAngular(() => this.fluidbox.preload(target));
  }

  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.load());
  }

  /** Hand the viewer the parts after the current change detection pass, once every part inside has connected. */
  #schedule(): void {
    if (!this.#browser || this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (this.#destroyed) return;
      const { viewer, thumbnails, sheet } = this.#parts;
      // Unchanged parts compare equal, so the viewer redraws only what changed.
      this.#update({
        viewer: viewer?.render,
        thumbnails: thumbnails
          ? thumbnails.render
            ? { render: thumbnails.render }
            : true
          : undefined,
        sheet: sheet
          ? {
              snapPoints: sheet.snapPoints(),
              dismissMotion: sheet.dismissMotion(),
              render: sheet.render,
            }
          : undefined,
      });
    });
  }

  /**
   * An update can load the thumbnails or sheet, and the viewer's listeners
   * stay outside the zone. Callbacks come back in through zone.run.
   */
  #update(options: FluidboxUpdateOptions<TItem>): void {
    // A server render leaves the fluidbox as it was made: it never opens there.
    if (!this.#browser) return;
    this.#zone.runOutsideAngular(() => this.fluidbox.update(options));
  }
}

/** The root above a part, and what the part may reach of it. */
export function injectRoot<TItem extends FluidboxItem = FluidboxItem>(
  part: string,
): FluidboxRootDirective<TItem> {
  const root = inject(FluidboxRootDirective, { optional: true });
  if (!root)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return `${part} must be inside an element with fluidboxRoot.`;
        } catch {}
        return "fluidbox";
      })(),
    );
  return root as unknown as FluidboxRootDirective<TItem>;
}

/** What a part may reach of its root that apps don't. */
export function internalsOf<TItem extends FluidboxItem>(
  root: FluidboxRootDirective<TItem>,
): RootInternals<TItem> {
  return internals.get(root)!;
}

/**
 * The fluidbox of the root above, as a signal of its state and commands, or of
 * what `select` picks from them. Call in an injection context.
 */
export function injectFluidbox<TItem extends FluidboxItem = FluidboxItem>(): Signal<
  FluidboxApi<TItem>
>;
export function injectFluidbox<TItem extends FluidboxItem = FluidboxItem, T = unknown>(
  select: (fluidbox: FluidboxApi<TItem>) => T,
): Signal<T>;
export function injectFluidbox<TItem extends FluidboxItem, T>(
  select?: (fluidbox: FluidboxApi<TItem>) => T,
): Signal<FluidboxApi<TItem> | T> {
  const api = injectRoot<TItem>("injectFluidbox()").api;
  return select ? computed(() => select(api())) : api;
}

/** The sheet of the root above: its snap as a signal, and `setSnap`. Call in an injection context. */
export function injectFluidboxSheet(): FluidboxSheetApi {
  return injectRoot("injectFluidboxSheet()").sheet;
}
