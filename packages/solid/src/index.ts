/** The Solid binding: the `Fluidbox` parts and the `useFluidbox`, `useFluidboxSheet` and `useFluidboxSlide` primitives. */
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
  onMount,
  Show,
  splitProps,
  Suspense,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, JSX, Owner } from "solid-js";
import { Dynamic, insert, spread } from "solid-js/web";
import {
  createFluidbox,
  type Fluidbox as FluidboxInstance,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxLabels,
  type FluidboxRenderer,
  type FluidboxSheetOptions,
  type FluidboxSlide,
  type FluidboxSlideRenderer,
  type FluidboxSlides,
  type FluidboxState,
  type FluidboxThumbnailsOptions,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import {
  controlNames,
  createFluidboxSync,
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
  type FluidboxStaticNode,
  type FluidboxTriggerPreview,
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

/** The Slides part's props, by item type. */
type SlideContents = Readonly<Record<string, FluidboxSlideContent<any> | undefined>>;

interface FluidboxContextValue {
  readonly fluidbox: FluidboxInstance<any>;
  readonly commands: FluidboxCommands<any>;
  readonly state: Accessor<FluidboxState<any>>;
  readonly items: Accessor<FluidboxItemList<any>>;
  readonly labels: Accessor<FluidboxLabels>;
  /** The viewer's layer for controls and captions, while the viewer exists. */
  readonly viewerTarget: Accessor<HTMLElement | null>;
  /** The Slides part's props, which a slide reads as it renders. */
  readonly slides: Accessor<SlideContents | null>;
  addViewer(): () => void;
  claimSlides(contents: SlideContents): () => void;
  setThumbnails(option: true | FluidboxThumbnailsOptions<any>): () => void;
  setSheet(option: Accessor<FluidboxSheetOptions<any>>): () => void;
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
  readonly active: Accessor<boolean>;
}

const FluidboxContext = createContext<FluidboxContextValue>();
const SlideContext = createContext<SlideContextValue>();
/** The item keys of the enclosing Trigger. */
const TriggerContext = createContext<Accessor<readonly (number | string)[]>>();
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

/**
 * Render content straight into a runtime target, under an owner so its context
 * reaches the content. Unlike solid-js/web's Portal it adds no wrapper element,
 * which the runtime's targets and thumbnails buttons expect. Each mount keeps
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

/** Show, typed for children that don't read the condition. */
const When = Show as (props: {
  readonly when: unknown;
  readonly children: JSX.Element;
}) => JSX.Element;

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function Root<TItem extends FluidboxItem>(props: FluidboxRootProps<TItem>): JSX.Element {
  const [viewerTarget, setViewerTarget] = createSignal<HTMLElement | null>(null);
  const [viewers, setViewers] = createSignal(0);
  const [thumbnails, setThumbnails] = registry<true | FluidboxThumbnailsOptions<any>>();
  const [sheet, setSheet] = registry<Accessor<FluidboxSheetOptions<any>>>();
  const [slides, setSlides] = createSignal<SlideContents | null>(null);

  // Objects are compared by value, so inline labels, zoom or dismiss change nothing.
  const labelsKey = createMemo(() => JSON.stringify(props.labels ?? {}));
  const labels = createMemo(on(labelsKey, () => resolveLabels(untrack(() => props.labels))));
  const labelOptions = (): Partial<FluidboxLabels> => ({
    ...props.labels,
    position: (index, count) => (props.labels?.position ?? defaultLabels.position)(index, count),
  });
  const zoom = createMemo(
    () => {
      const value = props.zoom;
      return value === false ? false : value ? { ...value } : undefined;
    },
    undefined,
    { equals: sameJson },
  );
  const dismiss = createMemo(() => props.dismiss && { ...props.dismiss }, undefined, {
    equals: sameJson,
  });

  // Content the viewer asks for renders under an owner inside the Provider, so
  // it reaches both the app's context and the fluidbox's.
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

  // A viewer made by the open it serves measures its layer right after this.
  // Signals update the DOM synchronously, so the content is there by then.
  const renderViewer: FluidboxViewerRenderer<TItem> = ({ target }) => {
    setViewerTarget(target);
    return () => setViewerTarget((shown) => (shown === target ? null : shown));
  };

  // The fluidbox exists from the start, so parts bind to it as they render. It
  // touches nothing until a viewer is pressed or opened.
  // findTrigger and revealTrigger are read from the newest props on each use.
  const fluidbox = createFluidbox<TItem>(
    latestFindTrigger(
      {
        items: untrack(() => props.items),
        labels: untrack(labelOptions),
        zoom: untrack(zoom),
        loop: untrack(() => props.loop),
        preload: untrack(() => props.preload),
        dismiss: untrack(dismiss),
        wheel: untrack(() => props.wheel),
        // Share shares the item's href unless shareUrl says otherwise.
        shareUrl: (item) => (props.shareUrl ? props.shareUrl(item) : props.href?.(idOf(item))),
        // Slides are looked up by type as one mounts, so the Slides part's
        // newest props are used without telling the viewer.
        slides: new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
          get(_, key) {
            if (typeof key !== "string" || !untrack(slides)?.[key]) return undefined;
            const renderer: FluidboxSlideRenderer<TItem> = (slide) => {
              // The open waits until the slide host reports its commit.
              const release = holdSlideCommit(slide);
              const unmount = mount(slide.layer, () =>
                createComponent(SlideHost, { slide, type: key, release }),
              );
              return () => {
                release();
                unmount();
              };
            };
            return renderer;
          },
          has: (_, key) => typeof key === "string" && !!untrack(slides)?.[key],
        }) as FluidboxSlides<TItem>,
      },
      () => props,
    ),
  );
  // An unmount, or a hot reload's, drops the viewer; the next open makes
  // another. The events below stop first, so the drop never reaches
  // onValueChange as a close.
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
  const { signal } = events;
  fluidbox.addEventListener("zoomchange", (event) => props.onZoomChange?.(event), { signal });
  fluidbox.addEventListener("mediaerror", (event) => props.onMediaError?.(event), { signal });
  watchFluidbox(
    fluidbox,
    {
      value: (value, details) => props.onValueChange?.(value, details),
      complete: (value, details) => props.onValueChangeComplete?.(value, details),
    },
    signal,
  );

  createEffect(
    on(
      [labelsKey, zoom, dismiss, () => props.loop, () => props.preload, () => props.wheel],
      ([, zoom, dismiss, loop, preload, wheel]) =>
        fluidbox.update({ labels: untrack(labelOptions), zoom, dismiss, loop, preload, wheel }),
      { defer: true },
    ),
  );
  // Each part's render functions stay the same while it is mounted, so the
  // viewer only remounts an add-on when its options really change. Not
  // deferred: the parts register as Root's children render, before this runs.
  const thumbnailsOption = createMemo(() => thumbnails() ?? undefined);
  const sheetOption = createMemo(() => sheet()?.());
  createEffect(() =>
    fluidbox.update({
      viewer: viewers() > 0 ? renderViewer : undefined,
      thumbnails: thumbnailsOption(),
      sheet: sheetOption(),
    }),
  );

  createRenderEffect(
    on(
      () => props.items,
      (next) => void fluidbox.setItems(next),
      { defer: true },
    ),
  );

  // A Root that renders open on an image draws the viewer's copy on its first
  // render, after its children, so the server's HTML shows the photo and the
  // viewer takes it over as the Root mounts.
  const serverHints: ServerHints = { thumbnails: false, sheet: false, viewer: false };
  const serverIndex = untrack(() => {
    const initial = props.value !== undefined ? props.value : (props.defaultValue ?? null);
    const list = Array.isArray(props.items) ? (props.items as readonly TItem[]) : [];
    const index = initial === null ? -1 : list.findIndex((item) => idOf(item) === initial);
    return list[index]?.type === "image" ? index : null;
  });
  const [takenOver, setTakenOver] = createSignal(false);
  let serverViewer: HTMLElement | undefined;

  // Your value wins whenever it changes. Effects run once Root's children
  // mount, so the triggers are there and an open flies from its own. The
  // default value opens once, as the Root mounts, unless it takes over the copy.
  const sync = createFluidboxSync(fluidbox);
  let starting = true;
  createEffect(() => {
    const value = props.value;
    untrack(() => {
      if (starting && serverViewer && serverIndex !== null) {
        const done = () => setTakenOver(true);
        const id = idOf((props.items as readonly TItem[])[serverIndex]!);
        void takeOverFluidbox(fluidbox, serverViewer, id).then(done, done);
      } else sync(starting && value === undefined ? (props.defaultValue ?? undefined) : value);
    });
    starting = false;
  });

  const commands: FluidboxCommands<TItem> = {
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
    setItems: (next) => fluidbox.setItems(next),
    preload: (target) => fluidbox.preload(target),
    load: () => fluidbox.load(),
  };

  const value: FluidboxContextValue = {
    fluidbox,
    commands,
    state,
    items,
    labels,
    viewerTarget,
    slides,
    addViewer() {
      setViewers((count) => count + 1);
      return () => setViewers((count) => count - 1);
    },
    claimSlides(contents) {
      // Development builds only; a page without a bundler has no process.
      const twice = (() => {
        try {
          if (process.env.NODE_ENV !== "production") return untrack(slides) !== null;
        } catch {}
        return false;
      })();
      if (twice) throw new Error("A <Fluidbox.Root> takes one <Fluidbox.Slides>.");
      setSlides(() => contents);
      return () => setSlides((current) => (current === contents ? null : current));
    },
    setThumbnails,
    setSheet,
    serverHints,
  };

  // Made after the children, so the first render's parts have left their hints.
  const serverCopy = () =>
    serverIndex === null
      ? null
      : createMemo(() =>
          takenOver()
            ? null
            : untrack(() =>
                serverViewerCopy({
                  items: props.items as readonly FluidboxItem[],
                  index: serverIndex,
                  labels: labels(),
                  loop: props.loop,
                  href: props.href,
                  hints: serverHints,
                  ref: (element) => (serverViewer = element),
                }),
              ),
        );

  return createComponent(FluidboxContext.Provider, {
    value,
    get children() {
      return [
        createComponent(ContentOwner, {
          capture(owner: Owner | null) {
            contentOwner = owner;
          },
        }),
        props.children,
        serverCopy(),
      ] as unknown as JSX.Element;
    },
  });
}

/** Boolean attributes Solid sets as `true`. */
const staticFlags = new Set(["disabled", "inert", "hidden"]);

function staticElement(each: FluidboxStaticNode | string): JSX.Element {
  if (typeof each === "string") return each;
  const props: Record<string, unknown> = { component: each.tag };
  for (const [name, value] of Object.entries(each.attributes)) {
    props[name] = staticFlags.has(name) || value;
  }
  if (each.children.length) props.children = each.children.map(staticElement);
  return createComponent(Dynamic, props as Parameters<typeof Dynamic>[0]);
}

/**
 * The open viewer's copy. It is built as elements, not HTML, so it renders
 * under Trusted Types and a strict style-src.
 */
function serverViewerCopy(options: {
  items: readonly FluidboxItem[];
  index: number;
  labels: FluidboxLabels;
  loop: boolean | undefined;
  href: FluidboxRootProps<any>["href"];
  hints: ServerHints;
  ref: (element: HTMLElement) => void;
}): JSX.Element {
  const { items, index, labels, loop, href, hints, ref } = options;
  const node = fluidboxStaticViewerNodes({
    items,
    value: idOf(items[index]!),
    labels,
    loop,
    href,
    thumbnails: hints.thumbnails,
    sheet: hints.sheet,
    controls: !hints.viewer,
  });
  if (!node) return null;
  return createComponent(Dynamic, {
    component: "div",
    ref,
    "data-fluidbox-server-viewer": "",
    get children() {
      return staticElement(node);
    },
  } as Parameters<typeof Dynamic>[0]);
}

/** Hands the Root an owner inside its Provider, for the content the viewer asks for. */
function ContentOwner(props: { capture(owner: Owner | null): void }): JSX.Element {
  props.capture(getOwner());
  return null;
}

const samePreview = (a: FluidboxTriggerPreview, b: FluidboxTriggerPreview) =>
  a.item === b.item && a.index === b.index && a.status === b.status;

function Trigger<TItem extends FluidboxItem>(props: FluidboxTriggerProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  const [local, attributes] = splitProps(props, [
    "as",
    "value",
    "ref",
    "children",
    "onClick",
    "onPointerDown",
    "onPointerUp",
    "onPointerCancel",
  ]);
  const value = () => {
    const value = local.value;
    if (value === undefined || value === null)
      throw new Error(
        (() => {
          try {
            if (process.env.NODE_ENV !== "production")
              return "<Fluidbox.Trigger> needs a value: an item, its id or its index, or a list.";
          } catch {}
          return "fluidbox";
        })(),
      );
    return value;
  };
  // Its first opens; every one closes back onto it. Compared by value.
  const keys = createMemo(() => targetKeys(value()), undefined, { equals: sameJson });
  // Bumped when the closing flight lands on another item. Signals update the DOM
  // synchronously, so the preview is current before the flight measures it.
  const [landing, setLanding] = createSignal(0);
  const options = () => ({
    value: value(),
    onPreviewChange: () => setLanding((count) => count + 1),
  });
  const trigger = createTrigger<TItem>(context.fluidbox, untrack(options));
  createRenderEffect(() => trigger.update(options()));
  // Indexes name other items after the items change.
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
    value: keys,
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

/** Renders your controls and captions into the viewer's layer. Without one, the viewer has the default controls. */
function Viewer(props: FluidboxViewerProps): JSX.Element {
  const context = useFluidboxContext();
  context.serverHints.viewer = true;
  onCleanup(context.addViewer());
  mountWhile(context.viewerTarget, () => props.children);
  return null;
}

/**
 * The slide for each item type. It renders nothing: the viewer asks for a
 * slide's content as the slide mounts, and renders it into the slide's layer.
 */
function Slides<TItem extends FluidboxItem>(props: FluidboxSlidesProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  onCleanup(context.claimSlides(props as SlideContents));
  return null;
}

/**
 * One slide's content, in the slide's layer. Content that suspends waits
 * inside the slide, not the app around the viewer, and the open waits with
 * it: the commit is reported from beside the content, whose `onMount` the
 * boundary holds until it shows.
 */
function SlideHost(props: {
  slide: FluidboxSlide<any>;
  type: string;
  release: () => void;
}): JSX.Element {
  const context = useFluidboxContext();
  const { slide } = props;
  const [active, setActive] = createSignal(slide.active);
  onCleanup(slide.onActiveChange(setActive));
  const content = createMemo(() => {
    const contents = context.slides();
    return contents?.[props.type] ?? contents?.default;
  });
  const shown: FluidboxItemContext<any> = {
    item: slide.item,
    get index() {
      // Live, and reactive: new items can move the slide's item.
      context.items();
      return slide.index;
    },
  };
  return createComponent(SlideContext.Provider, {
    value: { slide, active },
    get children() {
      return createComponent(Suspense, {
        get children() {
          return [
            // A memo, so the content renders inside the boundary and suspends it.
            createMemo(() => {
              const render = content();
              return render ? untrack(() => render(shown)) : null;
            }),
            createComponent(SlideCommitted, { release: props.release }),
          ] as unknown as JSX.Element;
        },
      });
    },
  });
}

/** Report the slide's commit as it mounts, which is when the content before it has. */
function SlideCommitted(props: { release: () => void }): JSX.Element {
  onMount(() => props.release());
  return null;
}

/**
 * The slide this part is inside: its item, whether it is on show, and its
 * hooks into the open. The fields are getters; `active` is reactive.
 */
export function useFluidboxSlide<
  TItem extends FluidboxItem = FluidboxItem,
>(): FluidboxSlideApi<TItem> {
  const { slide, active } = useSlideContext("useFluidboxSlide");
  const { items } = useFluidboxContext();
  return {
    item: slide.item,
    get index() {
      // Live, and reactive: new items can move the slide's item.
      items();
      return slide.index;
    },
    get active() {
      return active();
    },
    get opening() {
      return slide.opening;
    },
    signal: slide.signal,
    onActiveChange: slide.onActiveChange,
    get origin() {
      return slide.origin;
    },
    returnPlayback: slide.returnPlayback,
    waitUntil: slide.waitUntil,
    fail: slide.fail,
    onZoom: slide.onZoom,
  };
}

/**
 * Set a part's attributes on an element the viewer made, and return a
 * function that puts back what was there.
 */
function applyAttributes(
  element: HTMLElement,
  attributes: Readonly<Record<string, string | number | boolean | object | null | undefined>>,
): () => void {
  const restores: (() => void)[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    if (key === "style") {
      // An object spells CSS properties as CSS does; a string is parsed into them.
      let declarations = value as Record<string, string | number | null>;
      if (typeof value === "string") {
        const parsed = element.ownerDocument.createElement("span").style;
        parsed.cssText = value;
        declarations = Object.fromEntries(
          Array.from(parsed, (name) => [name, parsed.getPropertyValue(name)]),
        );
      }
      for (const [name, raw] of Object.entries(declarations)) {
        if (raw === undefined || raw === null || raw === "") continue;
        const before = element.style.getPropertyValue(name);
        const priority = element.style.getPropertyPriority(name);
        element.style.setProperty(name, String(raw));
        restores.push(() => element.style.setProperty(name, before, priority));
      }
    } else if (typeof value === "object") {
      continue;
    } else if (key === "class") {
      const added = String(value)
        .split(/\s+/)
        .filter((name) => name && !element.classList.contains(name));
      element.classList.add(...added);
      restores.push(() => element.classList.remove(...added));
    } else {
      // aria-* and data-* write booleans as text; other attributes are there or not.
      const text = /^(aria|data)-/.test(key)
        ? String(value)
        : value === true
          ? ""
          : value === false
            ? null
            : String(value);
      if (text === null) continue;
      const before = element.getAttribute(key);
      element.setAttribute(key, text);
      restores.push(() =>
        before === null ? element.removeAttribute(key) : element.setAttribute(key, before),
      );
    }
  }
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/**
 * The slide's media box: the element that flies, follows a drag to dismiss
 * and zooms. It is the viewer's own element; this part gives it its
 * attributes, its children and what `render` draws.
 */
function Media(props: FluidboxMediaProps): JSX.Element {
  const { slide } = useSlideContext("Media");
  const [local, attributes] = splitProps(props, ["zoom", "render", "children"]);
  // The children render into an element of ours in the box, which goes in as
  // the slide commits: a suspended slide shows nothing in the box until then.
  const host = slide.media.ownerDocument.createElement("span");
  host.dataset.fluidboxMount = "";
  insert(host, () => local.children);
  createEffect(() =>
    onCleanup(applyAttributes(slide.media, { ...attributes } as Record<string, string | object>)),
  );
  onMount(() => {
    slide.media.append(host);
    onCleanup(() => host.remove());
  });
  createEffect(() => {
    const render = local.render;
    if (!render) return;
    // Its own signal and the nodes it adds go when this part does, so a new
    // render function draws afresh.
    const scope = new AbortController();
    slide.signal.addEventListener("abort", () => scope.abort(), {
      once: true,
      signal: scope.signal,
    });
    const before = new Set(slide.media.childNodes);
    const dispose = untrack(() =>
      render(Object.create(slide, { signal: { value: scope.signal } })),
    );
    onCleanup(() => {
      dispose?.();
      scope.abort();
      for (const node of Array.from(slide.media.childNodes)) if (!before.has(node)) node.remove();
    });
  });
  // Created after the children's, so an explicit `zoom` wins over Image's.
  createEffect(() => {
    if (local.zoom !== undefined) slide.zoomable(local.zoom);
  });
  return null;
}

/** Draw one of the built-in media into the slide's box, again as the item's fields change. */
function useDraw<T>(
  part: string,
  read: () => T,
  draw: (slide: FluidboxSlide<any>, value: T) => () => void,
) {
  const { slide } = useSlideContext(part);
  const value = createMemo(read, undefined, { equals: sameJson });
  createEffect(() => {
    const current = value();
    onCleanup(untrack(() => draw(slide, current)));
  });
}

/** The built-in image in the slide's box: it loads, sharpens and fails as a photo's does. */
function Image(props: FluidboxImageProps): JSX.Element {
  useDraw(
    "Image",
    () => props.item,
    (slide, item) => slide.drawImage(item),
  );
  return null;
}

/** The built-in video in the slide's box. `attach` loads the media yourself; pass a stable function. */
function Video(props: FluidboxVideoProps): JSX.Element {
  const attach = createMemo(() => props.attach);
  useDraw(
    "Video",
    () => [props.item, attach()] as const,
    (slide, [item, attach]) => slide.drawVideo(item, attach && { attach }),
  );
  return null;
}

/** The built-in iframe in the slide's box. */
function Iframe(props: FluidboxIframeProps): JSX.Element {
  useDraw(
    "Iframe",
    () => props.item,
    (slide, item) => slide.drawIframe(item),
  );
  return null;
}

/** The name, disabled and hidden states, and Download's link, of a control as the state has it. */
function useControl(name: FluidboxControlName) {
  const context = useFluidboxContext();
  const control = fluidboxControls[name];
  return {
    context,
    control,
    disabled: createMemo(() => control.disabled(context.state())),
    hidden: createMemo(() => !!control.hidden?.(context.fluidbox, context.state())),
    label: createMemo(() => control.label(context.labels(), context.state())),
    link: createMemo(
      () => (name === "download" ? downloadLink(context.state().item) : null),
      undefined,
      {
        equals: sameJson,
      },
    ),
  };
}

/**
 * The content and name of a control: its label as text without children, and
 * with them, the label as `aria-label` unless `label` is false.
 */
function useNaming(
  props: { readonly children?: JSX.Element; readonly label?: string | false },
  text: Accessor<string>,
) {
  const content = resolveChildren(() => props.children);
  const empty = createMemo(() => {
    const value = content();
    return value == null || (Array.isArray(value) && value.length === 0);
  });
  const name = () => (typeof props.label === "string" ? props.label : text());
  return {
    get "aria-label"() {
      return empty() || props.label === false ? undefined : name();
    },
    get "data-fluidbox-default"() {
      return empty() ? "" : undefined;
    },
    get children() {
      return empty() ? name() : content();
    },
  };
}

function control(name: Exclude<FluidboxControlName, "download" | "counter">) {
  return function FluidboxControl(props: FluidboxControlProps): JSX.Element {
    const [local, attributes] = splitProps(props, ["children", "label", "onClick"]);
    const { context, control, disabled, hidden, label } = useControl(name);
    const naming = useNaming(local, label);
    return createComponent(
      Dynamic,
      mergeProps(
        {
          component: "button",
          type: "button",
          get disabled() {
            return disabled();
          },
          get hidden() {
            return hidden() || undefined;
          },
          get "aria-label"() {
            return naming["aria-label"];
          },
        },
        attributes,
        {
          [control.attribute]: "",
          "data-fluidbox-managed": "",
          get "data-fluidbox-default"() {
            return naming["data-fluidbox-default"];
          },
          // On the button itself, so your onClick runs before the viewer sees the click.
          "on:click"(event: MouseEvent) {
            callHandler(local.onClick, event);
            if (event.defaultPrevented) return;
            // Prevented, so the viewer's own handling of the attribute skips it.
            event.preventDefault();
            void control.run(context.fluidbox, event);
          },
          get children() {
            return naming.children;
          },
        },
      ) as never,
    );
  };
}

const Close = control("close");
const Previous = control("previous");
const Next = control("next");
const ZoomIn = control("zoomIn");
const ZoomOut = control("zoomOut");
const ZoomReset = control("zoomReset");
const Fullscreen = control("fullscreen");
const Share = control("share");
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
function Download(props: FluidboxDownloadProps): JSX.Element {
  const [local, attributes] = splitProps(props, ["children", "label", "onClick"]);
  const { context, control, hidden, label, link } = useControl("download");
  const naming = useNaming(local, label);
  return createComponent(
    Dynamic,
    mergeProps(
      {
        component: "a",
        get href() {
          return link()?.href;
        },
        get download() {
          return link()?.download;
        },
        get hidden() {
          return hidden() || undefined;
        },
        get "aria-label"() {
          return naming["aria-label"];
        },
      },
      attributes,
      {
        [control.attribute]: "",
        "data-fluidbox-managed": "",
        get "data-fluidbox-default"() {
          return naming["data-fluidbox-default"];
        },
        "on:click"(event: MouseEvent) {
          callHandler(local.onClick, event);
          const href = (event.currentTarget as HTMLAnchorElement).href;
          // A same-site file downloads by itself; elsewhere the browser would navigate.
          if (event.defaultPrevented || !href || !crossOrigin(href)) return;
          event.preventDefault();
          void context.fluidbox.download();
        },
        get children() {
          return naming.children;
        },
      },
    ) as never,
  );
}

/** A `role="group"` element of the toolbar's kind, with default buttons when it has no children. */
function group(
  attribute: "data-fluidbox-toolbar" | "data-fluidbox-zoom-controls",
  names: readonly (keyof typeof parts)[],
) {
  return function FluidboxGroup(props: FluidboxGroupProps): JSX.Element {
    const [local, attributes] = splitProps(props, ["children"]);
    const context = useFluidboxContext();
    return createComponent(
      Dynamic,
      mergeProps(
        {
          component: "div",
          role: "group",
          get "aria-label"() {
            return attribute === "data-fluidbox-zoom-controls"
              ? context.labels().zoomed
              : undefined;
          },
        },
        attributes,
        {
          [attribute]: "",
          get children() {
            const children = local.children;
            return children === undefined
              ? names.map((name) => createComponent(parts[name], {}))
              : children;
          },
        },
      ) as never,
    );
  };
}

/** A group of controls. With no children it holds Previous, Next and Close. */
const Toolbar = group("data-fluidbox-toolbar", controlNames);
/** The zoom controls' group, named like the zoomed image. With no children it holds Zoom in, Zoom out and Fit. */
const ZoomControls = group("data-fluidbox-zoom-controls", zoomControlNames);

/** Where the viewer is, as `1 / 4`. Hidden from screen readers, which hear the slide's name. */
function Counter(props: FluidboxCounterProps): JSX.Element {
  const [local, attributes] = splitProps(props, ["children"]);
  const context = useFluidboxContext();
  const index = createMemo(() => context.state().index);
  const count = createMemo(() => context.state().count);
  return createComponent(
    Dynamic,
    mergeProps(
      {
        component: "span",
        "aria-hidden": "true",
        get hidden() {
          return index() === null || undefined;
        },
      },
      attributes,
      {
        "data-fluidbox-counter": "",
        get children() {
          const at = index();
          if (at === null) return null;
          const render = local.children;
          return render
            ? untrack(() => render({ index: at, count: count() }))
            : context.labels().counter(at, count());
        },
      },
    ) as never,
  );
}

/**
 * The item's caption, which describes the dialog. Inside a slide it is that
 * slide's item; elsewhere the item on show. Nothing without a caption.
 */
function Caption<TItem extends FluidboxItem = FluidboxItem>(
  props: FluidboxCaptionProps<TItem>,
): JSX.Element {
  const [local, attributes] = splitProps(props, ["children"]);
  const context = useFluidboxContext();
  const slide = useContext(SlideContext)?.slide;
  const shown = createMemo(
    (): FluidboxItemContext<TItem> | null => {
      if (slide) return slide;
      const { item, index } = context.state();
      return item && index !== null ? { item, index } : null;
    },
    undefined,
    { equals: (a, b) => a?.item === b?.item && a?.index === b?.index },
  );
  const content = createMemo(() => {
    const at = shown();
    if (!at) return null;
    const render = local.children;
    return render ? untrack(() => render(at)) : (at.item.caption as JSX.Element);
  });
  return createComponent(When, {
    get when() {
      const value = content();
      return value != null && value !== "";
    },
    get children() {
      return createComponent(
        Dynamic,
        mergeProps(attributes, {
          component: "div",
          "data-fluidbox-caption": "",
          "data-fluidbox-description": "",
          get children() {
            return content();
          },
        }) as never,
      );
    },
  });
}

/** The loading and error state of the slide a part follows: its own, or the one on show. */
function useSlideStatus() {
  const context = useFluidboxContext();
  const slide = useContext(SlideContext)?.slide;
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal(false);
  const causes = new Map<number, unknown>();
  createEffect(() => {
    const root = slide
      ? slide.media.closest<HTMLElement>("[data-fluidbox-slide]")
      : context.viewerTarget()?.closest<HTMLElement>("[data-fluidbox-dialog]");
    if (!root) return;
    const events = new AbortController();
    context.fluidbox.addEventListener(
      "mediaerror",
      (event) => causes.set(event.index, event.cause),
      { signal: events.signal },
    );
    const read = () => {
      const shown = slide ? root : root.querySelector("[data-fluidbox-slide][data-active]");
      setBusy(!!shown?.hasAttribute("data-busy"));
      setError(!!shown?.hasAttribute("data-error"));
    };
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-busy", "data-error", "data-active"],
      subtree: !slide,
    });
    read();
    onCleanup(() => {
      observer.disconnect();
      events.abort();
    });
  });
  return { busy, error, slide, causes, context };
}

/** Its children, while the item on show is loading. */
function Loading(props: FluidboxLoadingProps): JSX.Element {
  const { busy } = useSlideStatus();
  return createComponent(When, {
    get when() {
      return busy();
    },
    get children() {
      return createComponent(Dynamic, {
        component: "div",
        "aria-hidden": "true",
        "data-fluidbox-loading": "",
        get children() {
          return props.children;
        },
      } as never);
    },
  });
}

/** Its children, in place of the default error, while the item on show failed. */
function ErrorPart<TItem extends FluidboxItem>(props: FluidboxErrorProps<TItem>): JSX.Element {
  const { error, slide, causes, context } = useSlideStatus();
  const failed = createMemo(
    () => {
      if (!error()) return null;
      const item = (slide ? slide.item : context.state().item) as TItem | null;
      const index = slide ? slide.index : context.state().index;
      return item ? { item, index } : null;
    },
    undefined,
    { equals: (a, b) => a?.item === b?.item && a?.index === b?.index },
  );
  return createComponent(Show, {
    get when() {
      return failed();
    },
    keyed: true,
    children: (shown: { item: TItem; index: number | null }) =>
      createComponent(Dynamic, {
        component: "div",
        "data-fluidbox-error-content": "",
        get children() {
          const content = props.children;
          return typeof content === "function"
            ? untrack(() =>
                content({
                  item: shown.item,
                  error: shown.index === null ? undefined : causes.get(shown.index),
                }),
              )
            : content;
        },
      } as never),
  } as never);
}

/**
 * Turns the thumbnails on. With a child function, it renders each thumbnail
 * into its button; the one on show has `data-active`.
 */
function Thumbnails<TItem extends FluidboxItem>(
  props: FluidboxThumbnailsProps<TItem>,
): JSX.Element {
  const context = useFluidboxContext();
  context.serverHints.thumbnails = true;
  const owner = getOwner();
  const custom = typeof untrack(() => props.children) === "function";
  // Renders straight into each button; the newest children are read as it does.
  const render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountInto(
      target,
      () =>
        props.children?.({
          item,
          index,
          get active() {
            return context.state().index === index;
          },
        }),
      owner,
    );
  onCleanup(context.setThumbnails(custom ? { render } : true));
  return null;
}

/**
 * Turns the sheet on. The viewer's `<section data-fluidbox-sheet>` is the
 * sheet: it gets this part's attributes, and the render child draws its
 * content for the item on show. Needs `@ogdakke/fluidbox/sheet.css`.
 */
function Sheet<TItem extends FluidboxItem>(props: FluidboxSheetProps<TItem>): JSX.Element {
  const context = useFluidboxContext();
  context.serverHints.sheet = true;
  const owner = getOwner();
  const [local, attributes] = splitProps(props, [
    "snapPoints",
    "dismissMotion",
    "onSnapChange",
    "children",
  ]);
  const render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountInto(
      target,
      () => {
        untrack(() => spread(target, attributes, false, true));
        return local.children?.({ item, index });
      },
      owner,
    );
  const option = createMemo(
    () => ({
      snapPoints: local.snapPoints && [...local.snapPoints],
      dismissMotion: local.dismissMotion,
      render,
    }),
    undefined,
    {
      // snapPoints is compared by value, so an inline array changes nothing.
      equals: (a, b) => a.dismissMotion === b.dismissMotion && sameJson(a.snapPoints, b.snapPoints),
    },
  );
  onCleanup(context.setSheet(option));
  const events = new AbortController();
  onCleanup(() => events.abort());
  context.fluidbox.addEventListener("sheetchange", (event) => local.onSnapChange?.(event), {
    signal: events.signal,
  });
  return null;
}

/** A button that moves the sheet to the snap `to`. */
function SheetSnap(props: FluidboxSheetSnapProps): JSX.Element {
  const [local, attributes] = splitProps(props, ["to", "children", "label"]);
  const context = useFluidboxContext();
  // Its children usually name it, so the label names it only when asked.
  const naming = useNaming(
    {
      get children() {
        return local.children;
      },
      get label() {
        return local.label ?? false;
      },
    },
    () => context.labels().sheet,
  );
  return createComponent(
    Dynamic,
    mergeProps(
      {
        component: "button",
        type: "button",
        get "aria-label"() {
          return naming["aria-label"];
        },
      },
      attributes,
      {
        get "data-fluidbox-sheet-snap"() {
          return String(local.to);
        },
        get "data-fluidbox-default"() {
          return naming["data-fluidbox-default"];
        },
        get children() {
          return naming.children;
        },
      },
    ) as never,
  );
}

/**
 * A badge, caption or scrim on a trigger. It gets `--fluidbox-closed` and
 * `data-fluidbox-phase` as the viewer opens and closes, and goes with the
 * photo's flight as `flight` says.
 */
function Overlay(props: FluidboxOverlayProps): JSX.Element {
  const context = useFluidboxContext();
  const keys = useContext(TriggerContext);
  // In the live copy a flight renders, an overlay is a picture, not another overlay.
  const travelling = useContext(TravelContext);
  if (!keys && !travelling)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "<Fluidbox.Overlay> must be inside a <Fluidbox.Trigger>.";
        } catch {}
        return "fluidbox";
      })(),
    );
  const [local, attributes] = splitProps(props, ["flight", "ref", "children"]);
  const flight = () => local.flight ?? "none";
  const [element, setElement] = createSignal<HTMLSpanElement | null>(null);
  const owner = getOwner();
  const live: FluidboxRenderer = ({ target }) =>
    mountInto(
      target,
      () =>
        createComponent(TravelContext.Provider, {
          value: true,
          get children() {
            return local.children;
          },
        }),
      owner,
    );
  createEffect(() => {
    const host = element();
    const mode = flight();
    const current = keys?.();
    if (!host || !current || travelling) return;
    onCleanup(
      context.fluidbox.bindOverlay(host, current, { flight: mode === "live" ? { live } : mode }),
    );
  });
  return createComponent(When, {
    // The frame overlay itself flies, so a live copy leaves it out.
    get when() {
      return !(travelling && flight() === "frame");
    },
    get children() {
      return createComponent(
        Dynamic,
        mergeProps(attributes, {
          component: "span",
          ref(next: HTMLSpanElement) {
            setRef(local.ref, next);
            setElement(next);
          },
          get "data-fluidbox-trigger-overlay"() {
            return flight();
          },
          get children() {
            return local.children;
          },
        }) as never,
      );
    },
  });
}

/**
 * The viewer's state and commands, or a memo of the part a selector picks.
 * The state fields are reactive getters: read them in JSX or an effect.
 */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector: (value: FluidboxApi<TItem>) => TSelected,
): Accessor<TSelected>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector?: (value: FluidboxApi<TItem>) => TSelected,
): FluidboxApi<TItem> | Accessor<TSelected> {
  const context = useFluidboxContext();
  const state = context.state as Accessor<FluidboxState<TItem>>;
  const api = {
    ...(context.commands as FluidboxCommands<TItem>),
    get status() {
      return state().status;
    },
    get value() {
      return state().value;
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
    get zoom() {
      return state().zoom;
    },
    get fullscreen() {
      return state().fullscreen;
    },
  } satisfies FluidboxApi<TItem>;
  return selector ? createMemo(() => selector(api)) : api;
}

/** The sheet's snap as a signal, following `sheetchange`, and a function that moves it. */
export function useFluidboxSheet(): FluidboxSheetApi {
  const context = useFluidboxContext();
  const { fluidbox } = context;
  const [snap, setSnap] = createSignal(0);
  // A sheet that loads or goes changes the snap too.
  createEffect(() => {
    context.state();
    setSnap(fluidbox.sheet?.snap ?? 0);
  });
  const events = new AbortController();
  onCleanup(() => events.abort());
  fluidbox.addEventListener("sheetchange", (event) => setSnap(event.snap), {
    signal: events.signal,
  });
  return {
    snap,
    setSnap: (next, options) => fluidbox.sheet?.setSnap(next, options),
  };
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
export type FluidboxSolidParts = typeof Fluidbox;
