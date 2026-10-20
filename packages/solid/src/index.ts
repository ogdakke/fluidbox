/** The Solid binding: the `Fluidbox` parts and the `useFluidbox` and `useFluidboxSheet` primitives. */
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
  mergeProps,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, JSX, Owner } from "solid-js";
import { Dynamic, insert, spread } from "solid-js/web";
import {
  createFluidbox,
  type Fluidbox as FluidboxHandle,
  type FluidboxEventMap,
  type FluidboxControlName,
  type FluidboxFilmstripOptions,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxRenderer,
  type FluidboxSheetEvent,
  type FluidboxSheetOptions,
  type FluidboxState,
  type FluidboxTarget,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createTrigger,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  frameLayerOf,
  latestOrigins,
  resolveLabels,
  targetKeys,
  unloadFluidbox,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxActionProps,
  FluidboxApi,
  FluidboxFilmstripProps,
  FluidboxFrameLayerProps,
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
  FluidboxFrameLayerProps,
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
  FluidboxCustomItem,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItemChangeEvent,
  FluidboxItemList,
  FluidboxItemListOptions,
  FluidboxItems,
  FluidboxLabels,
  FluidboxOrigin,
  FluidboxOriginAdapter,
  FluidboxReason,
  FluidboxSheetEvent,
  FluidboxSheetSnapPoint,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
  FluidboxToggleEvent,
  FluidboxVideoItem,
} from "@ogdakke/fluidbox";

interface FilmstripRegistration {
  readonly option: true | FluidboxFilmstripOptions<any>;
}

interface SheetRegistration {
  readonly option: FluidboxSheetOptions<any>;
}

interface FluidboxContextValue {
  readonly fluidbox: FluidboxHandle<any>;
  readonly state: Accessor<FluidboxState<any>>;
  readonly items: Accessor<FluidboxItemList<any>>;
  readonly labels: Accessor<FluidboxLabels>;
  /** The viewer's layer for controls and captions, while the viewer exists. */
  readonly viewerTarget: Accessor<HTMLElement | null>;
  readonly viewers: Accessor<number>;
  addViewer(): () => void;
  setFilmstrip(registration: FilmstripRegistration): () => void;
  setSheet(registration: SheetRegistration): () => void;
}

interface TriggerContextValue {
  readonly target: Accessor<FluidboxTarget<any>>;
  readonly returns: Accessor<readonly FluidboxTarget<any>[] | undefined>;
}

const FluidboxContext = createContext<FluidboxContextValue>();
const TriggerContext = createContext<TriggerContextValue>();
/** Where a ThumbnailOverlay's children render: on the page, or in the flying frame. */
const OverlayContext = createContext<"page" | "travel">();

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
  sheetchange: "onSheetChange",
} as const satisfies Record<keyof FluidboxEventMap, keyof FluidboxRootProps>;

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): JSX.Element {
  const [viewerTarget, setViewerTarget] = createSignal<HTMLElement | null>(null);
  const [viewers, setViewers] = createSignal(0);
  const [filmstrip, setFilmstrip] = registry<FilmstripRegistration>();
  const [sheet, setSheet] = registry<SheetRegistration>();
  const labels = createMemo(() => resolveLabels(props.labels));

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

  const zoom = createMemo(
    () => {
      const value = props.zoom;
      return value === false ? false : value ? { ...value } : undefined;
    },
    undefined,
    {
      equals: (a, b) => a === b || (!!a && !!b && a.step === b.step && a.max === b.max),
    },
  );

  // The fluidbox exists from the start, so parts bind to it as they render. It
  // touches nothing until a viewer is pressed or opened.
  const fluidbox = createFluidbox<TItem>({
    items: untrack(() => props.items),
    labels: untrack(() => props.labels),
    zoom: untrack(zoom),
    // Renderers resolve by key when an item renders, so the newest render
    // function is used without rebuilding the viewer.
    renderers: new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
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
    }),
    origins: latestOrigins(() => props.origins),
    viewer: ({ target }) => {
      setViewerTarget(target);
      return () => setViewerTarget((shown) => (shown === target ? null : shown));
    },
  });
  onCleanup(() => unloadFluidbox(fluidbox));

  const [state, setState] = createSignal(fluidbox.state);
  const [items, setItems] = createSignal(fluidbox.items, { equals: false });
  onCleanup(
    fluidbox.subscribe(() => {
      setState(fluidbox.state);
      setItems(fluidbox.items);
    }),
  );
  const events = new AbortController();
  onCleanup(() => events.abort());
  for (const type of fluidboxEventTypes) {
    fluidbox.addEventListener(
      type,
      (event) => (props[eventProps[type]] as ((event: Event) => void) | undefined)?.(event),
      { signal: events.signal },
    );
  }

  createEffect(
    on(
      () => props.labels,
      (next) => fluidbox.update({ labels: next }),
      { defer: true },
    ),
  );
  createEffect(on(zoom, (next) => fluidbox.update({ zoom: next }), { defer: true }));
  // Each part's render functions stay the same while it is mounted, so the
  // viewer only remounts an add-on when its options really change. Not
  // deferred: the parts register as Root's children render, before this runs.
  const filmstripOption = createMemo(() => filmstrip()?.option ?? false);
  const sheetOption = createMemo(() => sheet()?.option ?? false);
  createEffect(() => fluidbox.update({ filmstrip: filmstripOption(), sheet: sheetOption() }));

  createRenderEffect(
    on(
      () => props.items,
      (next) => void fluidbox.setItems(next),
      { defer: true },
    ),
  );

  const value: FluidboxContextValue = {
    fluidbox,
    state,
    items,
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

const samePreview = (a: FluidboxTriggerPreview, b: FluidboxTriggerPreview) =>
  a.item === b.item && a.index === b.index && a.status === b.status;

function Trigger<TItem extends FluidboxItem>(props: FluidboxTriggerProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const [local, attributes] = splitProps(props, [
    "as",
    "item",
    "returns",
    "ref",
    "children",
    "onClick",
    "onPointerDown",
    "onPointerUp",
    "onPointerCancel",
  ]);
  const target = () => {
    const item = local.item;
    if (item === undefined || item === null)
      throw new Error("<Fluidbox.Trigger> needs an item: the item, its id or its index.");
    return item;
  };
  // Bumped when the closing flight lands on another item. Signals update the DOM
  // synchronously, so the preview is current before the flight measures it.
  const [landing, setLanding] = createSignal(0);
  const options = () => ({
    target: target(),
    returns: local.returns,
    onPreviewChange: () => setLanding((count) => count + 1),
  });
  const trigger = createTrigger<TItem>(context.fluidbox, untrack(options));
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
    value: { target, returns: () => local.returns },
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
            void control.run(context.fluidbox, event);
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
  const owner = getOwner();
  const custom = typeof untrack(() => props.children) === "function";
  // Renders straight into each button; the newest children are read as it does.
  const render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountInto(target, () => props.children?.({ item, index }), owner);
  onCleanup(context.setFilmstrip({ option: custom ? { render } : true }));
  return null;
}

/**
 * Turns the sheet on, and renders its content for the active item into the
 * runtime's `<section data-fluidbox-sheet>`, which gets this part's attributes.
 * Needs `@ogdakke/fluidbox/sheet.css`.
 */
function Sheet<TItem extends FluidboxItem>(props: FluidboxSheetProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const owner = getOwner();
  const [local, attributes] = splitProps(props, ["snapPoints", "dismiss", "children"]);
  const render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountInto(
      target,
      () => {
        untrack(() => spread(target, attributes, false, true));
        return local.children?.({ item, index });
      },
      owner,
    );
  const option = createMemo(() => ({
    snapPoints: local.snapPoints,
    dismiss: local.dismiss,
    render,
  }));
  onCleanup(
    context.setSheet({
      get option() {
        return option();
      },
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
 * A badge or caption on a trigger's thumbnail. It gets `--fluidbox-closed`
 * and `data-fluidbox-phase` as the viewer opens and closes; with `travel` its
 * children render live in the flying frame, and a FrameLayer inside flies too.
 */
function ThumbnailOverlay(props: FluidboxThumbnailOverlayProps): JSX.Element {
  const context = useFluidboxContext();
  const trigger = useContext(TriggerContext);
  if (!trigger) throw new Error("<Fluidbox.ThumbnailOverlay> must be inside a <Fluidbox.Trigger>.");
  const [local, attributes] = splitProps(props, ["travel", "ref", "children"]);
  const [element, setElement] = createSignal<HTMLSpanElement | null>(null);
  const owner = getOwner();
  const targets = createMemo(() => targetKeys(trigger.target(), trigger.returns()).join("\u0000"));
  const content = (where: "page" | "travel") =>
    createComponent(OverlayContext.Provider, {
      value: where,
      get children() {
        return local.children;
      },
    });
  const travel: FluidboxRenderer = ({ target }) =>
    mountInto(target, () => content("travel"), owner);

  createEffect(() => {
    const host = element();
    const travels = local.travel;
    targets();
    if (!host) return;
    onCleanup(
      untrack(() =>
        context.fluidbox.bindOverlay(
          host,
          trigger.target(),
          travels
            ? { returns: trigger.returns(), travel, frameLayer: frameLayerOf(host) }
            : { returns: trigger.returns() },
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
        return content("page");
      },
    }) as never,
  );
}

/**
 * A layer of a travelling ThumbnailOverlay, such as a scrim, that moves into the
 * flying frame and scales with it. The frame's live copy of the overlay leaves
 * it out, so it never shows twice.
 */
function FrameLayer(props: FluidboxFrameLayerProps): JSX.Element {
  const where = useContext(OverlayContext);
  if (!where)
    throw new Error("<Fluidbox.FrameLayer> must be inside a <Fluidbox.ThumbnailOverlay>.");
  if (where === "travel") return null;
  return createComponent(
    Dynamic,
    mergeProps(props, { component: "span", "data-fluidbox-frame-layer": "" }) as never,
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
  const fluidbox = context.fluidbox as FluidboxHandle<TItem>;
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
    preload: (target) => fluidbox.preload(target),
  };
}

/** The sheet's stop as a signal, and a command to move it. Needs a Fluidbox.Sheet. */
export function useFluidboxSheet(): FluidboxSheetApi {
  const context = useFluidboxContext();
  const { fluidbox } = context;
  const [stop, setStop] = createSignal(0);
  // A sheet that loads or goes changes the stop too.
  createEffect(() => {
    context.state();
    setStop(fluidbox.sheet?.stop ?? 0);
  });
  const listener = (event: FluidboxSheetEvent) => setStop(event.stop);
  fluidbox.addEventListener("sheetchange", listener);
  onCleanup(() => fluidbox.removeEventListener("sheetchange", listener));
  return {
    stop,
    set: (next, options) => fluidbox.sheet?.set(next, options),
  };
}

export const Fluidbox: FluidboxSolidParts = {
  Root,
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
  FrameLayer,
};
