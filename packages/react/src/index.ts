import {
  Children,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  createFluidbox,
  type Fluidbox as FluidboxInstance,
  type FluidboxChangeEvent,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxLabels,
  type FluidboxRenderer,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createDeferredFluidbox,
  createTrigger,
  defaultLabels,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  idOf,
  latestOrigins,
  loadAddons,
  resolveLabels,
  type DeferredFluidbox,
  type FluidboxTrigger,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxActionProps,
  FluidboxCommands,
  FluidboxFilmstripProps,
  FluidboxItemProps,
  FluidboxRootProps,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxSheetValue,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxValue,
  FluidboxViewerProps,
} from "./types";

export type {
  FluidboxActionProps,
  FluidboxCommands,
  FluidboxFilmstripProps,
  FluidboxFilmstripRenderContext,
  FluidboxItemProps,
  FluidboxReactRenderContext,
  FluidboxReactRenderer,
  FluidboxRootProps,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxSheetValue,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxTriggerRenderContext,
  FluidboxValue,
  FluidboxViewerProps,
  UseFluidbox,
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

/** Content the runtime asked for, rendered through a portal so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly node: ReactNode;
}

/** What the Filmstrip and Sheet parts ask of the viewer. Their presence turns each on. */
interface Addons {
  filmstrip: { readonly slots: boolean } | null;
  sheet: Pick<FluidboxSheetProps, "snapPoints" | "dismiss"> | null;
}

interface FluidboxContextValue {
  readonly deferred: DeferredFluidbox<any>;
  readonly fluidbox: FluidboxInstance<any>;
  readonly commands: FluidboxCommands<any>;
  readonly items: FluidboxRootProps<any>["items"];
  readonly labels: FluidboxLabels;
  readonly viewerTarget: HTMLElement | null;
  /** Render a node into a runtime target until the returned function runs. */
  readonly mount: (target: HTMLElement, node: ReactNode) => () => void;
  readonly setAddon: <K extends keyof Addons>(name: K, value: Addons[K]) => void;
  readonly addViewer: () => () => void;
}

const FluidboxContext = createContext<FluidboxContextValue | null>(null);
const ItemContext = createContext<FluidboxTarget | null>(null);
const TriggerContext = createContext<readonly FluidboxTarget[] | null>(null);

function useFluidboxContext(): FluidboxContextValue {
  const value = useContext(FluidboxContext);
  if (!value) throw new Error("Fluidbox parts must be rendered inside <Fluidbox.Root>.");
  return value;
}

/** useLayoutEffect in the browser; useEffect on the server, where it does nothing but warn. */
const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/** Keep the latest value in a ref, for callbacks the runtime holds on to. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

const toTarget = (value: FluidboxItem | FluidboxTarget): FluidboxTarget =>
  typeof value === "object" ? idOf(value) : value;

const eventProps = {
  beforetoggle: "onBeforeToggle",
  toggle: "onToggle",
  beforeitemchange: "onBeforeItemChange",
  itemchange: "onItemChange",
  settle: "onSettle",
} as const satisfies Record<(typeof fluidboxEventTypes)[number], keyof FluidboxRootProps>;

const addonKey = ({ filmstrip, sheet }: Addons) => JSON.stringify([filmstrip, sheet]);

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): ReactElement {
  const { items, labels, zoom, children } = props;
  const deferredRef = useRef<DeferredFluidbox<TItem> | null>(null);
  deferredRef.current ??= createDeferredFluidbox(items);
  const deferred = deferredRef.current;
  const latest = useLatest(props);
  const [viewerTarget, setViewerTarget] = useState<HTMLElement | null>(null);
  const [mounts, setMounts] = useState<readonly Mount[]>([]);
  const [viewers, setViewers] = useState(0);
  const nextKey = useRef(0);

  // Filmstrip and Sheet register in their layout effects, which run before
  // Root's, so the first viewer is built with them. A later change rebuilds it.
  const addons = useRef<Addons>({ filmstrip: null, sheet: null });
  const builtWith = useRef<string | null>(null);
  const [version, setVersion] = useState(0);
  const setAddon = useCallback(<K extends keyof Addons>(name: K, value: Addons[K]) => {
    addons.current = { ...addons.current, [name]: value };
    // Compare once the commit is done: a part that remounts within it, as one
    // inside the Viewer does when the viewer is rebuilt, changes nothing.
    queueMicrotask(() => {
      if (builtWith.current !== null && builtWith.current !== addonKey(addons.current)) {
        setVersion((current) => current + 1);
      }
    });
  }, []);
  const addViewer = useCallback(() => {
    setViewers((count) => count + 1);
    return () => setViewers((count) => count - 1);
  }, []);

  const mount = useCallback((target: HTMLElement, node: ReactNode) => {
    // React removes portal content after a commit, when the runtime may already
    // have emptied the target, so each mount renders into a host of its own.
    const host = target.ownerDocument.createElement("span");
    host.dataset.fluidboxMount = "";
    target.append(host);
    const entry: Mount = { key: nextKey.current++, target: host, node };
    setMounts((current) => [...current, entry]);
    return () => {
      setMounts((current) => current.filter((candidate) => candidate !== entry));
      host.remove();
    };
  }, []);

  const zoomKey = zoom === false ? "off" : `${zoom?.step ?? ""}:${zoom?.max ?? ""}`;
  // Strings rebuild the viewer when they change; `position` is read when used.
  const labelsKey = JSON.stringify(labels ?? {});

  useIsomorphicLayoutEffect(() => {
    const { zoom, labels } = latest.current;
    const { filmstrip, sheet } = addons.current;
    builtWith.current = addonKey(addons.current);
    // Renderers are looked up by name when an item renders, so the newest
    // render function is used without rebuilding the viewer.
    const renderers = new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
      get(_, key) {
        const render = typeof key === "string" ? latest.current.renderers?.[key] : undefined;
        if (!render) return undefined;
        const renderer: FluidboxRenderer<TItem> = ({ item, index, target, signal }) =>
          mount(target, render({ item, index, signal }));
        return renderer;
      },
      has: (_, key) => typeof key === "string" && !!latest.current.renderers?.[key],
    });
    const build = () =>
      createFluidbox<TItem>({
        items: deferred.fluidbox.items,
        labels: {
          ...labels,
          position: (index, count) =>
            (latest.current.labels?.position ?? defaultLabels.position)(index, count),
        },
        zoom: zoom === false ? false : zoom ? { ...zoom } : undefined,
        renderers,
        origins: latestOrigins(() => latest.current.origins),
        viewer({ target }) {
          setViewerTarget(target);
          return () => setViewerTarget((current) => (current === target ? null : current));
        },
        filmstrip: filmstrip ? (filmstrip.slots ? { slots: true } : true) : undefined,
        sheet: sheet ? { snapPoints: sheet.snapPoints, dismiss: sheet.dismiss } : undefined,
      });
    let fluidbox: FluidboxInstance<TItem> | undefined;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      fluidbox = build();
      deferred.attach(fluidbox);
    };
    // The filmstrip and sheet runtimes load on first use. Until they have,
    // triggers wait on the stand-in, as they do before the first effect.
    const loading = loadAddons([
      ...(filmstrip ? (["filmstrip"] as const) : []),
      ...(sheet ? (["sheet"] as const) : []),
    ]);
    if (loading) void loading.then(start);
    else start();
    return () => {
      cancelled = true;
      builtWith.current = null;
      if (!fluidbox) return;
      deferred.detach();
      fluidbox.destroy();
    };
    // zoom and labels are read through their keys, so inline objects don't rebuild the viewer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, mount, zoomKey, labelsKey, version]);

  // The stand-in forwards the viewer's events, across rebuilds.
  useIsomorphicLayoutEffect(() => {
    const events = new AbortController();
    for (const type of fluidboxEventTypes) {
      deferred.fluidbox.addEventListener(
        type,
        (event) => {
          const handler = latest.current[eventProps[type]] as
            | ((event: FluidboxToggleEvent | FluidboxChangeEvent<TItem>) => void)
            | undefined;
          handler?.(event as FluidboxToggleEvent | FluidboxChangeEvent<TItem>);
        },
        { signal: events.signal },
      );
    }
    return () => events.abort();
  }, [deferred, latest]);

  const lastItems = useRef(items);
  useIsomorphicLayoutEffect(() => {
    if (lastItems.current === items) return;
    lastItems.current = items;
    void deferred.fluidbox.setItems(items);
  }, [items, deferred]);

  const commands = useMemo<FluidboxCommands<TItem>>(() => {
    const { fluidbox } = deferred;
    return {
      open: (target, options) => fluidbox.open(target, options),
      close: (options) => fluidbox.close(options),
      next: (options) => fluidbox.next(options),
      previous: (options) => fluidbox.previous(options),
      setItems: (next) => fluidbox.setItems(next),
    };
  }, [deferred]);

  const resolvedLabels = useMemo(
    () => resolveLabels(labels),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [labelsKey],
  );
  const value = useMemo<FluidboxContextValue>(
    () => ({
      deferred,
      fluidbox: deferred.fluidbox,
      commands,
      items,
      labels: resolvedLabels,
      viewerTarget,
      mount,
      setAddon,
      addViewer,
    }),
    [deferred, commands, items, resolvedLabels, viewerTarget, mount, setAddon, addViewer],
  );
  return createElement(
    FluidboxContext.Provider,
    { value },
    children,
    // Without a Viewer, the viewer gets the default controls.
    viewerTarget && viewers === 0 ? createPortal(createElement(Controls), viewerTarget) : null,
    mounts.map(({ key, target, node }) => createPortal(node, target, String(key))),
  );
}

function Item<TItem extends FluidboxItem>({ item, children }: FluidboxItemProps<TItem>) {
  return createElement(ItemContext.Provider, { value: toTarget(item) }, children);
}

type ChildHandler<E> = ((event: E) => void) | undefined;

function Trigger<TItem extends FluidboxItem>({
  asChild = false,
  item,
  items,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...attributes
}: FluidboxTriggerProps<TItem>): ReactElement {
  const context = useFluidboxContext();
  const enclosing = useContext(ItemContext);
  const first = item ?? items?.[0] ?? enclosing;
  if (first === null || first === undefined) {
    throw new Error("<Fluidbox.Trigger> needs item, items, or an enclosing <Fluidbox.Item>.");
  }
  // The opened item comes first; the rest may return to this trigger on close.
  const targets = [...new Set([toTarget(first), ...(items?.map(toTarget) ?? [])])];
  const followsSelection = typeof children === "function";
  // Only a trigger whose children follow the selection re-renders with the viewer.
  const state = useFluidbox((current) => (followsSelection ? current : null));
  const [, rerender] = useState(0);
  const options = {
    targets,
    // The closing flight measures the trigger right after this, so render now.
    onPreviewChange: followsSelection
      ? () => flushSync(() => rerender((count) => count + 1))
      : undefined,
  };
  const triggerRef = useRef<FluidboxTrigger<TItem> | null>(null);
  triggerRef.current ??= createTrigger(context.fluidbox as FluidboxInstance<TItem>, options);
  const trigger = triggerRef.current;
  useIsomorphicLayoutEffect(() => trigger.update(options));
  // Indexes name other items after the items change.
  useEffect(() => trigger.refresh(), [trigger, context.items]);
  const elementRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // StrictMode destroys and sets up effects again without re-running refs.
    trigger.setElement(elementRef.current);
    return () => trigger.destroy();
  }, [trigger]);

  const rendered = followsSelection
    ? children(trigger.preview(state as FluidboxState<TItem>))
    : children;
  const only = asChild ? Children.only(rendered) : null;
  if (asChild && !isValidElement(only)) {
    throw new Error("<Fluidbox.Trigger asChild> needs one element child.");
  }
  const child = isValidElement(only) ? only : null;
  const childProps = isValidElement<Record<string, unknown>>(child) ? child.props : {};
  const childRef = child
    ? "ref" in childProps
      ? (childProps.ref as Ref<HTMLElement> | undefined)
      : (Object.getOwnPropertyDescriptor(child, "ref")?.value as Ref<HTMLElement> | undefined)
    : undefined;
  // A stable ref, so a re-render doesn't unregister and register the origin again.
  const childRefRef = useRef(childRef);
  childRefRef.current = childRef;
  const setRef = useCallback(
    (element: HTMLElement | null) => {
      setForwardedRef(childRefRef.current, element);
      elementRef.current = element;
      trigger.setElement(element);
    },
    [trigger],
  );
  const handlers = {
    ref: setRef,
    onClick(event: ReactMouseEvent<HTMLButtonElement>) {
      (childProps.onClick as ChildHandler<typeof event>)?.(event);
      onClick?.(event);
      trigger.click(event);
    },
    onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
      (childProps.onPointerDown as ChildHandler<typeof event>)?.(event);
      onPointerDown?.(event);
      trigger.pointerDown(event);
    },
    onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
      (childProps.onPointerUp as ChildHandler<typeof event>)?.(event);
      onPointerUp?.(event);
      trigger.pointerUp();
    },
    onPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
      (childProps.onPointerCancel as ChildHandler<typeof event>)?.(event);
      onPointerCancel?.(event);
      trigger.pointerCancel();
    },
  };

  return createElement(
    TriggerContext.Provider,
    { value: targets },
    child
      ? cloneElement(child, { ...attributes, ...handlers } as never)
      : createElement(
          "button",
          { ...attributes, ...handlers, type: attributes.type ?? "button" },
          rendered,
        ),
  );
}

/** Renders your controls and captions into the viewer. Without one, the viewer has the default controls. */
function Viewer({ children }: FluidboxViewerProps): ReactElement | null {
  const { viewerTarget, addViewer } = useFluidboxContext();
  useIsomorphicLayoutEffect(addViewer, [addViewer]);
  return viewerTarget ? createPortal(children, viewerTarget) : null;
}

function action(name: FluidboxControlName) {
  const control = fluidboxControls[name];
  return forwardRef<HTMLButtonElement, FluidboxActionProps>(function FluidboxAction(
    { children, onClick, ...attributes },
    ref,
  ) {
    const { fluidbox, labels } = useFluidboxContext();
    const disabled = useFluidbox(control.disabled);
    return createElement(
      "button",
      {
        ...attributes,
        ref,
        type: attributes.type ?? "button",
        disabled: attributes.disabled ?? disabled,
        [control.attribute]: "",
        "data-fluidbox-managed": "",
        "aria-label":
          attributes["aria-label"] ?? (children == null ? control.label(labels) : undefined),
        onClick(event: ReactMouseEvent<HTMLButtonElement>) {
          onClick?.(event);
          if (event.defaultPrevented) return;
          // Prevented, so the viewer's own handling of the attribute skips it.
          event.preventDefault();
          void control.run(fluidbox, event);
        },
      },
      children ?? defaultIcon(name),
    );
  });
}

function defaultIcon(name: FluidboxControlName) {
  const {
    "stroke-width": strokeWidth,
    "stroke-linecap": strokeLinecap,
    "stroke-linejoin": strokeLinejoin,
    ...attributes
  } = fluidboxControlIcon.attributes;
  return createElement(
    "svg",
    { ...attributes, strokeWidth, strokeLinecap, strokeLinejoin, "data-fluidbox-icon": "" },
    createElement("path", { d: fluidboxControlIcon.paths[name] }),
  );
}

const Close = action("close");
const Previous = action("previous");
const Next = action("next");
const parts = { previous: Previous, next: Next, close: Close };

/** The default Previous, Next and Close buttons, for a Viewer of your own. */
function Controls(): ReactElement {
  return createElement(
    Fragment,
    null,
    controlNames.map((name) => createElement(parts[name], { key: name })),
  );
}

/** Follow a handle of the attached fluidbox, as the sheet or the filmstrip, across rebuilds. */
function useHandle<THandle extends { subscribe(listener: () => void): () => void }, T>(
  pick: (fluidbox: FluidboxInstance<any>) => THandle | null,
  read: (handle: THandle | null) => T,
  server: T,
): T {
  const { deferred, fluidbox } = useFluidboxContext();
  const subscribe = useCallback(
    (listener: () => void) => {
      let handle = pick(fluidbox);
      let release = handle?.subscribe(listener);
      const stop = deferred.subscribe(() => {
        const next = pick(fluidbox);
        if (next === handle) return;
        release?.();
        handle = next;
        release = handle?.subscribe(listener);
        listener();
      });
      return () => {
        release?.();
        stop();
      };
    },
    // pick is a module-level function in every caller.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [deferred, fluidbox],
  );
  return useSyncExternalStore(
    subscribe,
    () => read(pick(fluidbox)),
    () => server,
  );
}

const pickFilmstrip = (fluidbox: FluidboxInstance<any>) => fluidbox.filmstrip;
const pickSheet = (fluidbox: FluidboxInstance<any>) => fluidbox.sheet;
const noSlots: readonly never[] = [];

/**
 * Turns the filmstrip on. With a render child, renders each thumbnail into its
 * button through a portal.
 */
function Filmstrip<TItem extends FluidboxItem>({
  children,
}: FluidboxFilmstripProps<TItem>): ReactElement | null {
  const { setAddon } = useFluidboxContext();
  const slots = children !== undefined;
  useIsomorphicLayoutEffect(() => {
    setAddon("filmstrip", { slots });
    return () => setAddon("filmstrip", null);
  }, [setAddon, slots]);
  const current = useHandle(pickFilmstrip, (handle) => handle?.slots ?? noSlots, noSlots);
  if (!children) return null;
  return createElement(
    Fragment,
    null,
    current.map(({ item, index, target }) =>
      createPortal(children({ item: item as TItem, index }), target, idOf(item)),
    ),
  );
}

/**
 * Turns the sheet on, and renders its content into the sheet's slot as an
 * element with `data-fluidbox-sheet`.
 */
function Sheet({ snapPoints, dismiss, children, ...attributes }: FluidboxSheetProps) {
  const { setAddon } = useFluidboxContext();
  const pointsKey = JSON.stringify(snapPoints ?? null);
  useIsomorphicLayoutEffect(() => {
    setAddon("sheet", { snapPoints, dismiss });
    return () => setAddon("sheet", null);
    // snapPoints is compared by value, so an inline array doesn't rebuild the viewer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [setAddon, pointsKey, dismiss]);
  const slot = useHandle(pickSheet, (handle) => handle?.slot ?? null, null);
  return slot
    ? createPortal(
        createElement("div", { ...attributes, "data-fluidbox-sheet": "" }, children),
        slot,
      )
    : null;
}

/** A button that moves the sheet to `stop`. */
const SheetStop = forwardRef<HTMLButtonElement, FluidboxSheetStopProps>(function SheetStop(
  { stop, ...attributes },
  ref,
) {
  return createElement("button", {
    ...attributes,
    ref,
    type: attributes.type ?? "button",
    "data-fluidbox-sheet-stop": String(stop),
  });
});

/**
 * A badge or caption on a trigger: it gets `--fluidbox-progress` and
 * `data-fluidbox-phase` as the viewer opens and closes, and with `travel` it
 * flies with the photo.
 */
const ThumbnailOverlay = forwardRef<HTMLSpanElement, FluidboxThumbnailOverlayProps>(
  function ThumbnailOverlay({ travel = false, children, ...attributes }, forwardedRef) {
    const { fluidbox, mount, items } = useFluidboxContext();
    const item = useContext(ItemContext);
    const triggerTargets = useContext(TriggerContext);
    const targets = triggerTargets ?? (item === null ? null : [item]);
    if (!targets) {
      throw new Error("<Fluidbox.ThumbnailOverlay> needs an enclosing Trigger or Item.");
    }
    const latestChildren = useLatest(children);
    const [element, setElement] = useState<HTMLSpanElement | null>(null);
    const targetsKey = JSON.stringify(targets);
    useEffect(() => {
      if (!element) return;
      return fluidbox.bindOverlay(element, JSON.parse(targetsKey) as FluidboxTarget[], {
        travel: travel ? ({ target }) => mount(target, latestChildren.current) : false,
      });
    }, [element, travel, targetsKey, fluidbox, items, mount, latestChildren]);
    return createElement(
      "span",
      {
        ...attributes,
        ref(next: HTMLSpanElement | null) {
          setForwardedRef(forwardedRef, next);
          setElement(next);
        },
        "data-fluidbox-thumbnail-overlay": travel ? "travel" : "",
      },
      children,
    );
  },
);

/** The viewer state and its commands, or the part a selector picks, re-rendering as it changes. */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxValue<TItem>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector: (value: FluidboxValue<TItem>) => TSelected,
): TSelected;
export function useFluidbox<TSelected>(
  selector?: (value: FluidboxValue) => TSelected,
): TSelected | FluidboxValue {
  const { deferred, commands } = useFluidboxContext();
  const subscribe = useCallback((listener: () => void) => deferred.subscribe(listener), [deferred]);
  // Select inside the snapshot, so a state change that leaves the selected value
  // alone doesn't re-render. Caching per state keeps a fresh object stable.
  const cache = useRef<{
    state: FluidboxState;
    value: FluidboxValue;
    selector: unknown;
    selected: unknown;
  } | null>(null);
  const read = () => {
    const state = deferred.fluidbox.state;
    const cached = cache.current;
    if (cached && cached.state === state && cached.selector === selector) return cached.selected;
    const value = cached && cached.state === state ? cached.value : { ...state, ...commands };
    const selected = selector ? selector(value) : value;
    cache.current = { state, value, selector, selected };
    return selected;
  };
  return useSyncExternalStore(subscribe, read, read) as TSelected | FluidboxValue;
}

/** The sheet's stop, re-rendering as it changes, and a function that moves it. */
export function useFluidboxSheet(): FluidboxSheetValue {
  const { fluidbox } = useFluidboxContext();
  const stop = useHandle(pickSheet, (handle) => handle?.stop ?? 0, 0);
  return useMemo(
    () => ({ stop, set: (next, options) => fluidbox.sheet?.set(next, options) }),
    [stop, fluidbox],
  );
}

export const Fluidbox = {
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

/** The type of `Fluidbox`. */
export type FluidboxReactParts = typeof Fluidbox;

function setForwardedRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
