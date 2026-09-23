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
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode, Ref } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { createLightbox } from "./create-lightbox";
import type {
  LightboxCommandResult,
  LightboxController,
  LightboxDispose,
  LightboxItem,
  LightboxItemId,
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

function useLightboxContext(): ReactLightboxContextValue {
  const value = useContext(LightboxContext);
  if (!value) throw new Error("Lightbox components must be rendered inside <Lightbox.Root>.");
  return value;
}

function Root<TItem extends LightboxItem>({
  source,
  origins,
  renderers,
  onBeforeCommand,
  onEvent,
  children,
}: LightboxRootProps<TItem>): ReactElement {
  const storeRef = useRef<ReactLightboxStore<TItem> | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ReactLightboxStore(source);
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

  useEffect(() => {
    void store.setSource(source);
  }, [source, store]);

  const value = useMemo<ReactLightboxContextValue>(
    () => ({ store, portalTarget }),
    [store, portalTarget],
  );
  return createElement(LightboxContext.Provider, { value }, children);
}

function Item({ id, children }: LightboxItemProps): ReactElement {
  return createElement(ItemContext.Provider, { value: id }, children);
}

function Trigger({ asChild = false, children, onClick, ...attributes }: LightboxTriggerProps) {
  const { store } = useLightboxContext();
  const id = useContext(ItemContext);
  if (!id) throw new Error("<Lightbox.Trigger> must be rendered inside <Lightbox.Item>.");
  const disposeRef = useRef<LightboxDispose | undefined>(undefined);
  const child = Children.only(children);
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
    const visual = element.querySelector<HTMLElement>("[data-lightbox-origin]") ?? element;
    const thumbnail = visual.matches("img")
      ? (visual as HTMLImageElement)
      : (visual.querySelector("img") ?? undefined);
    const origin: LightboxOrigin = { trigger: element, visual, thumbnail };
    disposeRef.current = store.controller.registerOrigin(id, origin);
  };
  useEffect(() => () => disposeRef.current?.(), []);
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const childClick = childProps.onClick as
      | ((event: ReactMouseEvent<HTMLButtonElement>) => void)
      | undefined;
    childClick?.(event);
    onClick?.(event);
    if (!event.defaultPrevented) void store.controller.open({ id }, { reason: "trigger" });
  };

  if (asChild) {
    return cloneElement(child, { ...attributes, ref: setRef, onClick: handleClick } as never);
  }
  return createElement(
    "button",
    { ...attributes, ref: setRef, onClick: handleClick, type: attributes.type ?? "button" },
    child,
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
    if (!id)
      throw new Error("<Lightbox.ThumbnailOverlay> must be rendered inside <Lightbox.Item>.");
    const disposeRef = useRef<LightboxDispose | undefined>(undefined);
    const setRef = (element: HTMLSpanElement | null) => {
      disposeRef.current?.();
      disposeRef.current = undefined;
      setForwardedRef(forwardedRef, element);
      if (element)
        disposeRef.current = store.controller.registerThumbnailOverlay(id, {
          behavior,
          element,
        });
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

function Filmstrip<TItem extends LightboxItem>({
  renderItem,
  children,
  ...attributes
}: LightboxFilmstripProps<TItem>): ReactElement {
  const { store } = useLightboxContext();
  const state = useLightboxState((current) => current);
  const selectedIndex = state.requestedIndex ?? state.activeIndex ?? 0;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollFrame = useRef(0);
  const [windowCenter, setWindowCenter] = useState(selectedIndex);
  const [visibleCount, setVisibleCount] = useState(31);

  const readGeometry = (scroller: HTMLDivElement) => {
    const filmstrip = scroller.parentElement;
    const size =
      parseFloat(
        filmstrip
          ? getComputedStyle(filmstrip).getPropertyValue("--lightbox-filmstrip-item-size")
          : "",
      ) || 52;
    const style = getComputedStyle(scroller);
    const gap = parseFloat(style.columnGap) || 0;
    const padding = parseFloat(style.paddingLeft) || 0;
    return { size, step: size + gap, padding };
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const dialog = scroller.closest<HTMLElement>("[data-lightbox-dialog]");
    dialog?.setAttribute("data-filmstrip", "");
    const updateWindow = () => {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        const { size, step, padding } = readGeometry(scroller);
        const center = Math.round(
          (scroller.scrollLeft + scroller.clientWidth / 2 - padding - size / 2) / step,
        );
        setWindowCenter(Math.max(0, Math.min(state.count - 1, center)));
      });
    };
    const resize = new ResizeObserver(() => {
      const { step } = readGeometry(scroller);
      setVisibleCount(Math.ceil(scroller.clientWidth / step) * 2 + 9);
      updateWindow();
    });
    resize.observe(scroller);
    scroller.addEventListener("scroll", updateWindow, { passive: true });
    updateWindow();
    return () => {
      dialog?.removeAttribute("data-filmstrip");
      resize.disconnect();
      scroller.removeEventListener("scroll", updateWindow);
      cancelAnimationFrame(scrollFrame.current);
    };
  }, [state.count]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || state.count === 0) return;
    const { size, step, padding } = readGeometry(scroller);
    const left = padding + selectedIndex * step + size / 2 - scroller.clientWidth / 2;
    setWindowCenter(selectedIndex);
    scroller.scrollTo({ left: Math.max(0, left), behavior: "instant" });
  }, [selectedIndex, state.count]);

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
          style: { left: `calc(${index} * (var(--lightbox-filmstrip-item-size) + 5px))` },
          onClick: () => void store.controller.goTo({ index }, { reason: "filmstrip" }),
        },
        renderItem
          ? renderItem({ item, index, selected })
          : item.thumbnail?.src
            ? createElement("img", {
                src: item.thumbnail.src,
                alt: "",
                draggable: false,
                "data-lightbox-filmstrip-thumbnail": "",
              })
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
              width: `calc(${state.count} * (var(--lightbox-filmstrip-item-size) + 5px) - 5px)`,
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
