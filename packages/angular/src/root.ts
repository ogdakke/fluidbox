import {
  Directive,
  EventEmitter,
  Input,
  NgZone,
  Output,
  ViewContainerRef,
  computed,
  inject,
  signal,
  type OnChanges,
  type OnDestroy,
  type OnInit,
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
  type FluidboxRenderContext,
  type FluidboxRenderer,
  type FluidboxSheetEvent,
  type FluidboxSheetSnapPoint,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxToggleEvent,
  type FluidboxUpdateOptions,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import {
  createDeferredFluidbox,
  fluidboxEventTypes,
  latestOrigins,
  loadAddons,
  resolveLabels,
  type DeferredFluidbox,
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
  setItems(items: FluidboxItems<TItem>): Promise<boolean>;
  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void;
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
 * The viewer is made once and lives as long as the root. New labels or zoom,
 * and a `fluidboxViewer`, `fluidboxFilmstrip` or `fluidboxSheet` coming, going
 * or changing its inputs, apply to it in place, open or not.
 */
@Directive({ selector: "[fluidboxRoot]", exportAs: "fluidbox", standalone: true })
export class FluidboxRootDirective<TItem extends FluidboxItem = FluidboxItem>
  implements OnChanges, OnInit, OnDestroy
{
  /** The gallery's items: an array, or a list read on demand. */
  @Input() items: FluidboxItems<TItem> = [];
  /** Your strings for the viewer. */
  @Input() labels?: Partial<FluidboxLabels>;
  /** Zoom steps, or false to turn zoom off. */
  @Input() zoom?: FluidboxOptions["zoom"];
  /** Draw `custom` items, by the name in their `render`: a template or a component. */
  @Input() renderers?: Readonly<Record<string, FluidboxContent<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  @Input() origins?: FluidboxOriginAdapter<TItem>;

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

  /** Stands in for the viewer, so parts can bind before it exists. */
  readonly deferred: DeferredFluidbox<TItem> = createDeferredFluidbox<TItem>([]);
  readonly #state = signal(this.deferred.fluidbox.state);
  readonly #list = signal(this.deferred.fluidbox.items);
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

  readonly #zone = inject(NgZone);
  readonly #container = inject(ViewContainerRef);
  readonly #browser = injectIsBrowser();
  readonly #parts: Parts<TItem> = { viewer: null, filmstrip: null, sheet: null };
  /** Options changed since the viewer last saw them. */
  #pending: FluidboxUpdateOptions<TItem> = {};
  #viewer: Fluidbox<TItem> | undefined;
  #loading = false;
  #scheduled = false;
  #initialized = false;
  #destroyed = false;

  constructor() {
    const fluidbox = this.fluidbox;
    const commands = {
      open: (target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions) =>
        fluidbox.open(target, options),
      close: (options?: FluidboxCommandOptions) => fluidbox.close(options),
      next: (options?: FluidboxCommandOptions) => fluidbox.next(options),
      previous: (options?: FluidboxCommandOptions) => fluidbox.previous(options),
      setItems: (items: FluidboxItems<TItem>) => fluidbox.setItems(items),
      preload: (target: FluidboxTarget<TItem>) => fluidbox.preload(target),
    };
    this.api = computed(() => ({ ...this.#state(), ...commands }));
    this.deferred.subscribe(() =>
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
    } as const;
    for (const type of fluidboxEventTypes) {
      const output = outputs[type] as unknown as EventEmitter<Event>;
      fluidbox.addEventListener(type, (event) => {
        if (output.observed) this.#zone.run(() => output.emit(event));
      });
    }
  }

  /** The fluidbox: the viewer once it exists, a stand-in before. */
  get fluidbox(): Fluidbox<TItem> {
    return this.deferred.fluidbox;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["items"]) void this.fluidbox.setItems(this.items ?? []);
    if (changes["labels"]) {
      this.#labels.set(resolveLabels(this.labels));
      this.#pending = { ...this.#pending, labels: this.labels };
      this.schedule();
    }
    if (changes["zoom"]) {
      this.#pending = { ...this.#pending, zoom: zoomOption(this.zoom) };
      this.schedule();
    }
  }

  ngOnInit(): void {
    this.#initialized = true;
    this.schedule();
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.deferred.detach();
    this.#viewer?.destroy();
    this.#viewer = undefined;
    this.#stop.set(0);
  }

  /** Open an item, by the item, its index or its id, or move to it while open. */
  open(target?: FluidboxTarget<TItem>, options?: FluidboxCommandOptions): Promise<boolean> {
    return this.fluidbox.open(target, options);
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

  setItems(items: FluidboxItems<TItem>): Promise<boolean> {
    return this.fluidbox.setItems(items);
  }

  /** Start loading an item a press is likely to open. Call the result to let go. */
  preload(target: FluidboxTarget<TItem>): () => void {
    return this.fluidbox.preload(target);
  }

  /** For parts: called when the state or the items change. */
  watch(listener: () => void): () => void {
    return this.deferred.subscribe(listener);
  }

  /** For parts: plug a viewer, filmstrip or sheet into the viewer. */
  connect<K extends keyof Parts<TItem>>(kind: K, part: NonNullable<Parts<TItem>[K]>): () => void {
    this.#parts[kind] = part;
    this.schedule();
    return () => {
      if (this.#parts[kind] !== part) return;
      this.#parts[kind] = null;
      this.schedule();
    };
  }

  /**
   * Make the viewer after the current change detection pass, once every part
   * inside has connected; after that, hand it what changed.
   */
  schedule(): void {
    if (!this.#browser || !this.#initialized || this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (!this.#destroyed) this.#sync();
    });
  }

  /** The options the parts give, with their stable renderers. */
  #partOptions(): FluidboxUpdateOptions<TItem> {
    const { viewer, filmstrip, sheet } = this.#parts;
    return {
      viewer: viewer?.render,
      filmstrip: filmstrip ? (filmstrip.render ? { render: filmstrip.render } : true) : undefined,
      sheet: sheet
        ? { snapPoints: sheet.snapPoints, dismiss: sheet.dismiss, render: sheet.render }
        : undefined,
    };
  }

  #sync(): void {
    if (this.#loading) return;
    const { filmstrip, sheet } = this.#parts;
    // The filmstrip and sheet runtimes load the first time a root uses them.
    const loading = loadAddons([
      ...(filmstrip ? (["filmstrip"] as const) : []),
      ...(sheet ? (["sheet"] as const) : []),
    ]);
    if (loading) {
      // Again once they are in: by then the parts may have changed, or the root gone.
      this.#loading = true;
      void loading.then(() => {
        this.#loading = false;
        if (!this.#destroyed) this.#sync();
      });
      return;
    }
    const parts = this.#partOptions();
    if (this.#viewer) {
      const pending = this.#pending;
      this.#pending = {};
      // Unchanged parts compare equal, so the viewer redraws only what changed.
      this.#viewer.update({ ...pending, ...parts });
      return;
    }
    this.#pending = {};
    // Renderers resolve by name when a slide mounts, so the newest one is used.
    const renderers = new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
      get: (_, name) => {
        const content = typeof name === "string" ? this.renderers?.[name] : undefined;
        if (!content) return undefined;
        return ({ item, index, target }: FluidboxRenderContext<TItem>) =>
          mountContent(this.#zone, this.#container, content, item, index, target);
      },
      has: (_, name) => typeof name === "string" && !!this.renderers?.[name],
    });
    // The runtime listens to pointer and key events; outside the zone they do
    // not run change detection. Callbacks come back in through zone.run.
    const viewer = this.#zone.runOutsideAngular(() =>
      createFluidbox<TItem>({
        items: this.fluidbox.items,
        labels: this.labels,
        zoom: zoomOption(this.zoom),
        renderers,
        origins: latestOrigins(() => this.origins),
        ...parts,
      }),
    );
    this.#viewer = viewer;
    this.deferred.attach(viewer);
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
