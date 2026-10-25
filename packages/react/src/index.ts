/** The React binding: the `Fluidbox` parts and the `useFluidbox`, `useFluidboxSheet` and `useFluidboxSlide` hooks. */
import {
  Children,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  Fragment,
  isValidElement,
  Suspense,
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
  RefAttributes,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  createFluidbox,
  type Fluidbox as FluidboxInstance,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxLabels,
  type FluidboxSlide,
  type FluidboxSlideRenderer,
  type FluidboxSlides,
  type FluidboxState,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createFluidboxSync,
  createSlots,
  createTrigger,
  crossOrigin,
  defaultLabels,
  downloadLink,
  fluidboxControls,
  fluidboxStaticViewerNodes,
  holdSlideCommit,
  idOf,
  latestFindTrigger,
  resolveLabels,
  takeOverFluidbox,
  targetKeys,
  unloadFluidbox,
  watchFluidbox,
  zoomControlNames,
  type FluidboxSlot,
  type FluidboxSlots,
  type FluidboxStaticNode,
  type FluidboxTrigger,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxApi,
  FluidboxCaptionProps,
  FluidboxCommands,
  FluidboxControlProps,
  FluidboxCounterProps,
  FluidboxDownloadProps,
  FluidboxErrorProps,
  FluidboxGroupProps,
  FluidboxIframeProps,
  FluidboxImageProps,
  FluidboxLoadingProps,
  FluidboxMediaProps,
  FluidboxOverlayProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetSnapProps,
  FluidboxSlideApi,
  FluidboxSlideContent,
  FluidboxSlidesProps,
  FluidboxThumbnailsProps,
  FluidboxTriggerProps,
  FluidboxVideoProps,
  FluidboxViewerProps,
} from "./types";

export type {
  FluidboxApi,
  FluidboxCaptionProps,
  FluidboxCommands,
  FluidboxControlLabel,
  FluidboxControlProps,
  FluidboxCounterProps,
  FluidboxDownloadProps,
  FluidboxErrorProps,
  FluidboxGroupProps,
  FluidboxIframeProps,
  FluidboxImageProps,
  FluidboxItemContext,
  FluidboxLoadingProps,
  FluidboxMediaProps,
  FluidboxOverlayProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetSnapProps,
  FluidboxSlideApi,
  FluidboxSlideContent,
  FluidboxSlidesProps,
  FluidboxThumbnailContext,
  FluidboxThumbnailsProps,
  FluidboxTriggerProps,
  FluidboxVideoProps,
  FluidboxViewerProps,
  UseFluidbox,
} from "./types";
export type { FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";
export type {
  FluidboxCustomItemBase,
  FluidboxItemTypes,
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxItemList,
  FluidboxItemListOptions,
  FluidboxItems,
  FluidboxLabels,
  FluidboxMediaErrorEvent,
  FluidboxPreload,
  FluidboxReason,
  FluidboxSheetEvent,
  FluidboxSheetSnapPoint,
  FluidboxSlide,
  FluidboxSlideRenderer,
  FluidboxState,
  FluidboxStatus,
  FluidboxTarget,
  FluidboxValue,
  FluidboxValueChangeAction,
  FluidboxValueChangeDetails,
  FluidboxValueChangeEvent,
  FluidboxVideoItem,
  FluidboxZoomCommandOptions,
  FluidboxZoomEvent,
  FluidboxZoomPose,
  FluidboxZoomState,
} from "@ogdakke/fluidbox";

/** Content the runtime asked for, rendered through a portal so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly node: ReactNode;
}

/**
 * A value parts read with useSyncExternalStore. React renders a store's change
 * before the next paint, so a slide that opens shows its content from the
 * opening's first frame.
 */
function createStore<T>(value: T) {
  const listeners = new Set<() => void>();
  return {
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    read: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
type Store<T> = ReturnType<typeof createStore<T>>;

/** The Slides part's props, by item type. */
type SlideContents = Readonly<Record<string, FluidboxSlideContent<any> | undefined>>;

/** What the Thumbnails and Sheet parts ask of the viewer. Their presence turns each on. */
interface Addons {
  thumbnails: { readonly custom: boolean } | null;
  sheet: Pick<FluidboxSheetProps, "snapPoints" | "dismissMotion"> | null;
}

interface FluidboxContextValue {
  readonly fluidbox: FluidboxInstance<any>;
  readonly commands: FluidboxCommands<any>;
  readonly items: FluidboxRootProps<any>["items"];
  readonly labels: FluidboxLabels;
  readonly viewerTarget: HTMLElement | null;
  readonly thumbnailsSlots: FluidboxSlots<any>;
  readonly sheetSlots: FluidboxSlots<any>;
  /** The Slides part's props, which the slides read as they render. */
  readonly slides: Store<SlideContents | null>;
  /** Render a node into a runtime target until the returned function runs. */
  readonly mount: (target: HTMLElement, node: ReactNode) => () => void;
  readonly setAddon: <K extends keyof Addons>(name: K, value: Addons[K]) => void;
  readonly addViewer: () => () => void;
  /** What the server's copy of an open viewer needs to know, set as the parts render. */
  readonly serverHints: ServerHints;
}

interface ServerHints {
  thumbnails: boolean;
  sheet: boolean;
  viewer: boolean;
}

/** The slide a part renders in, and whether it is on show. */
interface SlideContextValue {
  readonly slide: FluidboxSlide<any>;
  readonly active: boolean;
}

const FluidboxContext = createContext<FluidboxContextValue | null>(null);
const SlideContext = createContext<SlideContextValue | null>(null);
/** The item keys of the enclosing Trigger. */
const TriggerContext = createContext<readonly (number | string)[] | null>(null);
/** True inside the live copy an overlay renders into the flying frame. */
const TravelContext = createContext(false);

function useFluidboxContext(): FluidboxContextValue {
  const value = useContext(FluidboxContext);
  if (!value)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "Fluidbox parts must be rendered inside <Fluidbox.Root>.";
        } catch {}
        return "fluidbox";
      })(),
    );
  return value;
}

function useSlideContext(part: string): SlideContextValue {
  const value = useContext(SlideContext);
  if (!value)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return `<Fluidbox.${part}> must be inside a slide, in <Fluidbox.Slides>.`;
        } catch {}
        return "fluidbox";
      })(),
    );
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

/** A `display: contents` element for a portal, made once. */
function useHost(): HTMLElement | null {
  const [host] = useState(() => {
    if (typeof document === "undefined") return null;
    const element = document.createElement("span");
    element.dataset.fluidboxMount = "";
    return element;
  });
  return host;
}

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): ReactElement {
  const { items, value, defaultValue, labels, zoom, loop, preload, dismiss, wheel, href } = props;
  const { slideshow } = props;
  const slotsRef = useRef<{
    thumbnails: FluidboxSlots<TItem>;
    sheet: FluidboxSlots<TItem>;
    slides: Store<SlideContents | null>;
    mounts: Store<readonly Mount[]>;
  } | null>(null);
  slotsRef.current ??= {
    thumbnails: createSlots(),
    sheet: createSlots(),
    slides: createStore<SlideContents | null>(null),
    mounts: createStore<readonly Mount[]>([]),
  };
  const slots = slotsRef.current;
  const mountStore = slots.mounts;
  const serverHints = useRef<ServerHints>({
    thumbnails: false,
    sheet: false,
    viewer: false,
  }).current;
  const latest = useLatest(props);
  const [viewerTarget, setViewerTarget] = useState<HTMLElement | null>(null);
  const shownViewerTarget = useRef<HTMLElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    shownViewerTarget.current = viewerTarget;
  }, [viewerTarget]);
  const mounts = useSyncExternalStore(mountStore.subscribe, mountStore.read, mountStore.read);
  const nextKey = useRef(0);

  const renderViewer = useCallback<FluidboxViewerRenderer<TItem>>(({ target }) => {
    // A viewer made by the open it serves measures its layer right after this,
    // and the content can change the layer's insets and theme, so render it now.
    // A redraw into the target already shown, as a label change makes from a
    // layout effect, where React can't flush, has nothing new to render.
    if (target === shownViewerTarget.current) setViewerTarget(target);
    else flushSync(() => setViewerTarget(target));
    return () => setViewerTarget((current) => (current === target ? null : current));
  }, []);

  const mount = useCallback(
    (target: HTMLElement, node: ReactNode) => {
      // React removes portal content after a commit, when the runtime may already
      // have emptied the target, so each mount renders into a host of its own.
      const host = target.ownerDocument.createElement("span");
      host.dataset.fluidboxMount = "";
      target.append(host);
      const entry: Mount = { key: nextKey.current++, target: host, node };
      mountStore.set([...mountStore.read(), entry]);
      return () => {
        mountStore.set(mountStore.read().filter((candidate) => candidate !== entry));
        host.remove();
      };
    },
    [mountStore],
  );

  const labelOptions = (): Partial<FluidboxLabels> => ({
    ...latest.current.labels,
    position: (index, count) =>
      (latest.current.labels?.position ?? defaultLabels.position)(index, count),
  });
  const zoomOption = (): FluidboxRootProps<TItem>["zoom"] => {
    const { zoom } = latest.current;
    return zoom === false ? false : zoom ? { ...zoom } : undefined;
  };
  const dismissOption = () => {
    const { dismiss } = latest.current;
    return dismiss && { ...dismiss };
  };

  // The fluidbox exists from the first render, so parts bind to it as they
  // render. It touches nothing until a viewer is pressed or opened.
  const fluidboxRef = useRef<FluidboxInstance<TItem> | null>(null);
  // findTrigger and revealTrigger are read from the newest props on each use.
  fluidboxRef.current ??= createFluidbox<TItem>(
    latestFindTrigger(
      {
        items,
        labels: labelOptions(),
        zoom: zoomOption(),
        loop,
        preload,
        dismiss: dismissOption(),
        wheel,
        slideshow,
        // Share shares the item's href unless shareUrl says otherwise.
        shareUrl: (item) => {
          const { shareUrl, href } = latest.current;
          return shareUrl ? shareUrl(item) : href?.(idOf(item));
        },
        // Slides are looked up by type as one mounts, so the Slides part's
        // newest props are used without telling the viewer.
        slides: new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
          get(_, key) {
            if (typeof key !== "string" || !slots.slides.read()?.[key]) return undefined;
            const renderer: FluidboxSlideRenderer<TItem> = (slide) => {
              // The open waits until the slide host reports its commit.
              const release = holdSlideCommit(slide);
              const unmount = mount(
                slide.layer,
                createElement(SlideHost, { slide, type: key, release }),
              );
              return () => {
                release();
                unmount();
              };
            };
            return renderer;
          },
          has: (_, key) => typeof key === "string" && !!slots.slides.read()?.[key],
        }) as FluidboxSlides<TItem>,
      },
      () => latest.current,
    ),
  );
  const fluidbox = fluidboxRef.current;

  // The Viewer, Thumbnails and Sheet parts register in their layout effects.
  // Changes go to the viewer once the commit is done.
  const addons = useRef<Addons>({ thumbnails: null, sheet: null });
  const viewers = useRef(0);
  const scheduled = useRef(false);
  const schedule = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    // A part that unmounts and mounts again within one commit changes nothing.
    queueMicrotask(() => {
      scheduled.current = false;
      const { thumbnails, sheet } = addons.current;
      fluidbox.update({
        viewer: viewers.current > 0 ? renderViewer : undefined,
        thumbnails: thumbnails
          ? thumbnails.custom
            ? { render: slots.thumbnails.render }
            : true
          : undefined,
        sheet: sheet
          ? {
              render: slots.sheet.render,
              snapPoints: sheet.snapPoints,
              dismissMotion: sheet.dismissMotion,
            }
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

  // Objects are compared by value, so inline labels, zoom or dismiss change nothing.
  const labelsKey = JSON.stringify(labels ?? {});
  const zoomKey =
    zoom === false ? "off" : [zoom?.step, zoom?.max, zoom?.click, zoom?.tap].join(":");
  const dismissKey = JSON.stringify(dismiss ?? null);
  const slideshowKey = JSON.stringify(slideshow ?? null);
  const first = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (first.current) first.current = false;
    else
      fluidbox.update({
        labels: labelOptions(),
        zoom: zoomOption(),
        loop,
        preload,
        dismiss: dismissOption(),
        wheel,
        slideshow: latest.current.slideshow,
      });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidbox, labelsKey, zoomKey, dismissKey, slideshowKey, loop, preload, wheel]);

  useIsomorphicLayoutEffect(() => {
    const events = new AbortController();
    const { signal } = events;
    fluidbox.addEventListener("zoomchange", (event) => latest.current.onZoomChange?.(event), {
      signal,
    });
    fluidbox.addEventListener("mediaerror", (event) => latest.current.onMediaError?.(event), {
      signal,
    });
    watchFluidbox(
      fluidbox,
      {
        value: (value, details) => latest.current.onValueChange?.(value, details),
        complete: (value, details) => latest.current.onValueChangeComplete?.(value, details),
      },
      signal,
    );
    return () => events.abort();
  }, [fluidbox, latest]);

  // An unmount, or StrictMode's rehearsal of one, drops the viewer; the next
  // open makes another. React runs cleanups in order, so the events above
  // stop first and the drop never reaches onValueChange as a close.
  useIsomorphicLayoutEffect(() => () => unloadFluidbox(fluidbox), [fluidbox]);

  // Your value wins whenever it changes. The triggers have registered by now,
  // so an open flies from the item's own. A remount, StrictMode's included,
  // starts afresh, as the viewer it dropped did. A Root that renders open on
  // an image draws the viewer's copy on its first render, so the server's HTML
  // shows the photo, and the viewer takes it over.
  const initial = value !== undefined ? value : (defaultValue ?? null);
  const serverIndex = useRef<number | null | undefined>(undefined);
  if (serverIndex.current === undefined) {
    const list = Array.isArray(items) ? (items as readonly TItem[]) : [];
    const index = initial === null ? -1 : list.findIndex((item) => idOf(item) === initial);
    serverIndex.current = list[index]?.type === "image" ? index : null;
  }
  const [takenOver, setTakenOver] = useState(false);
  const serverViewer = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);
  const sync = useRef<ReturnType<typeof createFluidboxSync>>(null);
  useIsomorphicLayoutEffect(() => () => void (sync.current = null), [fluidbox]);
  useIsomorphicLayoutEffect(() => {
    const starting = !sync.current;
    sync.current ??= createFluidboxSync(fluidbox);
    const copy = serverViewer.current;
    const taken = serverIndex.current;
    if (starting && copy && taken != null) {
      const current = ++attempt.current;
      const done = () => {
        if (attempt.current === current) setTakenOver(true);
      };
      void takeOverFluidbox(fluidbox, copy, idOf((items as readonly TItem[])[taken]!)).then(
        done,
        done,
      );
      return;
    }
    // The default value opens once, as the Root mounts.
    sync.current(starting && value === undefined ? (defaultValue ?? undefined) : value);
  }, [fluidbox, value]);

  // The fluidbox ignores an array of items equal to its own, so a fresh array
  // each render costs nothing. Only the first render's items are skipped: the
  // fluidbox was made with them, and a lazy list always applies.
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
      zoomTo: (scale, options) => fluidbox.zoomTo(scale, options),
      zoomIn: (options) => fluidbox.zoomIn(options),
      zoomOut: (options) => fluidbox.zoomOut(options),
      zoomReset: (options) => fluidbox.zoomReset(options),
      setFullscreen: (on) => fluidbox.setFullscreen(on),
      download: () => fluidbox.download(),
      share: () => fluidbox.share(),
      play: () => fluidbox.play(),
      pause: () => fluidbox.pause(),
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
  const context = useMemo<FluidboxContextValue>(
    () => ({
      fluidbox,
      commands,
      items,
      labels: resolvedLabels,
      viewerTarget,
      thumbnailsSlots: slots.thumbnails,
      sheetSlots: slots.sheet,
      slides: slots.slides,
      mount,
      setAddon,
      addViewer,
      serverHints,
    }),
    [
      fluidbox,
      commands,
      items,
      resolvedLabels,
      viewerTarget,
      slots,
      mount,
      setAddon,
      addViewer,
      serverHints,
    ],
  );
  return createElement(
    FluidboxContext.Provider,
    { value: context },
    props.children,
    serverIndex.current != null && !takenOver
      ? createElement(ServerViewer, {
          viewerRef: serverViewer,
          items: items as readonly FluidboxItem[],
          index: serverIndex.current,
          labels: resolvedLabels,
          loop,
          href,
          hints: serverHints,
        })
      : null,
    mounts.map(({ key, target, node }) => createPortal(node, target, String(key))),
  );
}

/** React's names for the HTML attributes the copy uses that it spells otherwise. */
const reactNames: Record<string, string> = {
  srcset: "srcSet",
  fetchpriority: "fetchPriority",
};
/** Boolean attributes React takes as `true`. */
const reactFlags = new Set(["disabled", "inert", "hidden"]);

function staticElement(each: FluidboxStaticNode | string): ReactElement | string {
  if (typeof each === "string") return each;
  const { tag, attributes, children } = each;
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attributes)) {
    props[reactNames[name] ?? name] = reactFlags.has(name) || value;
  }
  return createElement(tag, props, ...children.map(staticElement));
}

/**
 * The open viewer's copy, rendered after the Root's children so the parts
 * among them have said what it needs. It is built as elements, not HTML, so
 * it renders under Trusted Types and a strict style-src.
 */
function ServerViewer({
  viewerRef,
  items,
  index,
  labels,
  loop,
  href,
  hints,
}: {
  viewerRef: Ref<HTMLDivElement>;
  items: readonly FluidboxItem[];
  index: number;
  labels: FluidboxLabels;
  loop: boolean | undefined;
  href: FluidboxRootProps<any>["href"];
  hints: ServerHints;
}): ReactElement | null {
  const copy = fluidboxStaticViewerNodes({
    items,
    value: idOf(items[index]!),
    labels,
    loop,
    href,
    thumbnails: hints.thumbnails,
    sheet: hints.sheet,
    controls: !hints.viewer,
  });
  if (!copy) return null;
  return createElement(
    "div",
    { ref: viewerRef, "data-fluidbox-server-viewer": "" },
    staticElement(copy),
  );
}

type ChildHandler<E> = ((event: E) => void) | undefined;

function Trigger<TItem extends FluidboxItem>({
  asChild = false,
  value,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...attributes
}: FluidboxTriggerProps<TItem>): ReactElement {
  const context = useFluidboxContext();
  if (value === null || value === undefined) {
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "<Fluidbox.Trigger> needs a value: an item, its id or its index, or a list.";
        } catch {}
        return "fluidbox";
      })(),
    );
  }
  // Its first opens; every one closes back onto it. Compared by value.
  const keysKey = JSON.stringify(targetKeys(value));
  const keys = useMemo(() => JSON.parse(keysKey) as (number | string)[], [keysKey]);
  const followsSelection = typeof children === "function";
  // Only a trigger whose children follow the selection re-renders with the viewer.
  const state = useFluidbox((current) => (followsSelection ? current : null));
  const [, rerender] = useState(0);
  const options = {
    value,
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
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "<Fluidbox.Trigger asChild> needs one element child.";
        } catch {}
        return "fluidbox";
      })(),
    );
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

/** Renders your controls and captions into the viewer's layer. Without one, the viewer has the default controls. */
function Viewer({ children }: FluidboxViewerProps): ReactElement | null {
  const { viewerTarget, addViewer, serverHints } = useFluidboxContext();
  // Read by the server's copy of the open viewer, which renders after this.
  serverHints.viewer = true;
  useIsomorphicLayoutEffect(addViewer, [addViewer]);
  return viewerTarget ? createPortal(children, viewerTarget) : null;
}

/**
 * The slide for each item type. It renders nothing: the viewer asks for a
 * slide's content as the slide mounts, and renders it into the slide's layer.
 */
function Slides<TItem extends FluidboxItem>(props: FluidboxSlidesProps<TItem>): null {
  const { slides } = useFluidboxContext();
  // Every render, so the slides on show render the newest content.
  useIsomorphicLayoutEffect(() => slides.set(props as SlideContents));
  useIsomorphicLayoutEffect(() => {
    // Development builds only; a page without a bundler has no process.
    const twice = (() => {
      try {
        if (process.env.NODE_ENV !== "production") return claimed.has(slides);
      } catch {}
      return false;
    })();
    if (twice) throw new Error("A <Fluidbox.Root> takes one <Fluidbox.Slides>.");
    claimed.add(slides);
    return () => {
      claimed.delete(slides);
      slides.set(null);
    };
  }, [slides]);
  return null;
}

/** The slide stores a Slides part has claimed. */
const claimed = new WeakSet<object>();

/**
 * One slide's content, in the slide's layer. Its layout effect runs after its
 * children's, so `Media render` and the add-ons have called `waitUntil` by
 * the time it reports the commit.
 */
function SlideHost({
  slide,
  type,
  release,
}: {
  slide: FluidboxSlide<any>;
  type: string;
  release: () => void;
}): ReactElement | null {
  const { slides } = useFluidboxContext();
  const props = useSyncExternalStore(slides.subscribe, slides.read, slides.read);
  const [active, setActive] = useState(slide.active);
  useIsomorphicLayoutEffect(() => {
    setActive(slide.active);
    return slide.onActiveChange(setActive);
  }, [slide]);
  const content = props?.[type] ?? props?.default;
  const value = useMemo(() => ({ slide, active }), [slide, active]);
  // Content that suspends waits inside the slide, not the app around the
  // viewer, and the open waits with it: the commit is reported beside the
  // content, so once the boundary shows it.
  return createElement(
    SlideContext.Provider,
    { value },
    createElement(
      Suspense,
      { fallback: null },
      content?.({ item: slide.item, index: slide.index }) ?? null,
      createElement(SlideCommitted, { release }),
    ),
  );
}

/** Report the slide's commit as it mounts, which is when the content beside it has. */
function SlideCommitted({ release }: { release: () => void }): null {
  useIsomorphicLayoutEffect(() => release(), [release]);
  return null;
}

/** The slide this part is inside: its item, whether it is on show, and its hooks into the open. */
export function useFluidboxSlide<
  TItem extends FluidboxItem = FluidboxItem,
>(): FluidboxSlideApi<TItem> {
  const { slide, active } = useSlideContext("useFluidboxSlide");
  return useMemo(
    () => ({
      item: slide.item,
      get index() {
        return slide.index;
      },
      active,
      get opening() {
        return slide.opening;
      },
      signal: slide.signal,
      onActiveChange: slide.onActiveChange,
      get origin() {
        return slide.origin;
      },
      returnPlayback: slide.returnPlayback,
      onClose: slide.onClose,
      waitUntil: slide.waitUntil,
      fail: slide.fail,
      onZoom: slide.onZoom,
    }),
    [slide, active],
  );
}

/**
 * The slide's media box: the element that flies, follows a drag to dismiss
 * and zooms. It is the viewer's own element; this part gives it its
 * attributes, its children and what `render` draws.
 */
function Media({ zoom, render, children, ...attributes }: FluidboxMediaProps): ReactElement | null {
  const { slide } = useSlideContext("Media");
  const host = useHost();
  const attributesKey = JSON.stringify(attributes);
  useIsomorphicLayoutEffect(
    () => applyAttributes(slide.media, attributes),
    // attributes are compared by value, so an inline style object changes nothing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [slide, attributesKey],
  );
  useIsomorphicLayoutEffect(() => {
    if (!host) return;
    slide.media.append(host);
    return () => host.remove();
  }, [slide, host]);
  useIsomorphicLayoutEffect(() => {
    if (!render) return;
    // Its own signal and the nodes it adds go when this part does, so a new
    // render function draws afresh.
    const scope = new AbortController();
    slide.signal.addEventListener("abort", () => scope.abort(), {
      once: true,
      signal: scope.signal,
    });
    const before = new Set(slide.media.childNodes);
    const dispose = render(Object.create(slide, { signal: { value: scope.signal } }));
    return () => {
      dispose?.();
      scope.abort();
      for (const node of [...slide.media.childNodes]) if (!before.has(node)) node.remove();
    };
  }, [slide, render]);
  // Its parent effects run after Image's, so an explicit `zoom` wins.
  useIsomorphicLayoutEffect(() => {
    if (zoom !== undefined) slide.zoomable(zoom);
  }, [slide, zoom]);
  return host && children != null ? createPortal(children, host) : null;
}

/** Draw one of the built-in media into the slide's box, keyed by the item's fields. */
function useDraw(
  part: string,
  draw: (slide: FluidboxSlide<any>) => () => void,
  key: unknown,
): null {
  const { slide } = useSlideContext(part);
  const latestDraw = useLatest(draw);
  useIsomorphicLayoutEffect(
    () => latestDraw.current(slide),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [slide, JSON.stringify(key)],
  );
  return null;
}

/** The built-in image in the slide's box: it loads, sharpens and fails as a photo's does. */
function Image({ item }: FluidboxImageProps): null {
  return useDraw("Image", (slide) => slide.drawImage(item), item);
}

/** The built-in video in the slide's box. `attach` loads the media yourself; pass a stable function. */
function Video({ item, attach }: FluidboxVideoProps): null {
  const { slide } = useSlideContext("Video");
  useIsomorphicLayoutEffect(
    () => slide.drawVideo(item, attach && { attach }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [slide, JSON.stringify(item), attach],
  );
  return null;
}

/** The built-in iframe in the slide's box. */
function Iframe({ item }: FluidboxIframeProps): null {
  return useDraw("Iframe", (slide) => slide.drawIframe(item), item);
}

/**
 * The name, disabled, hidden and active states, and Download's link, of a
 * control as the state has it.
 */
function useControl(name: FluidboxControlName) {
  const { fluidbox, labels } = useFluidboxContext();
  const control = fluidboxControls[name];
  // As one string, so a control renders again only when what it shows changes.
  const shown = useFluidbox((state) =>
    JSON.stringify([
      control.disabled(state),
      !!control.hidden?.(fluidbox, state),
      control.label(labels, state),
      name === "download" && downloadLink(state.item),
      !!control.active?.(state),
    ]),
  );
  const [disabled, hidden, label, link, active] = JSON.parse(shown) as [
    boolean,
    boolean,
    string,
    ReturnType<typeof downloadLink> | false,
    boolean,
  ];
  return { fluidbox, control, disabled, hidden, label, link: link || null, active };
}

/**
 * The content and name of a control: its label as text without children, and
 * with them, the label as `aria-label` unless `label` is false.
 */
function named(
  children: ReactNode,
  label: string | false | undefined,
  text: string,
  ariaLabel: string | undefined,
) {
  const name = typeof label === "string" ? label : text;
  return children == null
    ? { "data-fluidbox-default": "", "aria-label": ariaLabel, children: name }
    : { "aria-label": ariaLabel ?? (label === false ? undefined : name), children };
}

function control(name: Exclude<FluidboxControlName, "download" | "counter">) {
  return forwardRef<HTMLButtonElement, FluidboxControlProps>(function FluidboxControl(
    { children, label, onClick, ...attributes },
    ref,
  ) {
    const { fluidbox, control, disabled, hidden, label: text, active } = useControl(name);
    const { children: content, ...naming } = named(children, label, text, attributes["aria-label"]);
    return createElement(
      "button",
      {
        ...attributes,
        ...naming,
        ref,
        type: attributes.type ?? "button",
        disabled: attributes.disabled ?? disabled,
        hidden: attributes.hidden ?? (hidden || undefined),
        [control.attribute]: "",
        "data-fluidbox-managed": "",
        "data-active": active ? "" : undefined,
        onClick(event: ReactMouseEvent<HTMLButtonElement>) {
          onClick?.(event);
          if (event.defaultPrevented) return;
          // Prevented, so the viewer's own handling of the attribute skips it.
          event.preventDefault();
          void control.run(fluidbox, event);
        },
      },
      content,
    );
  });
}

const Close = control("close");
const Previous = control("previous");
const Next = control("next");
const ZoomIn = control("zoomIn");
const ZoomOut = control("zoomOut");
const ZoomReset = control("zoomReset");
const Fullscreen = control("fullscreen");
const Share = control("share");
/** Plays and pauses the slideshow, named for what it does next. Hidden without a `slideshow` option. */
const Slideshow = control("slideshow");
const Retry = control("retry");
const parts = {
  previous: Previous,
  next: Next,
  close: Close,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  zoomReset: ZoomReset,
};

/** A link that downloads the item on show's file. Off-site files are fetched, so they download too. */
const Download = forwardRef<HTMLAnchorElement, FluidboxDownloadProps>(function Download(
  { children, label, onClick, ...attributes },
  ref,
) {
  const { fluidbox, control, hidden, label: text, link } = useControl("download");
  const { children: content, ...naming } = named(children, label, text, attributes["aria-label"]);
  return createElement(
    "a",
    {
      ...link,
      ...attributes,
      ...naming,
      ref,
      hidden: attributes.hidden ?? (hidden || undefined),
      [control.attribute]: "",
      "data-fluidbox-managed": "",
      onClick(event: ReactMouseEvent<HTMLAnchorElement>) {
        onClick?.(event);
        const href = event.currentTarget.href;
        // A same-site file downloads by itself; elsewhere the browser would navigate.
        if (event.defaultPrevented || !href || !crossOrigin(href)) return;
        event.preventDefault();
        void fluidbox.download();
      },
    },
    content,
  );
});

/** A group of controls. With no children it holds Previous, Next and Close. */
const Toolbar = forwardRef<HTMLDivElement, FluidboxGroupProps>(function Toolbar(
  { children, ...attributes },
  ref,
) {
  return createElement(
    "div",
    { role: "group", ...attributes, ref, "data-fluidbox-toolbar": "" },
    children ?? controlNames.map((name) => createElement(parts[name], { key: name })),
  );
});

/** The zoom controls' group, named like the zoomed image. With no children it holds Zoom in, Zoom out and Fit. */
const ZoomControls = forwardRef<HTMLDivElement, FluidboxGroupProps>(function ZoomControls(
  { children, ...attributes },
  ref,
) {
  const { labels } = useFluidboxContext();
  return createElement(
    "div",
    {
      role: "group",
      "aria-label": labels.zoomed,
      ...attributes,
      ref,
      "data-fluidbox-zoom-controls": "",
    },
    children ?? zoomControlNames.map((name) => createElement(parts[name], { key: name })),
  );
});

/** Where the viewer is, as `1 / 4`. Hidden from screen readers, which hear the slide's name. */
const Counter = forwardRef<HTMLSpanElement, FluidboxCounterProps>(function Counter(
  { children, ...attributes },
  ref,
) {
  const { labels } = useFluidboxContext();
  const index = useFluidbox((state) => state.index);
  const count = useFluidbox((state) => state.count);
  return createElement(
    "span",
    {
      "aria-hidden": "true",
      ...attributes,
      ref,
      hidden: attributes.hidden ?? (index === null || undefined),
      "data-fluidbox-counter": "",
      // The binding renders it; the core's painting would replace its children.
      "data-fluidbox-managed": "",
    },
    index === null ? null : children ? children({ index, count }) : labels.counter(index, count),
  );
});

/**
 * The item's caption, which describes the dialog. Inside a slide it is that
 * slide's item; elsewhere the item on show. Nothing without a caption.
 */
const Caption = forwardRef<HTMLDivElement, FluidboxCaptionProps<any>>(function Caption(
  { children, ...attributes },
  ref,
) {
  const slide = useContext(SlideContext)?.slide;
  const shown = useFluidbox((state) => (slide ? null : state.item));
  const shownIndex = useFluidbox((state) => (slide ? null : state.index));
  const item = slide ? slide.item : shown;
  const index = slide ? slide.index : shownIndex;
  const content =
    item && index !== null ? (children ? children({ item, index }) : item.caption) : null;
  if (content == null || content === "") return null;
  return createElement(
    "div",
    { ...attributes, ref, "data-fluidbox-caption": "", "data-fluidbox-description": "" },
    content,
  );
}) as <TItem extends FluidboxItem = FluidboxItem>(
  props: FluidboxCaptionProps<TItem> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;

/** The loading and error state of the slide a part follows: its own, or the one on show. */
function useSlideStatus() {
  const { fluidbox, viewerTarget } = useFluidboxContext();
  const slide = useContext(SlideContext)?.slide;
  const [status, setStatus] = useState({ busy: false, error: false });
  const causes = useRef(new Map<number, unknown>());
  useIsomorphicLayoutEffect(() => {
    const root = slide
      ? slide.media.closest<HTMLElement>("[data-fluidbox-slide]")
      : viewerTarget?.closest<HTMLElement>("[data-fluidbox-dialog]");
    if (!root) return;
    const events = new AbortController();
    fluidbox.addEventListener(
      "mediaerror",
      (event) => causes.current.set(event.index, event.cause),
      {
        signal: events.signal,
      },
    );
    const read = () => {
      const shown = slide ? root : root.querySelector("[data-fluidbox-slide][data-active]");
      const busy = !!shown?.hasAttribute("data-busy");
      const error = !!shown?.hasAttribute("data-error");
      setStatus((current) =>
        current.busy === busy && current.error === error ? current : { busy, error },
      );
    };
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-busy", "data-error", "data-active"],
      subtree: !slide,
    });
    read();
    return () => {
      observer.disconnect();
      events.abort();
    };
  }, [fluidbox, slide, viewerTarget]);
  return { ...status, slide, causes: causes.current };
}

/** Its children, while the item on show is loading. */
function Loading({ children }: FluidboxLoadingProps): ReactElement | null {
  const { busy } = useSlideStatus();
  return busy
    ? createElement("div", { "aria-hidden": "true", "data-fluidbox-loading": "" }, children)
    : null;
}

/** Its children, in place of the default error, while the item on show failed. */
function ErrorPart<TItem extends FluidboxItem>({
  children,
}: FluidboxErrorProps<TItem>): ReactElement | null {
  const { error, slide, causes } = useSlideStatus();
  const item = useFluidbox((state) => (slide ? slide.item : state.item)) as TItem | null;
  const index = useFluidbox((state) => (slide ? slide.index : state.index));
  if (!error || !item) return null;
  return createElement(
    "div",
    { "data-fluidbox-error-content": "" },
    typeof children === "function"
      ? children({ item, error: index === null ? undefined : causes.get(index) })
      : children,
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
 * Turns the thumbnails on. With a render child, renders each thumbnail into its
 * button through a portal.
 */
function Thumbnails<TItem extends FluidboxItem>({
  children,
}: FluidboxThumbnailsProps<TItem>): ReactElement | null {
  const { setAddon, thumbnailsSlots, serverHints } = useFluidboxContext();
  // Read by the server's copy of the open viewer, which renders after this.
  serverHints.thumbnails = true;
  const custom = children !== undefined;
  useIsomorphicLayoutEffect(() => {
    setAddon("thumbnails", { custom });
    return () => setAddon("thumbnails", null);
  }, [setAddon, custom]);
  const current = useSlots(thumbnailsSlots as FluidboxSlots<TItem>);
  const shown = useFluidbox((state) => (children ? state.index : null));
  if (!children) return null;
  return createElement(
    Fragment,
    null,
    current.map((slot) =>
      createPortal(
        children({ item: slot.item, index: slot.index, active: slot.index === shown }),
        slot.target,
        slotKey(slot),
      ),
    ),
  );
}

type SheetAttributes = Omit<
  FluidboxSheetProps,
  "snapPoints" | "dismissMotion" | "onSnapChange" | "children"
>;

/**
 * Turns the sheet on. The viewer's `<section data-fluidbox-sheet>` is the
 * sheet: it gets this part's attributes, and the render child draws its
 * content for the item on show.
 */
function Sheet<TItem extends FluidboxItem>({
  snapPoints,
  dismissMotion,
  onSnapChange,
  children,
  ...attributes
}: FluidboxSheetProps<TItem>): ReactElement {
  const { fluidbox, setAddon, sheetSlots, serverHints } = useFluidboxContext();
  // Read by the server's copy of the open viewer, which renders after this.
  serverHints.sheet = true;
  const pointsKey = JSON.stringify(snapPoints ?? null);
  useIsomorphicLayoutEffect(() => {
    setAddon("sheet", { snapPoints, dismissMotion });
    return () => setAddon("sheet", null);
    // snapPoints is compared by value, so an inline array changes nothing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [setAddon, pointsKey, dismissMotion]);
  const latestSnap = useLatest(onSnapChange);
  useIsomorphicLayoutEffect(() => {
    const events = new AbortController();
    fluidbox.addEventListener("sheetchange", (event) => latestSnap.current?.(event), {
      signal: events.signal,
    });
    return () => events.abort();
  }, [fluidbox, latestSnap]);
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
function applyAttributes(element: HTMLElement, attributes: object): () => void {
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

/** A button that moves the sheet to the snap `to`. */
const SheetSnap = forwardRef<HTMLButtonElement, FluidboxSheetSnapProps>(function SheetSnap(
  { to, children, label, ...attributes },
  ref,
) {
  const { labels } = useFluidboxContext();
  // Its children usually name it, so the label names it only when asked.
  const { children: content, ...naming } = named(
    children,
    label ?? false,
    labels.sheet,
    attributes["aria-label"],
  );
  return createElement(
    "button",
    {
      ...attributes,
      ...naming,
      ref,
      type: attributes.type ?? "button",
      "data-fluidbox-sheet-snap": String(to),
    },
    content,
  );
});

/**
 * A badge, caption or scrim on a trigger. It gets `--fluidbox-closed` and
 * `data-fluidbox-phase` as the viewer opens and closes, and goes with the
 * photo's flight as `flight` says.
 */
const Overlay = forwardRef<HTMLSpanElement, FluidboxOverlayProps>(function Overlay(
  { flight = "none", children, ...attributes },
  forwardedRef,
) {
  const { fluidbox, mount, items } = useFluidboxContext();
  const keys = useContext(TriggerContext);
  // In the live copy a flight renders, an overlay is a picture, not another overlay.
  const travelling = useContext(TravelContext);
  if (!keys && !travelling) {
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "<Fluidbox.Overlay> must be inside a <Fluidbox.Trigger>.";
        } catch {}
        return "fluidbox";
      })(),
    );
  }
  const latestChildren = useLatest(children);
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!element || !keys || travelling) return;
    return fluidbox.bindOverlay(element, keys, {
      flight:
        flight === "live"
          ? {
              live: ({ target: frame }) =>
                mount(
                  frame,
                  createElement(TravelContext.Provider, { value: true }, latestChildren.current),
                ),
            }
          : flight,
    });
  }, [element, flight, keys, travelling, fluidbox, items, mount, latestChildren]);
  const latestRef = useLatest(forwardedRef);
  const ref = useCallback(
    (next: HTMLSpanElement | null) => {
      setForwardedRef(latestRef.current, next);
      setElement(next);
    },
    [latestRef],
  );
  // The frame overlay itself flies, so a live copy leaves it out.
  if (travelling && flight === "frame") return null;
  return createElement(
    "span",
    { ...attributes, ref, "data-fluidbox-trigger-overlay": flight },
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

/** The sheet's snap, re-rendering as `sheetchange` moves it, and a function that moves it. */
export function useFluidboxSheet(): FluidboxSheetApi {
  const { fluidbox } = useFluidboxContext();
  const subscribe = useCallback(
    (listener: () => void) => {
      const events = new AbortController();
      fluidbox.addEventListener("sheetchange", listener, { signal: events.signal });
      // A sheet that loads or goes changes the snap too.
      const release = fluidbox.subscribe(listener);
      return () => {
        events.abort();
        release();
      };
    },
    [fluidbox],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => fluidbox.sheet?.snap ?? 0,
    () => 0,
  );
  return useMemo(
    () => ({ snap, setSnap: (next, options) => fluidbox.sheet?.setSnap(next, options) }),
    [snap, fluidbox],
  );
}

export const Fluidbox = {
  Root,
  Trigger,
  Overlay,
  Slides,
  Media,
  Image,
  Video,
  Iframe,
  Viewer,
  Toolbar,
  ZoomControls,
  Close,
  Previous,
  Next,
  ZoomIn,
  ZoomOut,
  ZoomReset,
  Fullscreen,
  Download,
  Share,
  Slideshow,
  Counter,
  Caption,
  Loading,
  Error: ErrorPart,
  Retry,
  Thumbnails,
  Sheet,
  SheetSnap,
};

/** The type of `Fluidbox`. */
export type FluidboxReactParts = typeof Fluidbox;

function setForwardedRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
