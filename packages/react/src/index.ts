/** The React binding: the `Fluidbox` parts and the `useFluidbox` and `useFluidboxSheet` hooks. */
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
  CSSProperties,
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
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxLabels,
  type FluidboxOriginAdapter,
  type FluidboxRenderer,
  type FluidboxState,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createSlots,
  createTrigger,
  defaultLabels,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  frameLayerOf,
  latestOrigins,
  resolveLabels,
  createFluidboxSync,
  targetKeys,
  unloadFluidbox,
  watchFluidbox,
  type FluidboxSlot,
  type FluidboxSlots,
  type FluidboxTrigger,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxActionProps,
  FluidboxApi,
  FluidboxCommands,
  FluidboxFilmstripProps,
  FluidboxFrameLayerProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxViewerProps,
} from "./types";

export type {
  FluidboxActionProps,
  FluidboxApi,
  FluidboxCommands,
  FluidboxFilmstripProps,
  FluidboxFrameLayerProps,
  FluidboxItemContext,
  FluidboxReactRenderContext,
  FluidboxReactRenderer,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetStopProps,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxViewerProps,
  UseFluidbox,
} from "./types";
export type { FluidboxChangeDetails, FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";
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
  FluidboxLoading,
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

/** Content the runtime asked for, rendered through a portal so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly node: ReactNode;
}

/** What the Filmstrip and Sheet parts ask of the viewer. Their presence turns each on. */
interface Addons {
  filmstrip: { readonly custom: boolean } | null;
  sheet: Pick<FluidboxSheetProps, "snapPoints" | "dismiss"> | null;
}

interface FluidboxContextValue {
  readonly fluidbox: FluidboxInstance<any>;
  readonly commands: FluidboxCommands<any>;
  readonly items: FluidboxRootProps<any>["items"];
  readonly labels: FluidboxLabels;
  readonly viewerTarget: HTMLElement | null;
  readonly filmstripSlots: FluidboxSlots<any>;
  readonly sheetSlots: FluidboxSlots<any>;
  /** Render a node into a runtime target until the returned function runs. */
  readonly mount: (target: HTMLElement, node: ReactNode) => () => void;
  readonly setAddon: <K extends keyof Addons>(name: K, value: Addons[K]) => void;
  readonly addViewer: () => () => void;
}

const FluidboxContext = createContext<FluidboxContextValue | null>(null);
/** The item keys of the enclosing Trigger: its target first, then its returns. */
const TriggerContext = createContext<readonly (number | string)[] | null>(null);
/** Lets a FrameLayer tell its ThumbnailOverlay it is there. */
const OverlayContext = createContext<((layer: HTMLElement | null) => void) | null>(null);
/** True inside the live copy a travelling overlay renders into the flying frame. */
const TravelContext = createContext(false);

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

const eventProps = {
  beforetoggle: "onBeforeToggle",
  toggle: "onToggle",
  beforeitemchange: "onBeforeItemChange",
  itemchange: "onItemChange",
  settle: "onSettle",
  sheetchange: "onSheetChange",
} as const satisfies Record<(typeof fluidboxEventTypes)[number], keyof FluidboxRootProps>;

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): ReactElement {
  const { items, open, index, labels, zoom, loop, loading, children } = props;
  const slotsRef = useRef<{ filmstrip: FluidboxSlots<TItem>; sheet: FluidboxSlots<TItem> } | null>(
    null,
  );
  slotsRef.current ??= { filmstrip: createSlots(), sheet: createSlots() };
  const slots = slotsRef.current;
  const latest = useLatest(props);
  const [viewerTarget, setViewerTarget] = useState<HTMLElement | null>(null);
  const [mounts, setMounts] = useState<readonly Mount[]>([]);
  const nextKey = useRef(0);

  const renderViewer = useCallback<FluidboxViewerRenderer<TItem>>(({ target }) => {
    setViewerTarget(target);
    return () => setViewerTarget((current) => (current === target ? null : current));
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

  const labelOptions = (): Partial<FluidboxLabels> => ({
    ...latest.current.labels,
    position: (index, count) =>
      (latest.current.labels?.position ?? defaultLabels.position)(index, count),
  });
  const zoomOption = (): FluidboxRootProps<TItem>["zoom"] => {
    const { zoom } = latest.current;
    return zoom === false ? false : zoom ? { ...zoom } : undefined;
  };

  // The fluidbox exists from the first render, so parts bind to it as they
  // render. It touches nothing until a viewer is pressed or opened.
  const fluidboxRef = useRef<FluidboxInstance<TItem> | null>(null);
  fluidboxRef.current ??= createFluidbox<TItem>({
    items,
    labels: labelOptions(),
    zoom: zoomOption(),
    loop,
    loading,
    // Renderers are looked up by name when an item renders, so the newest
    // render function is used without telling the viewer.
    renderers: new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
      get(_, key) {
        const render = typeof key === "string" ? latest.current.renderers?.[key] : undefined;
        if (!render) return undefined;
        const renderer: FluidboxRenderer<TItem> = ({ item, index, target, signal }) =>
          mount(target, render({ item, index, signal }));
        return renderer;
      },
      has: (_, key) => typeof key === "string" && !!latest.current.renderers?.[key],
    }),
    // latestOrigins is not generic; the adapter only ever sees this Root's items.
    origins: latestOrigins(
      () => latest.current.origins as FluidboxOriginAdapter | undefined,
    ) as FluidboxOriginAdapter<TItem>,
  });
  const fluidbox = fluidboxRef.current;
  // An unmount, or StrictMode's rehearsal of one, drops the viewer; the next open makes another.
  useIsomorphicLayoutEffect(() => () => unloadFluidbox(fluidbox), [fluidbox]);

  // The Viewer, Filmstrip and Sheet parts register in their layout effects.
  // Changes go to the viewer once the commit is done.
  const addons = useRef<Addons>({ filmstrip: null, sheet: null });
  const viewers = useRef(0);
  const scheduled = useRef(false);
  const schedule = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    // A part that unmounts and mounts again within one commit changes nothing.
    queueMicrotask(() => {
      scheduled.current = false;
      const { filmstrip, sheet } = addons.current;
      fluidbox.update({
        viewer: viewers.current > 0 ? renderViewer : undefined,
        filmstrip: filmstrip
          ? filmstrip.custom
            ? { render: slots.filmstrip.render }
            : true
          : undefined,
        sheet: sheet
          ? { render: slots.sheet.render, snapPoints: sheet.snapPoints, dismiss: sheet.dismiss }
          : undefined,
      });
    });
  }, [fluidbox, renderViewer, slots]);
  const setAddon = useCallback(
    <K extends keyof Addons>(name: K, value: Addons[K]) => {
      addons.current = { ...addons.current, [name]: value };
      schedule();
    },
    [schedule],
  );
  const addViewer = useCallback(() => {
    viewers.current += 1;
    schedule();
    return () => {
      viewers.current -= 1;
      schedule();
    };
  }, [schedule]);

  // Strings are compared by value, so an inline labels object changes nothing.
  const labelsKey = JSON.stringify(labels ?? {});
  const zoomKey = zoom === false ? "off" : `${zoom?.step ?? ""}:${zoom?.max ?? ""}`;
  const first = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (first.current) first.current = false;
    else fluidbox.update({ labels: labelOptions(), zoom: zoomOption(), loop, loading });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidbox, labelsKey, zoomKey, loop, loading]);

  useIsomorphicLayoutEffect(() => {
    const events = new AbortController();
    for (const type of fluidboxEventTypes) {
      fluidbox.addEventListener(
        type,
        (event) => {
          const handler = latest.current[eventProps[type]] as ((event: Event) => void) | undefined;
          handler?.(event);
        },
        { signal: events.signal },
      );
    }
    watchFluidbox(
      fluidbox,
      {
        open: (open, details) => latest.current.onOpenChange?.(open, details),
        index: (index, details) => latest.current.onIndexChange?.(index, details),
      },
      events.signal,
    );
    return () => events.abort();
  }, [fluidbox, latest]);

  // Your open and index win whenever they change. The triggers have
  // registered by now, so an open flies from the item's own.
  // A remount, StrictMode's included, starts afresh, as the viewer it dropped did.
  const sync = useRef<ReturnType<typeof createFluidboxSync>>(null);
  useIsomorphicLayoutEffect(() => () => void (sync.current = null), [fluidbox]);
  useIsomorphicLayoutEffect(() => {
    sync.current ??= createFluidboxSync(fluidbox);
    sync.current(open, index);
  }, [fluidbox, open, index]);

  const lastItems = useRef(items);
  useIsomorphicLayoutEffect(() => {
    if (lastItems.current === items) return;
    lastItems.current = items;
    void fluidbox.setItems(items);
  }, [items, fluidbox]);

  const commands = useMemo<FluidboxCommands<TItem>>(
    () => ({
      open: (target, options) => fluidbox.open(target, options),
      close: (options) => fluidbox.close(options),
      next: (options) => fluidbox.next(options),
      previous: (options) => fluidbox.previous(options),
      setItems: (next) => fluidbox.setItems(next),
      preload: (target) => fluidbox.preload(target),
      load: () => fluidbox.load(),
    }),
    [fluidbox],
  );

  const resolvedLabels = useMemo(
    () => resolveLabels(labels),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [labelsKey],
  );
  const value = useMemo<FluidboxContextValue>(
    () => ({
      fluidbox,
      commands,
      items,
      labels: resolvedLabels,
      viewerTarget,
      filmstripSlots: slots.filmstrip,
      sheetSlots: slots.sheet,
      mount,
      setAddon,
      addViewer,
    }),
    [fluidbox, commands, items, resolvedLabels, viewerTarget, slots, mount, setAddon, addViewer],
  );
  return createElement(
    FluidboxContext.Provider,
    { value },
    children,
    mounts.map(({ key, target, node }) => createPortal(node, target, String(key))),
  );
}

type ChildHandler<E> = ((event: E) => void) | undefined;

function Trigger<TItem extends FluidboxItem>({
  asChild = false,
  item,
  returns,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...attributes
}: FluidboxTriggerProps<TItem>): ReactElement {
  const context = useFluidboxContext();
  if (item === null || item === undefined) {
    throw new Error("<Fluidbox.Trigger> needs an item: the item, its id or its index.");
  }
  // Its target first; the rest close back onto it. Compared by value.
  const keysKey = JSON.stringify(targetKeys(item, returns));
  const keys = useMemo(() => JSON.parse(keysKey) as (number | string)[], [keysKey]);
  const followsSelection = typeof children === "function";
  // Only a trigger whose children follow the selection re-renders with the viewer.
  const state = useFluidbox((current) => (followsSelection ? current : null));
  const [, rerender] = useState(0);
  const options = {
    target: item,
    returns,
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
    { value: keys },
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

const noSlots: readonly never[] = [];

/** The slots on show, re-rendering as they change. */
function useSlots<TItem extends FluidboxItem>(
  slots: FluidboxSlots<TItem>,
): readonly FluidboxSlot<TItem>[] {
  return useSyncExternalStore(
    slots.subscribe,
    () => slots.slots,
    () => noSlots,
  );
}

/** A React key per slot, so content for a new slot mounts fresh. */
const slotKeys = new WeakMap<FluidboxSlot<any>, string>();
let lastSlotKey = 0;
const slotKey = (slot: FluidboxSlot<any>) => {
  let key = slotKeys.get(slot);
  if (!key) slotKeys.set(slot, (key = String(++lastSlotKey)));
  return key;
};

/**
 * Turns the filmstrip on. With a render child, renders each thumbnail into its
 * button through a portal.
 */
function Filmstrip<TItem extends FluidboxItem>({
  children,
}: FluidboxFilmstripProps<TItem>): ReactElement | null {
  const { setAddon, filmstripSlots } = useFluidboxContext();
  const custom = children !== undefined;
  useIsomorphicLayoutEffect(() => {
    setAddon("filmstrip", { custom });
    return () => setAddon("filmstrip", null);
  }, [setAddon, custom]);
  const current = useSlots(filmstripSlots as FluidboxSlots<TItem>);
  if (!children) return null;
  return createElement(
    Fragment,
    null,
    current.map((slot) =>
      createPortal(children({ item: slot.item, index: slot.index }), slot.target, slotKey(slot)),
    ),
  );
}

type SheetAttributes = Omit<FluidboxSheetProps, "snapPoints" | "dismiss" | "children">;

/**
 * Turns the sheet on. The viewer's `<section data-fluidbox-sheet>` is the
 * sheet: it gets this part's attributes, and the render child draws its
 * content for the item on show.
 */
function Sheet<TItem extends FluidboxItem>({
  snapPoints,
  dismiss,
  children,
  ...attributes
}: FluidboxSheetProps<TItem>): ReactElement {
  const { setAddon, sheetSlots } = useFluidboxContext();
  const pointsKey = JSON.stringify(snapPoints ?? null);
  useIsomorphicLayoutEffect(() => {
    setAddon("sheet", { snapPoints, dismiss });
    return () => setAddon("sheet", null);
    // snapPoints is compared by value, so an inline array changes nothing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [setAddon, pointsKey, dismiss]);
  const current = useSlots(sheetSlots as FluidboxSlots<TItem>);
  return createElement(
    Fragment,
    null,
    current.map((slot) =>
      createElement(SheetContent<TItem>, {
        key: slotKey(slot),
        slot,
        attributes,
        render: children,
      }),
    ),
  );
}

function SheetContent<TItem extends FluidboxItem>({
  slot,
  attributes,
  render,
}: {
  readonly slot: FluidboxSlot<TItem>;
  readonly attributes: SheetAttributes;
  readonly render: FluidboxSheetProps<TItem>["children"];
}): ReactElement {
  const attributesKey = JSON.stringify(attributes);
  useIsomorphicLayoutEffect(
    () => applyAttributes(slot.container, attributes),
    // attributes are compared by value, so an inline style object changes nothing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [slot.container, attributesKey],
  );
  return createPortal(render?.({ item: slot.item, index: slot.index }) ?? null, slot.target);
}

/** CSS properties React writes without a unit when given a number. */
const unitless = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "zIndex",
  "zoom",
]);

/**
 * Set a part's attributes on an element the viewer made, as React would, and
 * return a function that puts back what was there.
 */
function applyAttributes(element: HTMLElement, attributes: SheetAttributes): () => void {
  const restores: (() => void)[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    if (key === "className") {
      const added = String(value)
        .split(/\s+/)
        .filter((name) => name && !element.classList.contains(name));
      element.classList.add(...added);
      restores.push(() => element.classList.remove(...added));
    } else if (key === "style") {
      for (const [property, raw] of Object.entries(value as CSSProperties)) {
        if (raw === undefined || raw === null || raw === "") continue;
        const name = property.startsWith("--")
          ? property
          : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        const css =
          typeof raw === "number" &&
          raw !== 0 &&
          !property.startsWith("--") &&
          !unitless.has(property)
            ? `${raw}px`
            : String(raw);
        const before = element.style.getPropertyValue(name);
        const priority = element.style.getPropertyPriority(name);
        element.style.setProperty(name, css);
        restores.push(() => element.style.setProperty(name, before, priority));
      }
    } else {
      const name = key === "htmlFor" ? "for" : key;
      // aria-* and data-* write booleans as text; other attributes are there or not.
      const text = /^(aria|data)-/.test(name)
        ? String(value)
        : value === true
          ? ""
          : value === false
            ? null
            : String(value);
      if (text === null) continue;
      const before = element.getAttribute(name);
      element.setAttribute(name, text);
      restores.push(() =>
        before === null ? element.removeAttribute(name) : element.setAttribute(name, before),
      );
    }
  }
  return () => {
    for (const restore of restores.reverse()) restore();
  };
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
 * A badge or caption on a trigger: it gets `--fluidbox-closed` and
 * `data-fluidbox-phase` as the viewer opens and closes, and with `travel` it
 * flies with the photo, its children rendered live in the flying frame.
 */
const ThumbnailOverlay = forwardRef<HTMLSpanElement, FluidboxThumbnailOverlayProps>(
  function ThumbnailOverlay({ travel = false, children, ...attributes }, forwardedRef) {
    const { fluidbox, mount, items } = useFluidboxContext();
    const keys = useContext(TriggerContext);
    if (!keys) {
      throw new Error("<Fluidbox.ThumbnailOverlay> must be inside a <Fluidbox.Trigger>.");
    }
    const latestChildren = useLatest(children);
    const [element, setElement] = useState<HTMLSpanElement | null>(null);
    // A FrameLayer inside says it is there, so the binding picks it up.
    const [layer, setLayer] = useState<HTMLElement | null>(null);
    useEffect(() => {
      if (!element) return;
      const [target, ...returns] = keys;
      return fluidbox.bindOverlay(element, target!, {
        returns,
        travel: travel
          ? ({ target: frame }) =>
              mount(
                frame,
                createElement(TravelContext.Provider, { value: true }, latestChildren.current),
              )
          : false,
        frameLayer: travel ? frameLayerOf(element) : undefined,
      });
    }, [element, travel, keys, fluidbox, items, mount, latestChildren, layer]);
    const latestRef = useLatest(forwardedRef);
    const ref = useCallback(
      (next: HTMLSpanElement | null) => {
        setForwardedRef(latestRef.current, next);
        setElement(next);
      },
      [latestRef],
    );
    return createElement(
      OverlayContext.Provider,
      { value: setLayer },
      createElement(
        "span",
        {
          ...attributes,
          ref,
          "data-fluidbox-thumbnail-overlay": travel ? "travel" : "",
        },
        children,
      ),
    );
  },
);

/**
 * Inside a travelling ThumbnailOverlay: an element moved into the flying frame
 * for the flight, scaling with it as a scrim does, and put back after.
 */
const FrameLayer = forwardRef<HTMLSpanElement, FluidboxFrameLayerProps>(function FrameLayer(
  { children, ...attributes },
  forwardedRef,
) {
  const register = useContext(OverlayContext);
  // The element itself flies, so the live copy in the frame leaves it out.
  const travelling = useContext(TravelContext);
  if (!register && !travelling) {
    throw new Error("<Fluidbox.FrameLayer> must be inside a <Fluidbox.ThumbnailOverlay>.");
  }
  const latestRef = useLatest(forwardedRef);
  const ref = useCallback(
    (next: HTMLSpanElement | null) => {
      setForwardedRef(latestRef.current, next);
      register?.(next);
    },
    [latestRef, register],
  );
  if (travelling) return null;
  return createElement(
    "span",
    {
      ...attributes,
      ref,
      "data-fluidbox-frame-layer": "",
    },
    children,
  );
});

/** The viewer state and its commands, or the part a selector picks, re-rendering as it changes. */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector: (value: FluidboxApi<TItem>) => TSelected,
): TSelected;
export function useFluidbox<TSelected>(
  selector?: (value: FluidboxApi) => TSelected,
): TSelected | FluidboxApi {
  const { fluidbox, commands } = useFluidboxContext();
  const subscribe = useCallback((listener: () => void) => fluidbox.subscribe(listener), [fluidbox]);
  // Select inside the snapshot, so a state change that leaves the selected value
  // alone doesn't re-render. Caching per state keeps a fresh object stable.
  const cache = useRef<{
    state: FluidboxState;
    value: FluidboxApi;
    selector: unknown;
    selected: unknown;
  } | null>(null);
  const read = () => {
    const state = fluidbox.state;
    const cached = cache.current;
    if (cached && cached.state === state && cached.selector === selector) return cached.selected;
    const value = cached && cached.state === state ? cached.value : { ...state, ...commands };
    const selected = selector ? selector(value) : value;
    cache.current = { state, value, selector, selected };
    return selected;
  };
  return useSyncExternalStore(subscribe, read, read) as TSelected | FluidboxApi;
}

/** The sheet's stop, re-rendering as `sheetchange` moves it, and a function that moves it. */
export function useFluidboxSheet(): FluidboxSheetApi {
  const { fluidbox } = useFluidboxContext();
  const subscribe = useCallback(
    (listener: () => void) => {
      const events = new AbortController();
      fluidbox.addEventListener("sheetchange", listener, { signal: events.signal });
      // A sheet that loads or goes changes the stop too.
      const release = fluidbox.subscribe(listener);
      return () => {
        events.abort();
        release();
      };
    },
    [fluidbox],
  );
  const stop = useSyncExternalStore(
    subscribe,
    () => fluidbox.sheet?.stop ?? 0,
    () => 0,
  );
  return useMemo(
    () => ({ stop, set: (next, options) => fluidbox.sheet?.set(next, options) }),
    [stop, fluidbox],
  );
}

export const Fluidbox = {
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

/** The type of `Fluidbox`. */
export type FluidboxReactParts = typeof Fluidbox;

function setForwardedRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
