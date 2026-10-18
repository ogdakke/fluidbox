import { CONTROL_ICON_ATTRIBUTES, CONTROL_ICON_PATHS, type ControlIconPart } from "./control-icons";
import {
  Children,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  isValidElement,
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
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { arraySource } from "./array-source";
import type { FluidboxSheet } from "./sheet";
import { createFluidbox } from "./create-fluidbox";
import { FilmstripRuntime, filmstripCommandOptions } from "./filmstrip-runtime";
import { filmstripThumbnailSources, loadFilmstripThumbnail } from "./filmstrip-thumbnail";
import { markedVisualOrigin } from "./origin-geometry";
import type {
  FluidboxCommandResult,
  FluidboxController,
  FluidboxDispose,
  FluidboxItem,
  FluidboxItemId,
  FluidboxMountContext,
  FluidboxOptions,
  FluidboxOrigin,
  FluidboxRenderer,
  FluidboxSource,
  FluidboxState,
} from "./public-api";
import type {
  FluidboxActionProps,
  FluidboxContentProps,
  FluidboxFilmstripProps,
  FluidboxItemProps,
  FluidboxPortalProps,
  FluidboxRootProps,
  FluidboxSheetProps,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
} from "./react-public-api";

export type {
  FluidboxActionProps,
  FluidboxContentProps,
  FluidboxFilmstripProps,
  FluidboxFilmstripRenderContext,
  FluidboxItemProps,
  FluidboxPortalProps,
  FluidboxReactParts,
  FluidboxReactRenderer,
  FluidboxReactRenderContext,
  FluidboxRootProps,
  FluidboxSheetProps,
  FluidboxThumbnailOverlayProps,
  FluidboxTriggerProps,
  FluidboxTriggerRenderContext,
  UseFluidbox,
  UseFluidboxState,
} from "./react-public-api";

const closedState = (count: number): FluidboxState =>
  Object.freeze({
    status: "closed",
    count,
    activeId: null,
    activeIndex: null,
    requestedId: null,
    requestedIndex: null,
    canPrevious: false,
    canNext: false,
  });

class ReactFluidboxStore<TItem extends FluidboxItem = FluidboxItem> {
  #controller: FluidboxController<TItem> | null = null;
  #source: FluidboxSource<TItem>;
  #state: FluidboxState;
  #unsubscribe: FluidboxDispose | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #registrations = new Set<{
    attach(controller: FluidboxController<TItem>): void;
    detach(): void;
  }>();

  constructor(source: FluidboxSource<TItem>) {
    this.#source = source;
    this.#state = closedState(source.count);
    const controller = {
      state: this.#state,
      prepare: (target) => this.#controller?.prepare(target) ?? (() => {}),
      open: (target, options) => this.#command((runtime) => runtime.open(target, options)),
      close: (options) => this.#command((runtime) => runtime.close(options)),
      goTo: (target, options) => this.#command((runtime) => runtime.goTo(target, options)),
      next: (options) => this.#command((runtime) => runtime.next(options)),
      previous: (options) => this.#command((runtime) => runtime.previous(options)),
      setSource: (nextSource) => this.setSource(nextSource),
      registerOrigin: (id, origin) =>
        this.#registration((runtime) => runtime.registerOrigin(id, origin)),
      registerThumbnailOverlay: (id, registration) =>
        this.#registration((runtime) => runtime.registerThumbnailOverlay(id, registration)),
      subscribe: (listener) => this.subscribe(() => listener(this.#state)),
      destroy: () => this.detach(),
    } satisfies FluidboxController<TItem>;
    Object.defineProperty(controller, "state", { get: () => this.#state });
    this.controller = controller;
  }

  readonly controller: FluidboxController<TItem>;

  get source(): FluidboxSource<TItem> {
    return this.#source;
  }

  get state(): FluidboxState {
    return this.#state;
  }

  attach(controller: FluidboxController<TItem>) {
    this.#controller = controller;
    for (const registration of this.#registrations) registration.attach(controller);
    this.#state = controller.state;
    this.#unsubscribe = controller.subscribe((state) => {
      this.#state = state;
      this.#notify();
    });
    this.#notify();
  }

  detach() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    for (const registration of this.#registrations) registration.detach();
    this.#controller = null;
    this.#state = closedState(this.#source.count);
    this.#notify();
  }

  setSource(source: FluidboxSource<TItem>): Promise<FluidboxCommandResult> {
    this.#source = source;
    if (this.#controller) return this.#controller.setSource(source);
    this.#state = closedState(source.count);
    this.#notify();
    return Promise.resolve({ status: "completed", changed: false });
  }

  subscribe(listener: () => void): FluidboxDispose {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #command(
    command: (controller: FluidboxController<TItem>) => Promise<FluidboxCommandResult>,
  ): Promise<FluidboxCommandResult> {
    const controller = this.#controller;
    if (!controller) return Promise.resolve({ status: "aborted" });
    return command(controller);
  }

  #registration(register: (controller: FluidboxController<TItem>) => FluidboxDispose) {
    let dispose: FluidboxDispose | undefined;
    const registration = {
      attach(controller: FluidboxController<TItem>) {
        dispose?.();
        dispose = register(controller);
      },
      detach() {
        dispose?.();
        dispose = undefined;
      },
    };
    this.#registrations.add(registration);
    if (this.#controller) registration.attach(this.#controller);
    return () => {
      registration.detach();
      this.#registrations.delete(registration);
    };
  }

  #notify() {
    for (const listener of this.#listeners) listener();
  }
}

interface ReactFluidboxContextValue {
  readonly store: ReactFluidboxStore<any>;
  readonly portalTarget: HTMLElement | null;
}

const FluidboxContext = createContext<ReactFluidboxContextValue | null>(null);
const ItemContext = createContext<FluidboxItemId | null>(null);
const TriggerContext = createContext<readonly FluidboxItemId[] | null>(null);

function useFluidboxContext(): ReactFluidboxContextValue {
  const value = useContext(FluidboxContext);
  if (!value) throw new Error("Fluidbox components must be rendered inside <Fluidbox.Root>.");
  return value;
}

function Root<TItem extends FluidboxItem>({
  source,
  items,
  origins,
  renderers,
  filmstrip,
  sheet,
  onBeforeCommand,
  onEvent,
  children,
}: FluidboxRootProps<TItem>): ReactElement {
  const resolvedSource = useMemo(() => source ?? arraySource(items!), [source, items]);
  const storeRef = useRef<ReactFluidboxStore<TItem> | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ReactFluidboxStore(resolvedSource);
  }
  const store = storeRef.current;
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const runtimeRenderers = renderers
      ? Object.fromEntries(
          Object.entries(renderers).map(([name, render]) => [
            name,
            {
              mount(context) {
                const root = createRoot(context.target);
                root.render(render(context));
                return () => root.unmount();
              },
            } satisfies FluidboxRenderer<TItem>,
          ]),
        )
      : undefined;
    const options: FluidboxOptions<TItem> = {
      source: store.source,
      origins,
      renderers: runtimeRenderers,
      filmstrip,
      sheet,
      onBeforeCommand,
      onEvent,
      portal: {
        mount(context) {
          setPortalTarget(context.target);
          return () => setPortalTarget((target) => (target === context.target ? null : target));
        },
      },
    };
    const controller = createFluidbox(options);
    store.attach(controller);
    return () => {
      store.detach();
      controller.destroy();
    };
  }, [filmstrip, onBeforeCommand, onEvent, origins, renderers, sheet, store]);

  useLayoutEffect(() => {
    void store.setSource(resolvedSource);
  }, [resolvedSource, store]);

  const value = useMemo<ReactFluidboxContextValue>(
    () => ({ store, portalTarget }),
    [store, portalTarget],
  );
  return createElement(FluidboxContext.Provider, { value }, children);
}

function Item({ id, children }: FluidboxItemProps): ReactElement {
  return createElement(ItemContext.Provider, { value: id }, children);
}

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
}: FluidboxTriggerProps<TItem>) {
  const { store } = useFluidboxContext();
  const enclosingId = useContext(ItemContext);
  const itemId = (value: TItem | string): string => (typeof value === "string" ? value : value.id);
  const id = item ? itemId(item) : items?.[0] ? itemId(items[0]) : enclosingId;
  if (!id)
    throw new Error("<Fluidbox.Trigger> needs item, items, or an enclosing <Fluidbox.Item>.");
  const ids = items ? [...new Set(items.map(itemId))] : [id];
  if (!ids.includes(id)) ids.unshift(id);
  const state = useFluidboxState((current) => current);
  const [lastPreviewId, setLastPreviewId] = useState<string | null>(null);
  const activeId = state.activeId && ids.includes(state.activeId) ? state.activeId : null;
  const previewId = activeId ?? lastPreviewId ?? id;
  const previewIndex = store.source.getIndex(previewId) ?? store.source.getIndex(id);
  const previewItem = previewIndex === null ? null : (store.source.getItem(previewIndex) as TItem);
  // A trigger that renders the last viewed slide reopens on that slide, so the
  // flight starts from the picture the card is showing.
  const openId = previewItem?.id ?? id;
  const rendered =
    typeof children === "function"
      ? children({
          item: previewItem,
          index: previewIndex,
          status: activeId ? state.status : "closed",
        })
      : children;
  const disposeRef = useRef<FluidboxDispose | undefined>(undefined);
  const preparationRef = useRef<FluidboxDispose | undefined>(undefined);
  const preparationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const child = Children.only(rendered);
  const childProps = isValidElement<Record<string, unknown>>(child) ? child.props : {};
  const childRef =
    "ref" in childProps
      ? (childProps.ref as Ref<HTMLElement> | undefined)
      : (Object.getOwnPropertyDescriptor(child, "ref")?.value as Ref<HTMLElement> | undefined);
  const setRef = (element: HTMLElement | null) => {
    disposeRef.current?.();
    disposeRef.current = undefined;
    setForwardedRef(childRef, element);
    if (!element) return;
    const visual =
      element.querySelector<HTMLElement>("[data-fluidbox-origin]") ??
      markedVisualOrigin(element) ??
      (element.matches("img, video")
        ? element
        : (element.querySelector<HTMLElement>("img, video") ?? element));
    const thumbnail = visual.matches("img")
      ? (visual as HTMLImageElement)
      : (visual.querySelector("img") ?? undefined);
    const origin: FluidboxOrigin = {
      trigger: element,
      visual,
      thumbnail,
      prepareClose(selected) {
        if (typeof children === "function") {
          flushSync(() => setLastPreviewId(selected.id));
        }
      },
    };
    const knownIds = ids.filter((candidate) => store.source.getIndex(candidate) !== null);
    if (knownIds.length) disposeRef.current = store.controller.registerOrigin(knownIds, origin);
  };
  useEffect(
    () => () => {
      disposeRef.current?.();
      preparationRef.current?.();
      clearTimeout(preparationTimer.current);
    },
    [],
  );
  const discardPreparation = () => {
    clearTimeout(preparationTimer.current);
    preparationTimer.current = undefined;
    preparationRef.current?.();
    preparationRef.current = undefined;
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const childHandler = childProps.onPointerDown as
      | ((event: ReactPointerEvent<HTMLButtonElement>) => void)
      | undefined;
    childHandler?.(event);
    onPointerDown?.(event);
    if (event.defaultPrevented || !event.isPrimary || event.button !== 0) return;
    discardPreparation();
    preparationRef.current = store.controller.prepare({ id: openId });
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const childHandler = childProps.onPointerUp as
      | ((event: ReactPointerEvent<HTMLButtonElement>) => void)
      | undefined;
    childHandler?.(event);
    onPointerUp?.(event);
    clearTimeout(preparationTimer.current);
    preparationTimer.current = setTimeout(discardPreparation, 250);
  };
  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const childHandler = childProps.onPointerCancel as
      | ((event: ReactPointerEvent<HTMLButtonElement>) => void)
      | undefined;
    childHandler?.(event);
    onPointerCancel?.(event);
    discardPreparation();
  };
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const childClick = childProps.onClick as
      | ((event: ReactMouseEvent<HTMLButtonElement>) => void)
      | undefined;
    childClick?.(event);
    onClick?.(event);
    if (!event.defaultPrevented) void store.controller.open({ id: openId }, { reason: "trigger" });
  };

  if (asChild) {
    return createElement(
      TriggerContext.Provider,
      { value: ids },
      cloneElement(child, {
        ...attributes,
        ref: setRef,
        onClick: handleClick,
        onPointerDown: handlePointerDown,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
      } as never),
    );
  }
  return createElement(
    TriggerContext.Provider,
    { value: ids },
    createElement(
      "button",
      {
        ...attributes,
        ref: setRef,
        onClick: handleClick,
        onPointerDown: handlePointerDown,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        type: attributes.type ?? "button",
      },
      child,
    ),
  );
}

function Portal({ children }: FluidboxPortalProps): ReactElement | null {
  const { portalTarget } = useFluidboxContext();
  return portalTarget ? createPortal(children, portalTarget) : null;
}

/**
 * Renders into the slot of a sheet from `@ogdakke/fluidbox/sheet`, which scrolls
 * with the photos. Put one element with `data-fluidbox-sheet` in it.
 */
function Sheet({ sheet, children }: FluidboxSheetProps): ReactElement | null {
  const slot = useSyncExternalStore(
    (listener) => sheet.subscribe(listener),
    () => sheet.slot,
    () => null,
  );
  return slot ? createPortal(children, slot) : null;
}

const Content = forwardRef<HTMLDivElement, FluidboxContentProps>(function Content(
  { children, ...attributes },
  ref,
) {
  return createElement("div", { ...attributes, ref, "data-fluidbox-content": "" }, children);
});

const ThumbnailOverlay = forwardRef<HTMLSpanElement, FluidboxThumbnailOverlayProps>(
  function ThumbnailOverlay({ behavior = "host", children, ...attributes }, forwardedRef) {
    const { store } = useFluidboxContext();
    const id = useContext(ItemContext);
    const triggerIds = useContext(TriggerContext);
    const ids = triggerIds ?? (id ? [id] : null);
    if (!ids) throw new Error("<Fluidbox.ThumbnailOverlay> needs an enclosing Trigger or Item.");
    const disposeRef = useRef<FluidboxDispose | undefined>(undefined);
    const setRef = (element: HTMLSpanElement | null) => {
      disposeRef.current?.();
      disposeRef.current = undefined;
      setForwardedRef(forwardedRef, element);
      if (element) {
        const registration =
          behavior === "travel"
            ? {
                behavior,
                element,
                renderer: {
                  mount(context: FluidboxMountContext) {
                    const root = createRoot(context.target);
                    root.render(children);
                    return () => root.unmount();
                  },
                },
              }
            : { behavior, element };
        const disposers = ids
          .filter((candidate) => store.source.getIndex(candidate) !== null)
          .map((candidate) => store.controller.registerThumbnailOverlay(candidate, registration));
        disposeRef.current = () => {
          for (const dispose of disposers) dispose();
        };
      }
    };
    useEffect(() => () => disposeRef.current?.(), []);
    return createElement(
      "span",
      {
        ...attributes,
        ref: setRef,
        "data-fluidbox-thumbnail-overlay": "",
        "data-fluidbox-overlay-behavior": behavior,
      },
      children,
    );
  },
);

function action(
  name: "close" | "previous" | "next",
  label: string,
  disabled: (state: FluidboxState) => boolean,
) {
  return forwardRef<HTMLButtonElement, FluidboxActionProps>(function FluidboxAction(
    { children, onClick, ...attributes },
    ref,
  ) {
    const controller = useFluidbox();
    const isDisabled = useFluidboxState(disabled);
    return createElement(
      "button",
      {
        ...attributes,
        ref,
        type: attributes.type ?? "button",
        disabled: attributes.disabled ?? isDisabled,
        [`data-fluidbox-${name}`]: "",
        "aria-label": attributes["aria-label"] ?? (children == null ? label : undefined),
        onClick(event: ReactMouseEvent<HTMLButtonElement>) {
          onClick?.(event);
          if (!event.defaultPrevented) void controller[name]({ reason: "api" });
        },
      },
      children ?? defaultIcon(name),
    );
  });
}

function defaultIcon(part: ControlIconPart) {
  const {
    "stroke-width": strokeWidth,
    "stroke-linecap": strokeLinecap,
    "stroke-linejoin": strokeLinejoin,
    "aria-hidden": ariaHidden,
    ...attributes
  } = CONTROL_ICON_ATTRIBUTES;
  return createElement(
    "svg",
    {
      ...attributes,
      strokeWidth,
      strokeLinecap,
      strokeLinejoin,
      "aria-hidden": ariaHidden,
      "data-fluidbox-icon": "",
    },
    createElement("path", { d: CONTROL_ICON_PATHS[part] }),
  );
}

const Close = action("close", "Close", (state) => state.status === "closed");
const Previous = action("previous", "Previous", (state) => !state.canPrevious);
const Next = action("next", "Next", (state) => !state.canNext);

function FilmstripThumbnail({ item }: { item: FluidboxItem }) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const sources = filmstripThumbnailSources(item);
  const sourceKey = sources.join("\u0000");
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !sources.length) return;
    const controller = new AbortController();
    void loadFilmstripThumbnail(image, sources, controller.signal);
    return () => controller.abort();
  }, [sourceKey]);
  return createElement("img", {
    ref: imageRef,
    src: item.thumbnail?.src ?? item.preview?.src ?? sources[0],
    alt: "",
    draggable: false,
    "data-fluidbox-filmstrip-thumbnail": "",
  });
}

function Filmstrip<TItem extends FluidboxItem>({
  renderItem,
  children,
  ...attributes
}: FluidboxFilmstripProps<TItem>): ReactElement {
  const { store } = useFluidboxContext();
  const state = useFluidboxState((current) => current);
  const selectedIndex = state.requestedIndex ?? state.activeIndex ?? 0;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<FilmstripRuntime | null>(null);
  const [windowCenter, setWindowCenter] = useState(selectedIndex);
  const [visibleCount, setVisibleCount] = useState(31);
  const [filmstripGeometry, setFilmstripGeometry] = useState({ size: 52, step: 57 });

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const element = scroller?.parentElement;
    if (!scroller || !element) return;
    const dialog = scroller.closest<HTMLElement>("[data-fluidbox-dialog]");
    dialog?.setAttribute("data-filmstrip", "");
    const runtime = new FilmstripRuntime({
      element,
      scroller,
      count: state.count,
      index: selectedIndex,
      onSelect(index, settled) {
        if (!settled && store.state.requestedIndex === index) return;
        void store.controller.goTo({ index }, filmstripCommandOptions(settled));
      },
      onWindowChange(center, layout) {
        setWindowCenter(center);
        setVisibleCount(layout.visibleCount);
        setFilmstripGeometry({ size: layout.size, step: layout.step });
      },
    });
    runtimeRef.current = runtime;
    runtime.mount();
    return () => {
      dialog?.removeAttribute("data-filmstrip");
      runtime.destroy();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [state.count, store]);

  useLayoutEffect(() => {
    runtimeRef.current?.sync(selectedIndex);
  }, [selectedIndex]);

  const radius = Math.max(15, Math.ceil(visibleCount / 2));
  const start = Math.max(0, Math.min(windowCenter - radius, state.count - (radius * 2 + 1)));
  const end = Math.min(state.count, start + radius * 2 + 1);
  const items: ReactNode[] = [];
  for (let index = start; index < end; index += 1) {
    const item = store.source.getItem(index) as TItem;
    const selected = index === selectedIndex;
    items.push(
      createElement(
        "button",
        {
          key: item.id,
          type: "button",
          role: "option",
          "aria-label": item.media.type === "image" ? item.media.alt : item.media.title,
          "aria-selected": String(selected),
          "aria-posinset": index + 1,
          "aria-setsize": state.count,
          tabIndex: selected ? 0 : -1,
          "data-fluidbox-filmstrip-item": "",
          "data-index": index,
          "data-fluidbox-selected": selected ? "" : undefined,
          style: { left: `${index * filmstripGeometry.step}px` },
          onClick: () => runtimeRef.current?.choose(index),
        },
        renderItem
          ? renderItem({ item, index, selected })
          : filmstripThumbnailSources(item).length
            ? createElement(FilmstripThumbnail, { item })
            : item.id,
      ),
    );
  }
  return createElement(
    "div",
    { "data-fluidbox-filmstrip-dock": "" },
    createElement(
      "div",
      {
        ...attributes,
        "data-fluidbox-filmstrip": "",
        "aria-label": "Gallery filmstrip",
      },
      createElement(
        "div",
        {
          ref: scrollerRef,
          role: "listbox",
          "aria-label": "Choose a gallery item",
          "data-fluidbox-filmstrip-scroll": "",
        },
        createElement(
          "div",
          {
            "data-fluidbox-filmstrip-track": "",
            style: {
              width: `${Math.max(
                0,
                state.count * filmstripGeometry.step -
                  (filmstripGeometry.step - filmstripGeometry.size),
              )}px`,
            },
          },
          children ?? items,
        ),
      ),
    ),
  );
}

export function useFluidbox<
  TItem extends FluidboxItem = FluidboxItem,
>(): FluidboxController<TItem> {
  return useFluidboxContext().store.controller as FluidboxController<TItem>;
}

export function useFluidboxState<TSelected>(
  selector: (state: FluidboxState) => TSelected,
): TSelected {
  const { store } = useFluidboxContext();
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.state,
    () => store.state,
  );
  return selector(state);
}

/** The stop a sheet from `@ogdakke/fluidbox/sheet` rests at, re-rendering as it changes. */
export function useFluidboxSheet(sheet: Pick<FluidboxSheet, "stop" | "subscribe">): number {
  return useSyncExternalStore(
    (listener) => sheet.subscribe(listener),
    () => sheet.stop,
    () => sheet.stop,
  );
}

export const Fluidbox = {
  Root,
  Item,
  Trigger,
  Portal,
  Sheet,
  Content,
  ThumbnailOverlay,
  Close,
  Previous,
  Next,
  Filmstrip,
};

function setForwardedRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
