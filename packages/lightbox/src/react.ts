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
import { createLightbox } from "./create-lightbox";
import { FilmstripRuntime, filmstripCommandOptions } from "./filmstrip-runtime";
import { filmstripThumbnailSources, loadFilmstripThumbnail } from "./filmstrip-thumbnail";
import { markedVisualOrigin } from "./origin-geometry";
import type {
  LightboxCommandResult,
  LightboxController,
  LightboxDispose,
  LightboxItem,
  LightboxItemId,
  LightboxMountContext,
  LightboxOptions,
  LightboxOrigin,
  LightboxRenderer,
  LightboxSource,
  LightboxState,
} from "./public-api";
import type {
  LightboxActionProps,
  LightboxContentProps,
  LightboxFilmstripProps,
  LightboxItemProps,
  LightboxPortalProps,
  LightboxRootProps,
  LightboxThumbnailOverlayProps,
  LightboxTriggerProps,
} from "./react-public-api";

export type {
  LightboxActionProps,
  LightboxContentProps,
  LightboxFilmstripProps,
  LightboxFilmstripRenderContext,
  LightboxItemProps,
  LightboxPortalProps,
  LightboxReactParts,
  LightboxReactRenderer,
  LightboxReactRenderContext,
  LightboxRootProps,
  LightboxThumbnailOverlayProps,
  LightboxTriggerProps,
  LightboxTriggerRenderContext,
  UseLightbox,
  UseLightboxState,
} from "./react-public-api";

const closedState = (count: number): LightboxState =>
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

class ReactLightboxStore<TItem extends LightboxItem = LightboxItem> {
  #controller: LightboxController<TItem> | null = null;
  #source: LightboxSource<TItem>;
  #state: LightboxState;
  #unsubscribe: LightboxDispose | undefined;
  readonly #listeners = new Set<() => void>();
  readonly #registrations = new Set<{
    attach(controller: LightboxController<TItem>): void;
    detach(): void;
  }>();

  constructor(source: LightboxSource<TItem>) {
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
    } satisfies LightboxController<TItem>;
    Object.defineProperty(controller, "state", { get: () => this.#state });
    this.controller = controller;
  }

  readonly controller: LightboxController<TItem>;

  get source(): LightboxSource<TItem> {
    return this.#source;
  }

  get state(): LightboxState {
    return this.#state;
  }

  attach(controller: LightboxController<TItem>) {
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

  setSource(source: LightboxSource<TItem>): Promise<LightboxCommandResult> {
    this.#source = source;
    if (this.#controller) return this.#controller.setSource(source);
    this.#state = closedState(source.count);
    this.#notify();
    return Promise.resolve({ status: "completed", changed: false });
  }

  subscribe(listener: () => void): LightboxDispose {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #command(
    command: (controller: LightboxController<TItem>) => Promise<LightboxCommandResult>,
  ): Promise<LightboxCommandResult> {
    const controller = this.#controller;
    if (!controller) return Promise.resolve({ status: "aborted" });
    return command(controller);
  }

  #registration(register: (controller: LightboxController<TItem>) => LightboxDispose) {
    let dispose: LightboxDispose | undefined;
    const registration = {
      attach(controller: LightboxController<TItem>) {
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

interface ReactLightboxContextValue {
  readonly store: ReactLightboxStore<any>;
  readonly portalTarget: HTMLElement | null;
}

const LightboxContext = createContext<ReactLightboxContextValue | null>(null);
const ItemContext = createContext<LightboxItemId | null>(null);
const TriggerContext = createContext<readonly LightboxItemId[] | null>(null);

function useLightboxContext(): ReactLightboxContextValue {
  const value = useContext(LightboxContext);
  if (!value) throw new Error("Lightbox components must be rendered inside <Lightbox.Root>.");
  return value;
}

function Root<TItem extends LightboxItem>({
  source,
  items,
  origins,
  renderers,
  onBeforeCommand,
  onEvent,
  children,
}: LightboxRootProps<TItem>): ReactElement {
  const resolvedSource = useMemo(() => source ?? arraySource(items!), [source, items]);
  const storeRef = useRef<ReactLightboxStore<TItem> | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ReactLightboxStore(resolvedSource);
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
            } satisfies LightboxRenderer<TItem>,
          ]),
        )
      : undefined;
    const options: LightboxOptions<TItem> = {
      source: store.source,
      origins,
      renderers: runtimeRenderers,
      onBeforeCommand,
      onEvent,
      portal: {
        mount(context) {
          setPortalTarget(context.target);
          return () => setPortalTarget((target) => (target === context.target ? null : target));
        },
      },
    };
    const controller = createLightbox(options);
    store.attach(controller);
    return () => {
      store.detach();
      controller.destroy();
    };
  }, [onBeforeCommand, onEvent, origins, renderers, store]);

  useLayoutEffect(() => {
    void store.setSource(resolvedSource);
  }, [resolvedSource, store]);

  const value = useMemo<ReactLightboxContextValue>(
    () => ({ store, portalTarget }),
    [store, portalTarget],
  );
  return createElement(LightboxContext.Provider, { value }, children);
}

function Item({ id, children }: LightboxItemProps): ReactElement {
  return createElement(ItemContext.Provider, { value: id }, children);
}

function Trigger<TItem extends LightboxItem>({
  asChild = false,
  item,
  items,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...attributes
}: LightboxTriggerProps<TItem>) {
  const { store } = useLightboxContext();
  const enclosingId = useContext(ItemContext);
  const itemId = (value: TItem | string): string => (typeof value === "string" ? value : value.id);
  const id = item ? itemId(item) : items?.[0] ? itemId(items[0]) : enclosingId;
  if (!id)
    throw new Error("<Lightbox.Trigger> needs item, items, or an enclosing <Lightbox.Item>.");
  const ids = items ? [...new Set(items.map(itemId))] : [id];
  if (!ids.includes(id)) ids.unshift(id);
  const state = useLightboxState((current) => current);
  const [lastPreviewId, setLastPreviewId] = useState<string | null>(null);
  const activeId = state.activeId && ids.includes(state.activeId) ? state.activeId : null;
  const previewId = activeId ?? lastPreviewId ?? id;
  const previewIndex = store.source.getIndex(previewId) ?? store.source.getIndex(id);
  const previewItem = previewIndex === null ? null : (store.source.getItem(previewIndex) as TItem);
  const rendered =
    typeof children === "function"
      ? children({
          item: previewItem,
          index: previewIndex,
          status: activeId ? state.status : "closed",
        })
      : children;
  const disposeRef = useRef<LightboxDispose | undefined>(undefined);
  const preparationRef = useRef<LightboxDispose | undefined>(undefined);
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
      element.querySelector<HTMLElement>("[data-lightbox-origin]") ??
      markedVisualOrigin(element) ??
      (element.matches("img, video")
        ? element
        : (element.querySelector<HTMLElement>("img, video") ?? element));
    const thumbnail = visual.matches("img")
      ? (visual as HTMLImageElement)
      : (visual.querySelector("img") ?? undefined);
    const origin: LightboxOrigin = {
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
    preparationRef.current = store.controller.prepare({ id });
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
    if (!event.defaultPrevented) void store.controller.open({ id }, { reason: "trigger" });
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

function Portal({ children }: LightboxPortalProps): ReactElement | null {
  const { portalTarget } = useLightboxContext();
  return portalTarget ? createPortal(children, portalTarget) : null;
}

const Content = forwardRef<HTMLDivElement, LightboxContentProps>(function Content(
  { children, ...attributes },
  ref,
) {
  return createElement("div", { ...attributes, ref, "data-lightbox-content": "" }, children);
});

const ThumbnailOverlay = forwardRef<HTMLSpanElement, LightboxThumbnailOverlayProps>(
  function ThumbnailOverlay({ behavior = "host", children, ...attributes }, forwardedRef) {
    const { store } = useLightboxContext();
    const id = useContext(ItemContext);
    const triggerIds = useContext(TriggerContext);
    const ids = triggerIds ?? (id ? [id] : null);
    if (!ids) throw new Error("<Lightbox.ThumbnailOverlay> needs an enclosing Trigger or Item.");
    const disposeRef = useRef<LightboxDispose | undefined>(undefined);
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
                  mount(context: LightboxMountContext) {
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
        "data-lightbox-thumbnail-overlay": "",
        "data-lightbox-overlay-behavior": behavior,
      },
      children,
    );
  },
);

function action(
  name: "close" | "previous" | "next",
  label: string,
  disabled: (state: LightboxState) => boolean,
) {
  return forwardRef<HTMLButtonElement, LightboxActionProps>(function LightboxAction(
    { children, onClick, ...attributes },
    ref,
  ) {
    const controller = useLightbox();
    const isDisabled = useLightboxState(disabled);
    return createElement(
      "button",
      {
        ...attributes,
        ref,
        type: attributes.type ?? "button",
        disabled: attributes.disabled ?? isDisabled,
        [`data-lightbox-${name}`]: "",
        onClick(event: ReactMouseEvent<HTMLButtonElement>) {
          onClick?.(event);
          if (!event.defaultPrevented) void controller[name]({ reason: "api" });
        },
      },
      children ?? label,
    );
  });
}

const Close = action("close", "Close", (state) => state.status === "closed");
const Previous = action("previous", "Previous", (state) => !state.canPrevious);
const Next = action("next", "Next", (state) => !state.canNext);

function FilmstripThumbnail({ item }: { item: LightboxItem }) {
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
    "data-lightbox-filmstrip-thumbnail": "",
  });
}

function Filmstrip<TItem extends LightboxItem>({
  renderItem,
  children,
  ...attributes
}: LightboxFilmstripProps<TItem>): ReactElement {
  const { store } = useLightboxContext();
  const state = useLightboxState((current) => current);
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
    const dialog = scroller.closest<HTMLElement>("[data-lightbox-dialog]");
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
          "data-lightbox-filmstrip-item": "",
          "data-index": index,
          "data-lightbox-selected": selected ? "" : undefined,
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
    { "data-lightbox-filmstrip-dock": "" },
    createElement(
      "div",
      {
        ...attributes,
        "data-lightbox-filmstrip": "",
        "aria-label": "Gallery filmstrip",
      },
      createElement(
        "div",
        {
          ref: scrollerRef,
          role: "listbox",
          "aria-label": "Choose a gallery item",
          "data-lightbox-filmstrip-scroll": "",
        },
        createElement(
          "div",
          {
            "data-lightbox-filmstrip-track": "",
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

export function useLightbox<
  TItem extends LightboxItem = LightboxItem,
>(): LightboxController<TItem> {
  return useLightboxContext().store.controller as LightboxController<TItem>;
}

export function useLightboxState<TSelected>(
  selector: (state: LightboxState) => TSelected,
): TSelected {
  const { store } = useLightboxContext();
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.state,
    () => store.state,
  );
  return selector(state);
}

export const Lightbox = {
  Root,
  Item,
  Trigger,
  Portal,
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
