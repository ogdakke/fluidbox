import {
  children as resolveChildren,
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  getOwner,
  mapArray,
  mergeProps,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, JSX, Owner } from "solid-js";
import { Dynamic, insert } from "solid-js/web";
import {
  createFluidbox,
  type Fluidbox as FluidboxHandle,
  type FluidboxEventMap,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxRenderer,
  type FluidboxSheetSnapPoint,
  type FluidboxState,
  type FluidboxTarget,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createDeferredFluidbox,
  createTrigger,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  idOf,
  latestOrigins,
  loadAddons,
  resolveLabels,
  type DeferredFluidbox,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxActionProps,
  FluidboxApi,
  FluidboxFilmstripProps,
  FluidboxItemContext,
  FluidboxItemProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxSolidParts,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxViewerProps,
} from "./types";

export type {
  FluidboxActionProps,
  FluidboxApi,
  FluidboxFilmstripProps,
  FluidboxItemContext,
  FluidboxItemProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxSolidParts,
  FluidboxSolidRenderContext,
  FluidboxSolidRenderer,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerPreview,
  FluidboxTriggerProps,
  FluidboxViewerProps,
} from "./types";
export type {
  FluidboxChangeEvent,
  FluidboxCustomItem,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOrigin,
  FluidboxOriginAdapter,
  FluidboxReason,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
  FluidboxToggleEvent,
  FluidboxVideoItem,
} from "@ogdakke/fluidbox";

interface FilmstripRegistration {
  readonly slots: boolean;
}

interface SheetRegistration {
  readonly snapPoints: readonly FluidboxSheetSnapPoint[] | undefined;
  readonly dismiss: "flight" | "scroll" | "none" | undefined;
  readonly render: FluidboxRenderer<any>;
}

interface FluidboxContextValue {
  readonly deferred: DeferredFluidbox<any>;
  readonly state: Accessor<FluidboxState<any>>;
  readonly items: Accessor<FluidboxItemList<any>>;
  /** The fluidbox from createFluidbox, once the browser made one. */
  readonly current: Accessor<FluidboxHandle<any> | null>;
  readonly labels: Accessor<FluidboxLabels>;
  /** The viewer's layer for controls and captions, while the viewer exists. */
  readonly viewerTarget: Accessor<HTMLElement | null>;
  readonly viewers: Accessor<number>;
  addViewer(): () => void;
  setFilmstrip(registration: FilmstripRegistration): () => void;
  setSheet(registration: SheetRegistration): () => void;
}

const FluidboxContext = createContext<FluidboxContextValue>();
const ItemContext = createContext<string>();
const TriggerContext = createContext<Accessor<readonly string[]>>();

function useFluidboxContext(): FluidboxContextValue {
  const value = useContext(FluidboxContext);
  if (!value) throw new Error("Fluidbox components must be rendered inside <Fluidbox.Root>.");
  return value;
}

/**
 * Render content straight into a runtime target, under an owner so its context
 * reaches the content. Unlike solid-js/web's Portal it adds no wrapper element,
 * which the runtime's targets and filmstrip buttons expect. Each mount keeps
 * between its own markers, so several can share a target and leave alone.
 */
function mountInto(
  target: HTMLElement,
  content: () => JSX.Element,
  owner: Owner | null = getOwner(),
): () => void {
  const start = target.ownerDocument.createTextNode("");
  const end = target.ownerDocument.createTextNode("");
  target.append(start, end);
  let dispose: (() => void) | undefined = createRoot((disposeRoot) => {
    insert(target, content, end);
    return disposeRoot;
  }, owner ?? undefined);
  return () => {
    if (!dispose) return;
    dispose();
    dispose = undefined;
    // Remove what this mount inserted, from its start marker to its end marker.
    let node: Node | null = start;
    while (node) {
      const next: Node | null = node === end ? null : node.nextSibling;
      if (node.parentNode === target) target.removeChild(node);
      node = next;
    }
  };
}

/** Keep content mounted in a target while the target exists. */
function mountWhile(target: Accessor<HTMLElement | null>, content: () => JSX.Element): void {
  const owner = getOwner();
  createEffect(() => {
    const element = target();
    if (element) onCleanup(mountInto(element, content, owner));
  });
}

/** Call a Solid event handler, including the bound `[handler, data]` form. */
function callHandler<E>(handler: unknown, event: E): void {
  if (typeof handler === "function") (handler as (event: E) => void)(event);
  else if (Array.isArray(handler) && typeof handler[0] === "function")
    (handler[0] as (data: unknown, event: E) => void)(handler[1], event);
}

function setRef<T>(ref: unknown, element: T): void {
  if (typeof ref === "function") ref(element);
}

/** Hold the newest of several registrations, falling back as each lets go. */
function registry<T>(): [Accessor<T | null>, (value: T) => () => void] {
  const [entries, setEntries] = createSignal<readonly T[]>([]);
  const latest = createMemo(() => entries().at(-1) ?? null);
  return [
    latest,
    (value) => {
      setEntries((current) => [...current, value]);
      return () => setEntries((current) => current.filter((entry) => entry !== value));
    },
  ];
}

const eventProps = {
  beforetoggle: "onBeforeToggle",
  toggle: "onToggle",
  beforeitemchange: "onBeforeItemChange",
  itemchange: "onItemChange",
  settle: "onSettle",
} as const satisfies Record<keyof FluidboxEventMap, keyof FluidboxRootProps>;

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): JSX.Element {
  const deferred = createDeferredFluidbox<TItem>(untrack(() => props.items));
  const fluidbox = deferred.fluidbox;
  const [state, setState] = createSignal(fluidbox.state);
  const [items, setItems] = createSignal(fluidbox.items, { equals: false });
  const [current, setCurrent] = createSignal<FluidboxHandle<TItem> | null>(null);
  const [viewerTarget, setViewerTarget] = createSignal<HTMLElement | null>(null);
  const [viewers, setViewers] = createSignal(0);
  const [filmstrip, setFilmstrip] = registry<FilmstripRegistration>();
  const [sheet, setSheet] = registry<SheetRegistration>();
  const labels = createMemo(() => resolveLabels(props.labels));
  onCleanup(
    deferred.subscribe(() => {
      setState(fluidbox.state);
      setItems(fluidbox.items);
    }),
  );

  for (const type of fluidboxEventTypes) {
    const listener = (event: Event) =>
      (props[eventProps[type]] as ((event: Event) => void) | undefined)?.(event);
    fluidbox.addEventListener(type, listener);
    onCleanup(() => fluidbox.removeEventListener(type, listener));
  }

  // Custom content renders under an owner inside the Provider, so it reaches
  // both the app's context and the fluidbox's.
  let contentOwner: Owner | null = getOwner();
  const mounts = new Set<() => void>();
  onCleanup(() => {
    for (const dispose of mounts) dispose();
  });
  const mount = (target: HTMLElement, content: () => JSX.Element) => {
    const dispose = mountInto(target, content, contentOwner);
    const release = () => {
      mounts.delete(release);
      dispose();
    };
    mounts.add(release);
    return release;
  };
  // Renderers resolve by key when an item renders, so the newest render
  // function is used without rebuilding the viewer.
  const renderers = new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
    get(_, key) {
      const renderer = typeof key === "string" ? props.renderers?.[key] : undefined;
      return renderer
        ? (((context) =>
            mount(context.target, () =>
              renderer({ item: context.item, index: context.index, signal: context.signal }),
            )) satisfies FluidboxRenderer<TItem>)
        : undefined;
    },
    has: (_, key) => typeof key === "string" && !!props.renderers?.[key],
  });

  const zoomKey = () =>
    props.zoom === false ? "off" : `${props.zoom?.step ?? ""}:${props.zoom?.max ?? ""}`;
  const filmstripKey = createMemo(() => {
    const part = filmstrip();
    return part ? (part.slots ? "slots" : "default") : "";
  });
  const sheetKey = createMemo(() => {
    const part = sheet();
    return part ? JSON.stringify([part.snapPoints ?? null, part.dismiss ?? null]) : "";
  });

  // The viewer is made in the browser only, and made again when an option it
  // reads once changes.
  createEffect(() => {
    zoomKey();
    labels();
    filmstripKey();
    sheetKey();
    let live = true;
    let release: (() => void) | undefined;
    const build = () => {
      const zoom = props.zoom;
      const strip = filmstrip();
      const details = sheet();
      const real = createFluidbox<TItem>({
        items: fluidbox.items,
        labels: props.labels,
        zoom: zoom === false ? false : zoom ? { ...zoom } : undefined,
        renderers,
        origins: latestOrigins(() => props.origins),
        filmstrip: strip ? (strip.slots ? { slots: true } : true) : false,
        sheet: details
          ? {
              snapPoints: details.snapPoints,
              dismiss: details.dismiss,
              render: (context) => details.render(context),
            }
          : false,
        viewer: ({ target }) => {
          setViewerTarget(target);
          return () => setViewerTarget((shown) => (shown === target ? null : shown));
        },
      });
      deferred.attach(real);
      setCurrent(() => real);
      release = () => {
        setCurrent(null);
        deferred.detach();
        real.destroy();
      };
    };
    onCleanup(() => {
      live = false;
      release?.();
    });
    // The Filmstrip and Sheet parts load their add-ons the first time they are used.
    const names = [
      ...(filmstripKey() ? (["filmstrip"] as const) : []),
      ...(sheetKey() ? (["sheet"] as const) : []),
    ];
    const loading = loadAddons(names);
    if (!loading) untrack(build);
    else void loading.then(() => live && untrack(build));
  });

  createRenderEffect(
    on(
      () => props.items,
      (next) => void fluidbox.setItems(next),
      { defer: true },
    ),
  );

  const value: FluidboxContextValue = {
    deferred,
    state,
    items,
    current,
    labels,
    viewerTarget,
    viewers,
    addViewer() {
      setViewers((count) => count + 1);
      return () => setViewers((count) => count - 1);
    },
    setFilmstrip,
    setSheet,
  };

  return createComponent(FluidboxContext.Provider, {
    value,
    get children() {
      return [
        createComponent(DefaultViewer, {
          capture(owner: Owner | null) {
            contentOwner = owner;
          },
        }),
        props.children,
      ];
    },
  });
}

/** Renders the default controls into the viewer while no Viewer part does. */
function DefaultViewer(props: { capture(owner: Owner | null): void }): JSX.Element {
  props.capture(getOwner());
  const context = useFluidboxContext();
  mountWhile(
    () => (context.viewers() === 0 ? context.viewerTarget() : null),
    () => createComponent(Controls, {}),
  );
  return null;
}

function Item(props: FluidboxItemProps): JSX.Element {
  return createComponent(ItemContext.Provider, {
    get value() {
      return props.id;
    },
    get children() {
      return props.children;
    },
  });
}

const targetOf = (value: FluidboxItem | FluidboxTarget): FluidboxTarget =>
  typeof value === "object" ? idOf(value) : value;

const sameTargets = (a: readonly FluidboxTarget[], b: readonly FluidboxTarget[]) =>
  a.length === b.length && a.every((target, index) => target === b[index]);

const samePreview = (a: FluidboxTriggerPreview, b: FluidboxTriggerPreview) =>
  a.item === b.item && a.index === b.index && a.status === b.status;

function Trigger<TItem extends FluidboxItem>(props: FluidboxTriggerProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const enclosingId = useContext(ItemContext);
  const [local, attributes] = splitProps(props, [
    "as",
    "item",
    "items",
    "ref",
    "children",
    "onClick",
    "onPointerDown",
    "onPointerUp",
    "onPointerCancel",
  ]);
  // The opened item comes first; the rest may return to this trigger on close.
  const targets = createMemo(
    () => {
      const first = local.item ?? local.items?.[0] ?? enclosingId;
      if (first === undefined)
        throw new Error("<Fluidbox.Trigger> needs item, items, or an enclosing <Fluidbox.Item>.");
      return [...new Set([targetOf(first), ...(local.items?.map(targetOf) ?? [])])];
    },
    undefined,
    { equals: sameTargets },
  );
  // The ids, for a ThumbnailOverlay inside.
  const ids = createMemo(
    () => {
      const list = context.items();
      return targets().flatMap((target) =>
        typeof target === "string"
          ? [target]
          : target >= 0 && target < list.count
            ? [idOf(list.get(target))]
            : [],
      );
    },
    undefined,
    { equals: sameTargets },
  );
  // Bumped when the closing flight lands on another item. Signals update the DOM
  // synchronously, so the preview is current before the flight measures it.
  const [landing, setLanding] = createSignal(0);
  const options = () => ({
    targets: targets(),
    onPreviewChange: () => setLanding((count) => count + 1),
  });
  const trigger = createTrigger<TItem>(context.deferred.fluidbox, untrack(options));
  createRenderEffect(() => trigger.update(options()));
  createEffect(on(context.items, () => trigger.refresh(), { defer: true }));
  onCleanup(() => trigger.destroy());

  const preview = createMemo(
    () => {
      landing();
      context.items();
      return trigger.preview(context.state());
    },
    undefined,
    { equals: samePreview },
  );
  const isButton = () => local.as === undefined || local.as === "button";

  return createComponent(TriggerContext.Provider, {
    value: ids,
    get children() {
      return createComponent(
        Dynamic,
        mergeProps(
          {
            get type() {
              return isButton() ? "button" : undefined;
            },
          },
          attributes,
          {
            get component() {
              return local.as ?? "button";
            },
            ref(element: HTMLElement) {
              setRef(local.ref, element);
              trigger.setElement(element);
            },
            onClick(event: MouseEvent) {
              callHandler(local.onClick, event);
              trigger.click(event);
            },
            onPointerDown(event: PointerEvent) {
              callHandler(local.onPointerDown, event);
              trigger.pointerDown(event);
            },
            onPointerUp(event: PointerEvent) {
              callHandler(local.onPointerUp, event);
              trigger.pointerUp();
            },
            onPointerCancel(event: PointerEvent) {
              callHandler(local.onPointerCancel, event);
              trigger.pointerCancel();
            },
            get children() {
              const content = local.children;
              return typeof content === "function" ? content(preview) : content;
            },
          },
        ) as never,
      );
    },
  });
}

/**
 * Renders your controls and captions into the viewer, keeping the surrounding
 * context. While one is mounted, the viewer has no default controls: add
 * `Fluidbox.Controls`, or `Close`, `Previous` and `Next`, where you want them.
 */
function Viewer(props: FluidboxViewerProps): JSX.Element {
  const context = useFluidboxContext();
  onCleanup(context.addViewer());
  mountWhile(context.viewerTarget, () => props.children);
  return null;
}

function action(name: FluidboxControlName) {
  const control = fluidboxControls[name];
  return function FluidboxAction(props: FluidboxActionProps): JSX.Element {
    const [local, attributes] = splitProps(props, ["children", "onClick"]);
    const context = useFluidboxContext();
    const content = resolveChildren(() => local.children);
    const isEmpty = createMemo(() => {
      const value = content();
      return value == null || (Array.isArray(value) && value.length === 0);
    });
    return createComponent(
      Dynamic,
      mergeProps(
        {
          component: "button",
          type: "button",
          get disabled() {
            return control.disabled(context.state());
          },
          get "aria-label"() {
            return isEmpty() ? control.label(context.labels()) : undefined;
          },
        },
        attributes,
        {
          [control.attribute]: "",
          "data-fluidbox-managed": "",
          onClick(event: MouseEvent) {
            callHandler(local.onClick, event);
            if (event.defaultPrevented) return;
            // Prevented, so the viewer's own handling of the attribute skips it.
            event.preventDefault();
            void control.run(context.deferred.fluidbox, event);
          },
          get children() {
            return isEmpty() ? defaultIcon(name) : content();
          },
        },
      ) as never,
    );
  };
}

function defaultIcon(name: FluidboxControlName): JSX.Element {
  return createComponent(
    Dynamic,
    mergeProps(fluidboxControlIcon.attributes, {
      component: "svg",
      "data-fluidbox-icon": "",
      get children() {
        return createComponent(Dynamic, {
          component: "path",
          d: fluidboxControlIcon.paths[name],
        } as never);
      },
    }) as never,
  );
}

const Close = action("close");
const Previous = action("previous");
const Next = action("next");
const actions = { close: Close, previous: Previous, next: Next };

/** The default Previous, Next and Close buttons, for a Viewer of your own. */
function Controls(): JSX.Element {
  return controlNames.map((name) => createComponent(actions[name], {}));
}

/**
 * Turns the filmstrip on. With a child function, it renders each thumbnail;
 * the selected button has `data-fluidbox-selected`.
 */
function Filmstrip<TItem extends FluidboxItem>(props: FluidboxFilmstripProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const render = untrack(() => props.children);
  onCleanup(context.setFilmstrip({ slots: typeof render === "function" }));
  const [slots, setSlots] = createSignal<readonly FluidboxItemContext<TItem>[]>([]);
  createEffect(() => {
    const strip = (context.current() as FluidboxHandle<TItem> | null)?.filmstrip;
    if (!strip) return setSlots([]);
    const update = () => setSlots(strip.slots);
    update();
    onCleanup(strip.subscribe(update));
  });
  const owner = getOwner();
  const mounted = mapArray(
    () => slots() as readonly { item: TItem; index: number; target: HTMLElement }[],
    ({ item, index, target }) => {
      const children = props.children;
      if (children) onCleanup(mountInto(target, () => children({ item, index }), owner));
    },
  );
  createEffect(mounted);
  return null;
}

/**
 * Turns the sheet on, and renders its content for the active item. Needs
 * `@ogdakke/fluidbox/sheet.css`. Changing `snapPoints` or `dismiss` rebuilds the viewer.
 */
function Sheet<TItem extends FluidboxItem>(props: FluidboxSheetProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const owner = getOwner();
  onCleanup(
    context.setSheet({
      get snapPoints() {
        return props.snapPoints;
      },
      get dismiss() {
        return props.dismiss;
      },
      render: ({ item, index, target }) =>
        mountInto(
          target,
          () => {
            const content = props.children;
            return typeof content === "function"
              ? content({ item: item as TItem, index })
              : content;
          },
          owner,
        ),
    }),
  );
  return null;
}

/** A button that moves the sheet to a stop, and back to 0 when it is there. Use it in the viewer. */
function SheetStop(props: FluidboxSheetStopProps): JSX.Element {
  const [local, attributes] = splitProps(props, ["stop"]);
  return createComponent(
    Dynamic,
    mergeProps({ component: "button", type: "button" }, attributes, {
      get "data-fluidbox-sheet-stop"() {
        return String(local.stop);
      },
    }) as never,
  );
}

/**
 * A badge or caption on a trigger's thumbnail. It gets `--fluidbox-progress`
 * and `data-fluidbox-phase` as the viewer opens and closes; with `travel` it
 * flies with the photo.
 */
function ThumbnailOverlay(props: FluidboxThumbnailOverlayProps): JSX.Element {
  const context = useFluidboxContext();
  const id = useContext(ItemContext);
  const triggerIds = useContext(TriggerContext);
  const ids = () => triggerIds?.() ?? (id === undefined ? null : [id]);
  if (!untrack(ids))
    throw new Error("<Fluidbox.ThumbnailOverlay> needs an enclosing Trigger or Item.");
  const [local, attributes] = splitProps(props, ["travel", "ref", "children"]);
  const [element, setElement] = createSignal<HTMLSpanElement | null>(null);
  const owner = getOwner();

  createEffect(() => {
    const host = element();
    const targets = ids();
    const travel = local.travel;
    context.items();
    if (!host || !targets?.length) return;
    onCleanup(
      untrack(() =>
        context.deferred.fluidbox.bindOverlay(
          host,
          targets,
          travel ? { travel: ({ target }) => mountInto(target, () => local.children, owner) } : {},
        ),
      ),
    );
  });

  return createComponent(
    Dynamic,
    mergeProps(attributes, {
      component: "span",
      ref(next: HTMLSpanElement) {
        setRef(local.ref, next);
        setElement(next);
      },
      get "data-fluidbox-thumbnail-overlay"() {
        return local.travel ? "travel" : "";
      },
      get children() {
        return local.children;
      },
    }) as never,
  );
}

/**
 * The viewer's state and commands, or a memo of the part a selector picks.
 * The state fields are reactive getters: read them in JSX or an effect.
 */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector: (state: FluidboxState<TItem>) => TSelected,
): Accessor<TSelected>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector?: (state: FluidboxState<TItem>) => TSelected,
): FluidboxApi<TItem> | Accessor<TSelected> {
  const context = useFluidboxContext();
  const state = context.state as Accessor<FluidboxState<TItem>>;
  if (selector) return createMemo(() => selector(state()));
  const fluidbox = context.deferred.fluidbox as FluidboxHandle<TItem>;
  return {
    get status() {
      return state().status;
    },
    get id() {
      return state().id;
    },
    get index() {
      return state().index;
    },
    get item() {
      return state().item;
    },
    get count() {
      return state().count;
    },
    get hasPrevious() {
      return state().hasPrevious;
    },
    get hasNext() {
      return state().hasNext;
    },
    open: (target, options) => fluidbox.open(target, options),
    close: (options) => fluidbox.close(options),
    next: (options) => fluidbox.next(options),
    previous: (options) => fluidbox.previous(options),
    setItems: (items: FluidboxItems<TItem>) => fluidbox.setItems(items),
  };
}

/** The sheet's stop as a signal, and a command to move it. Needs a Fluidbox.Sheet. */
export function useFluidboxSheet(): FluidboxSheetApi {
  const context = useFluidboxContext();
  const [stop, setStop] = createSignal(0);
  createEffect(() => {
    const sheet = context.current()?.sheet;
    if (!sheet) return setStop(0);
    setStop(sheet.stop);
    onCleanup(sheet.subscribe(setStop));
  });
  return {
    stop,
    set: (next, options) => context.current()?.sheet?.set(next, options),
  };
}

export const Fluidbox: FluidboxSolidParts = {
  Root,
  Item,
  Trigger,
  Viewer,
  Controls,
  Close,
  Previous,
  Next,
  Filmstrip,
  Sheet,
  SheetStop,
  ThumbnailOverlay,
};
