import {
  Directive,
  EventEmitter,
  Input,
  NgZone,
  Output,
  ViewContainerRef,
  booleanAttribute,
  computed,
  inject,
  signal,
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
  type FluidboxItemChangeEvent,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxOptions,
  type FluidboxOriginAdapter,
  type FluidboxRenderer,
  type FluidboxSlideRenderContext,
  type FluidboxSlideRenderer,
  type FluidboxSheetEvent,
  type FluidboxSheetSnapPoint,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxToggleEvent,
  type FluidboxUpdateOptions,
  type FluidboxViewerRenderer,
  type FluidboxZoomCommandOptions,
  type FluidboxZoomEvent,
} from "@ogdakke/fluidbox";
import {
  fluidboxEventTypes,
  latestOrigins,
  resolveLabels,
  createFluidboxSync,
  watchFluidbox,
  unloadFluidbox,
} from "@ogdakke/fluidbox/kit";
import { injectIsBrowser, mountContent, type FluidboxContent } from "./mount.js";

/** The fluidbox as `injectFluidbox()` gives it: its state, and its commands. */
export interface FluidboxApi<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxState<TItem> {
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
  resetZoom(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean>;
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void;
  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean>;
}

/** The sheet as `injectFluidboxSheet()` gives it. */
export interface FluidboxSheetApi {
  /** The stop the sheet rests at: 0 at rest, then one per snap point. Follows `sheetchange`. */
  readonly stop: Signal<number>;
  /** Move the sheet to a stop. Ignored while the viewer is not open. */
  set(stop: number, options?: { readonly animate?: boolean }): void;
}

/** A `fluidboxViewer` template, as the root sees it. */
export interface FluidboxViewerPart<TItem extends FluidboxItem = FluidboxItem> {
  /** Draws the template into the viewer's layer. Stable for the part's life. */
  readonly render: FluidboxViewerRenderer<TItem>;
}

/** A `fluidboxFilmstrip`, as the root sees it. */
export interface FluidboxFilmstripPart<TItem extends FluidboxItem = FluidboxItem> {
  /** Draws each thumbnail, or null for the default ones. Stable for the part's life. */
  readonly render: FluidboxRenderer<TItem> | null;
}

/** A `fluidboxSheet` template, as the root sees it. */
export interface FluidboxSheetPart<TItem extends FluidboxItem = FluidboxItem> {
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  readonly dismiss?: "flight" | "scroll" | "none";
  /** Fills the sheet for the active item. Stable for the part's life. */
  readonly render: FluidboxRenderer<TItem>;
}

interface Parts<TItem extends FluidboxItem> {
  viewer: FluidboxViewerPart<TItem> | null;
  filmstrip: FluidboxFilmstripPart<TItem> | null;
  sheet: FluidboxSheetPart<TItem> | null;
}

const zoomOption = (zoom: FluidboxOptions["zoom"]) =>
  zoom === false ? false : zoom ? { ...zoom } : undefined;

/**
 * Owns one viewer for a gallery. Parts inside find it through DI. Exported as
 * `fluidbox`: `<div fluidboxRoot #fb="fluidbox">`, then `fb.state()` and
 * `fb.open(2)`.
 *
 * The fluidbox is made with the root and touches nothing until a viewer is
 * pressed or opened. New labels or zoom, and a `fluidboxViewer`,
 * `fluidboxFilmstrip` or `fluidboxSheet` coming, going or changing its inputs,
 * apply to it in place, open or not.
 */
@Directive({ selector: "[fluidboxRoot]", exportAs: "fluidbox", standalone: true })
export class FluidboxRootDirective<TItem extends FluidboxItem = FluidboxItem>
  implements OnChanges, OnDestroy
{
  /** The gallery's items: an array, or a list read on demand. */
  @Input() items: FluidboxItems<TItem> = [];
  /**
   * Whether the viewer is open, for `[(open)]`. The viewer opens on `index`
   * and closes when this changes. Leave it out to let triggers own it.
   */
  @Input("open") opened?: boolean;
  /** The item the viewer shows, for `[(index)]`. */
  @Input() index?: number;
  /** Your strings for the viewer. */
  @Input() labels?: Partial<FluidboxLabels>;
  /** Zoom steps, or false to turn zoom off. */
  @Input() zoom?: FluidboxOptions["zoom"];
  /** Go round: past the last item comes the first. A single item never loops. */
  @Input({ transform: booleanAttribute }) loop = false;
  /** Draw `custom` items, by the name in their `render`: a template or a component. */
  @Input() renderers?: Readonly<Record<string, FluidboxContent<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  @Input() origins?: FluidboxOriginAdapter<TItem>;
  /** When the viewer's code loads: on `"hover"` (the default), on `"press"`, or `"eager"`ly. */
  @Input() loading?: FluidboxOptions["loading"];

  /** Before the viewer opens or closes. `$event.preventDefault()` cancels a command. */
  @Output() readonly beforeToggle = new EventEmitter<FluidboxToggleEvent>();
  /** As the viewer starts to open or close. */
  @Output() readonly toggle = new EventEmitter<FluidboxToggleEvent>();
  /** Before the viewer moves to another item. `$event.preventDefault()` keeps it still. */
  @Output() readonly beforeItemChange = new EventEmitter<FluidboxItemChangeEvent<TItem>>();
  /** When the active item changes, opening included. */
  @Output() readonly itemChange = new EventEmitter<FluidboxItemChangeEvent<TItem>>();
  /** When the active item comes to rest. */
  @Output() readonly settle = new EventEmitter<FluidboxItemChangeEvent<TItem>>();
  /** When the sheet comes to rest at another stop. */
  @Output() readonly sheetChange = new EventEmitter<FluidboxSheetEvent>();
  /** When the image on show comes to rest at another zoom. */
  @Output() readonly zoomChange = new EventEmitter<FluidboxZoomEvent>();
  /** As the viewer opens or closes, from any input. Half of `[(open)]`. */
  @Output() readonly openChange = new EventEmitter<boolean>();
  /** As the viewer moves to another item, opening included. Half of `[(index)]`. */
  @Output() readonly indexChange = new EventEmitter<number>();

  readonly #zone = inject(NgZone);
  readonly #container = inject(ViewContainerRef);
  readonly #browser = injectIsBrowser();
  /** The fluidbox. Parts bind to it as they are made. */
  readonly fluidbox: Fluidbox<TItem> = createFluidbox<TItem>({
    items: [],
    // Renderers resolve by name when a slide mounts, so the newest one is used.
    renderers: new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
      get: (_, name) => {
        const content = typeof name === "string" ? this.renderers?.[name] : undefined;
        if (!content) return undefined;
        return (context: FluidboxSlideRenderContext<TItem>) =>
          mountContent(
            this.#zone,
            this.#container,
            content,
            context.item,
            context.index,
            context.target,
            context,
          );
      },
      has: (_, name) => typeof name === "string" && !!this.renderers?.[name],
    }),
    origins: latestOrigins(() => this.origins),
  });
  readonly #state = signal(this.fluidbox.state);
  readonly #list = signal(this.fluidbox.items);
  readonly #labels = signal(resolveLabels(undefined));
  readonly #stop = signal(0);
  /** The viewer's state. */
  readonly state: Signal<FluidboxState<TItem>> = this.#state.asReadonly();
  /** The item list, which changes with `items`. */
  readonly list: Signal<FluidboxItemList<TItem>> = this.#list.asReadonly();
  /** The labels, with the defaults filled in. */
  readonly resolvedLabels: Signal<FluidboxLabels> = this.#labels.asReadonly();
  /** State and commands, as `injectFluidbox()` gives them. */
  readonly api: Signal<FluidboxApi<TItem>>;
  /** The sheet's stop and command, as `injectFluidboxSheet()` gives them. */
  readonly sheet: FluidboxSheetApi = {
    stop: this.#stop.asReadonly(),
    set: (stop, options) => this.fluidbox.sheet?.set(stop, options),
  };

  readonly #parts: Parts<TItem> = { viewer: null, filmstrip: null, sheet: null };
  #scheduled = false;
  #destroyed = false;
  readonly #sync = createFluidboxSync(this.fluidbox);

  constructor() {
    const fluidbox = this.fluidbox;
    const commands = {
      open: (target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions) =>
        this.open(target, options),
      close: (options?: FluidboxCommandOptions) => fluidbox.close(options),
      next: (options?: FluidboxCommandOptions) => fluidbox.next(options),
      previous: (options?: FluidboxCommandOptions) => fluidbox.previous(options),
      zoomTo: (scale: number, options?: FluidboxZoomCommandOptions) => this.zoomTo(scale, options),
      zoomIn: (options?: FluidboxZoomCommandOptions) => this.zoomIn(options),
      zoomOut: (options?: FluidboxZoomCommandOptions) => this.zoomOut(options),
      resetZoom: (options?: Pick<FluidboxZoomCommandOptions, "signal">) => this.resetZoom(options),
      setItems: (items: FluidboxItems<TItem>) => fluidbox.setItems(items),
      preload: (target: FluidboxTarget<TItem>) => this.preload(target),
      load: () => this.load(),
    };
    this.api = computed(() => ({ ...this.#state(), ...commands }));
    fluidbox.subscribe(() =>
      this.#zone.run(() => {
        this.#state.set(fluidbox.state);
        this.#list.set(fluidbox.items);
      }),
    );
    fluidbox.addEventListener("sheetchange", (event) =>
      this.#zone.run(() => this.#stop.set(event.stop)),
    );
    const outputs = {
      beforetoggle: this.beforeToggle,
      toggle: this.toggle,
      beforeitemchange: this.beforeItemChange,
      itemchange: this.itemChange,
      settle: this.settle,
      sheetchange: this.sheetChange,
      zoomchange: this.zoomChange,
    } as const;
    for (const type of fluidboxEventTypes) {
      const output = outputs[type] as unknown as EventEmitter<Event>;
      fluidbox.addEventListener(type, (event) => {
        if (output.observed) this.#zone.run(() => output.emit(event));
      });
    }
    watchFluidbox(fluidbox, {
      open: (open) => this.openChange.observed && this.#zone.run(() => this.openChange.emit(open)),
      index: (index) =>
        this.indexChange.observed && this.#zone.run(() => this.indexChange.emit(index)),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["items"]) void this.fluidbox.setItems(this.items ?? []);
    if (changes["labels"]) {
      this.#labels.set(resolveLabels(this.labels));
      this.#update({ labels: this.labels });
    }
    if (changes["zoom"]) this.#update({ zoom: zoomOption(this.zoom) });
    if (changes["loop"]) this.#update({ loop: this.loop });
    if (changes["loading"]) this.#update({ loading: this.loading });
    // Your open and index win whenever they change, once the triggers inside
    // have registered, so an open flies from the item's own.
    if ((changes["open"] || changes["index"]) && this.#browser) {
      queueMicrotask(() => {
        if (this.#destroyed) return;
        this.#zone.runOutsideAngular(() => this.#sync(this.opened, this.index));
      });
    }
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    // Drops the viewer and closes it at once.
    unloadFluidbox(this.fluidbox);
    this.#stop.set(0);
  }

  /** Open an item, by the item, its index or its id, or move to it while open. */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean> {
    // Opening can load the viewer, whose listeners stay outside the zone.
    return this.#zone.runOutsideAngular(() => this.fluidbox.open(target, options));
  }

  close(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.fluidbox.close(options);
  }

  next(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.fluidbox.next(options);
  }

  previous(options?: FluidboxCommandOptions): Promise<boolean> {
    return this.fluidbox.previous(options);
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

  resetZoom(options?: Pick<FluidboxZoomCommandOptions, "signal">): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.resetZoom(options));
  }

  setItems(items: FluidboxItems<TItem>): Promise<boolean> {
    return this.fluidbox.setItems(items);
  }

  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void {
    return this.#zone.runOutsideAngular(() => this.fluidbox.preload(target));
  }

  /** Load the viewer's code now. Resolves to true once it has loaded, false if it failed. */
  load(): Promise<boolean> {
    return this.#zone.runOutsideAngular(() => this.fluidbox.load());
  }

  /** @internal For parts: called when the state or the items change. */
  watch(listener: () => void): () => void {
    return this.fluidbox.subscribe(() => listener());
  }

  /** @internal For parts: plug a viewer, filmstrip or sheet into the viewer. */
  connect<K extends keyof Parts<TItem>>(kind: K, part: NonNullable<Parts<TItem>[K]>): () => void {
    this.#parts[kind] = part;
    this.schedule();
    return () => {
      if (this.#parts[kind] !== part) return;
      this.#parts[kind] = null;
      this.schedule();
    };
  }

  /** @internal Hand the viewer the parts after the current change detection pass, once every part inside has connected. */
  schedule(): void {
    if (!this.#browser || this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (this.#destroyed) return;
      const { viewer, filmstrip, sheet } = this.#parts;
      // Unchanged parts compare equal, so the viewer redraws only what changed.
      this.#update({
        viewer: viewer?.render,
        filmstrip: filmstrip ? (filmstrip.render ? { render: filmstrip.render } : true) : undefined,
        sheet: sheet
          ? { snapPoints: sheet.snapPoints, dismiss: sheet.dismiss, render: sheet.render }
          : undefined,
      });
    });
  }

  /**
   * An update can load the filmstrip or sheet, and the viewer's listeners
   * stay outside the zone. Callbacks come back in through zone.run.
   */
  #update(options: FluidboxUpdateOptions<TItem>): void {
    this.#zone.runOutsideAngular(() => this.fluidbox.update(options));
  }
}

/** The root above a part. */
export function injectRoot<TItem extends FluidboxItem = FluidboxItem>(
  part: string,
): FluidboxRootDirective<TItem> {
  const root = inject(FluidboxRootDirective, { optional: true });
  if (!root) throw new Error(`${part} must be inside an element with fluidboxRoot.`);
  return root as unknown as FluidboxRootDirective<TItem>;
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

/** The sheet of the root above: its stop as a signal, and `set`. Call in an injection context. */
export function injectFluidboxSheet(): FluidboxSheetApi {
  return injectRoot("injectFluidboxSheet()").sheet;
}
