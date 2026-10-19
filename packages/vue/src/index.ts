import {
  Comment,
  Teleport,
  cloneVNode,
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  isVNode,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
  watchEffect,
  type ComputedRef,
  type InjectionKey,
  type PropType,
  type SetupContext,
  type ShallowRef,
  type SlotsType,
  type VNode,
  type VNodeChild,
} from "vue";
import {
  createFluidbox,
  type Fluidbox as FluidboxInstance,
  type FluidboxChangeEvent,
  type FluidboxControlName,
  type FluidboxFilmstripSlot,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxOriginAdapter,
  type FluidboxRenderContext,
  type FluidboxRenderer,
  type FluidboxSheetSnapPoint,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxToggleEvent,
} from "@ogdakke/fluidbox";
import {
  createDeferredFluidbox,
  createTrigger,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  idOf,
  latestOrigins,
  loadAddons,
  resolveLabels,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxApi,
  FluidboxFilmstripSlotProps,
  FluidboxSheetApi,
  FluidboxSheetSlotProps,
  FluidboxTriggerSlotProps,
  FluidboxVueRenderer,
} from "./types";

export type {
  FluidboxApi,
  FluidboxCommands,
  FluidboxFilmstripSlotProps,
  FluidboxSheetApi,
  FluidboxSheetSlotProps,
  FluidboxTriggerSlotProps,
  FluidboxVueRenderContext,
  FluidboxVueRenderer,
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

type AnyItem = FluidboxItem;

/** Content the runtime asked for, teleported from a part so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly render: () => VNodeChild;
}

/**
 * Teleports content into runtime targets until the returned dispose runs. The
 * owner patches at once both ways: the runtime may measure what it asked for,
 * and it empties a target right after the dispose, which must find Vue's nodes there.
 */
function useMounts() {
  const instance = getCurrentInstance()!;
  const list = shallowRef<readonly Mount[]>([]);
  let nextKey = 0;
  let live = true;
  onBeforeUnmount(() => (live = false));
  const patch = () => {
    if (live && instance.isMounted && !instance.isUnmounted) instance.update();
  };
  return {
    mount(target: HTMLElement, render: () => VNodeChild): () => void {
      const entry = { key: nextKey++, target, render };
      list.value = [...list.value, entry];
      patch();
      return () => {
        list.value = list.value.filter((candidate) => candidate !== entry);
        patch();
      };
    },
    render: () =>
      list.value.map(({ key, target, render }) => h(Teleport, { key, to: target }, [render()])),
  };
}

interface SheetPart {
  readonly options: () => {
    readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
    readonly dismiss?: "flight" | "scroll" | "none";
  };
  readonly render: FluidboxRenderer<AnyItem>;
}

/** The parts that turn viewer features on, as they are rendered inside Root. */
interface Features {
  viewers: number;
  filmstrip: { readonly slots: boolean } | null;
  sheet: SheetPart | null;
}

interface RootContext {
  /** Stands in for the viewer from the first render; commands before mount resolve false. */
  readonly fluidbox: FluidboxInstance<AnyItem>;
  /** The viewer once it exists, for parts that read its add-on handles. */
  readonly attached: Readonly<ShallowRef<FluidboxInstance<AnyItem> | null>>;
  readonly state: Readonly<ShallowRef<FluidboxState<AnyItem>>>;
  /** Changes whenever the item list does, so triggers and overlays register again. */
  readonly items: Readonly<ShallowRef<FluidboxItemList<AnyItem>>>;
  readonly labels: ComputedRef<FluidboxLabels>;
  readonly api: FluidboxApi<AnyItem>;
  readonly sheet: FluidboxSheetApi;
  readonly viewerTarget: Readonly<ShallowRef<HTMLElement | null>>;
  readonly features: Features;
}

const RootKey: InjectionKey<RootContext> = Symbol("fluidbox");
const ItemKey: InjectionKey<ComputedRef<FluidboxTarget>> = Symbol("fluidbox-item");
const TriggerKey: InjectionKey<ComputedRef<readonly FluidboxTarget[]>> = Symbol("fluidbox-trigger");

function useRootContext(part: string): RootContext {
  const context = inject(RootKey, null);
  if (!context) throw new Error(`<Fluidbox.${part}> must be rendered inside <Fluidbox.Root>.`);
  return context;
}

const toTarget = (value: AnyItem | FluidboxTarget): FluidboxTarget =>
  typeof value === "object" ? idOf(value) : value;

const sameLabels = (
  a: Partial<FluidboxLabels> | undefined,
  b: Partial<FluidboxLabels> | undefined,
) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a) as (keyof FluidboxLabels)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

const sameItems = (a: FluidboxItems<AnyItem>, b: FluidboxItems<AnyItem>) =>
  a === b ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => item === b[index]));

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The items, or a list read on demand. Reactive, also in place. */
  readonly items: FluidboxItems<TItem>;
  /** Your strings for the viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Pinch, double-tap, wheel and keyboard zoom of images. `false` turns it off. */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Draw `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxVueRenderer<TItem>>>;
  /** Find origins the viewer can't see, as in a virtualized grid. */
  readonly origins?: FluidboxOriginAdapter;
}

type RootEmits<TItem extends FluidboxItem> = {
  beforetoggle: (event: FluidboxToggleEvent) => true;
  toggle: (event: FluidboxToggleEvent) => true;
  beforeitemchange: (event: FluidboxChangeEvent<TItem>) => true;
  itemchange: (event: FluidboxChangeEvent<TItem>) => true;
  settle: (event: FluidboxChangeEvent<TItem>) => true;
};

type RootSlots<TItem extends FluidboxItem> = SlotsType<{
  default?: (fluidbox: FluidboxApi<TItem>) => VNode[];
}>;

/**
 * Owns one viewer per gallery. The viewer is made on mount, so Root is safe to
 * render on the server. The default slot gets the `useFluidbox()` object.
 */
const Root = defineComponent(
  <TItem extends FluidboxItem>(
    props: FluidboxRootProps<TItem>,
    { emit, slots }: SetupContext<RootEmits<TItem>, RootSlots<TItem>>,
  ) => {
    // Reading items one by one tracks in-place changes to a reactive array.
    const items = computed((): FluidboxItems<TItem> => {
      const value = props.items;
      return Array.isArray(value) ? value.map((item: TItem) => toRaw(item)) : toRaw(value);
    });
    const deferred = createDeferredFluidbox<TItem>(items.value);
    const fluidbox = deferred.fluidbox;
    const state = shallowRef(fluidbox.state);
    const list = shallowRef(fluidbox.items);
    const attached = shallowRef<FluidboxInstance<TItem> | null>(null);
    const viewerTarget = shallowRef<HTMLElement | null>(null);
    const sheetStop = shallowRef(0);
    const features = shallowReactive<Features>({ viewers: 0, filmstrip: null, sheet: null });
    const mounts = useMounts();

    const labelsInput = shallowRef(props.labels);
    watch(
      () => props.labels,
      (next) => {
        if (!sameLabels(labelsInput.value, next)) labelsInput.value = next;
      },
    );
    const labels = computed(() => resolveLabels(labelsInput.value));

    const unsubscribe = deferred.subscribe(() => {
      state.value = fluidbox.state;
      if (fluidbox.items !== list.value) list.value = fluidbox.items;
    });
    // An inline array of the same items, as `:items="[product]"`, changes nothing.
    watch(items, (next, previous) => {
      if (!sameItems(next, previous)) void fluidbox.setItems(next);
    });

    const events = new AbortController();
    for (const type of fluidboxEventTypes) {
      fluidbox.addEventListener(
        type,
        (event) => (emit as (type: string, event: Event) => void)(type, event),
        {
          signal: events.signal,
        },
      );
    }

    // Renderers resolve by name when a slide mounts, so the newest one is used
    // without rebuilding the viewer.
    const renderers = new Proxy({} as Record<string, FluidboxRenderer<TItem>>, {
      get(_, key) {
        const render = typeof key === "string" ? props.renderers?.[key] : undefined;
        if (!render) return undefined;
        return ({ item, index, target, signal }: FluidboxRenderContext<TItem>) =>
          mounts.mount(target, () => render({ item, index, signal }));
      },
      has: (_, key) => typeof key === "string" && !!props.renderers?.[key],
    });

    // What the viewer is built from. A change rebuilds it.
    const config = computed(() => {
      const zoom = props.zoom;
      const sheet = features.sheet?.options();
      return JSON.stringify({
        zoom: zoom === false ? false : { step: zoom?.step, max: zoom?.max },
        viewer: features.viewers > 0,
        filmstrip: features.filmstrip ? (features.filmstrip.slots ? "slots" : "on") : null,
        sheet: sheet ? { snapPoints: sheet.snapPoints, dismiss: sheet.dismiss } : null,
      });
    });

    onMounted(() => {
      const stop = watch(
        [config, labelsInput],
        (_, __, onCleanup) => {
          // The Filmstrip and Sheet parts load their add-ons, so only the ones rendered cost anything.
          const addons = [
            ...(features.filmstrip ? (["filmstrip"] as const) : []),
            ...(features.sheet ? (["sheet"] as const) : []),
          ];
          const loading = loadAddons(addons);
          let current = true;
          let dispose: (() => void) | undefined;
          onCleanup(() => {
            current = false;
            dispose?.();
          });
          if (!loading) dispose = build();
          else void loading.then(() => current && (dispose = build()));
        },
        { immediate: true },
      );
      onBeforeUnmount(stop);
    });

    /** Make the viewer from the parts and props now, and return what tears it down. */
    function build() {
      const { zoom } = props;
      const sheet = features.sheet?.options();
      const filmstrip = features.filmstrip;
      const real = createFluidbox<TItem>({
        items: items.value,
        labels: labelsInput.value && { ...labelsInput.value },
        zoom: zoom === false ? false : zoom && { step: zoom.step, max: zoom.max },
        renderers,
        origins: latestOrigins(() => props.origins),
        ...(features.viewers > 0
          ? {
              viewer: ({ target }) => {
                viewerTarget.value = target;
                return () => {
                  if (viewerTarget.value === target) viewerTarget.value = null;
                };
              },
            }
          : // Without a Viewer part, the viewer has the default controls.
            { controls: true }),
        filmstrip: filmstrip ? (filmstrip.slots ? { slots: true } : true) : undefined,
        sheet: sheet
          ? {
              snapPoints: sheet.snapPoints && [...sheet.snapPoints],
              dismiss: sheet.dismiss,
              render: (context) =>
                features.sheet?.render(context as FluidboxRenderContext<AnyItem>),
            }
          : undefined,
      });
      deferred.attach(real);
      attached.value = real;
      const handle = real.sheet;
      sheetStop.value = handle?.stop ?? 0;
      const unsubscribeSheet = handle?.subscribe((current) => (sheetStop.value = current));
      return () => {
        unsubscribeSheet?.();
        attached.value = null;
        deferred.detach();
        real.destroy();
      };
    }
    onBeforeUnmount(() => {
      unsubscribe();
      events.abort();
    });

    const api: FluidboxApi<TItem> = {
      get status() {
        return state.value.status;
      },
      get id() {
        return state.value.id;
      },
      get index() {
        return state.value.index;
      },
      get item() {
        return state.value.item;
      },
      get count() {
        return state.value.count;
      },
      get hasPrevious() {
        return state.value.hasPrevious;
      },
      get hasNext() {
        return state.value.hasNext;
      },
      open: (target) => fluidbox.open(target),
      close: () => fluidbox.close(),
      next: () => fluidbox.next(),
      previous: () => fluidbox.previous(),
      setItems: (next) => fluidbox.setItems(next),
    };
    const sheet: FluidboxSheetApi = {
      get stop() {
        return sheetStop.value;
      },
      set: (stop, options) => attached.value?.sheet?.set(stop, options),
    };

    provide(RootKey, {
      fluidbox: fluidbox as FluidboxInstance<AnyItem>,
      attached: attached as ShallowRef<FluidboxInstance<AnyItem> | null>,
      state: state as ShallowRef<FluidboxState<AnyItem>>,
      items: list as ShallowRef<FluidboxItemList<AnyItem>>,
      labels,
      api: api as FluidboxApi<AnyItem>,
      sheet,
      viewerTarget,
      features,
    });
    return () => [slots.default?.(api), ...mounts.render()];
  },
  {
    name: "FluidboxRoot",
    props: ["items", "labels", "zoom", "renderers", "origins"],
    emits: [...fluidboxEventTypes],
  },
);

export interface FluidboxItemProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The item, or its index or id. */
  readonly item: TItem | FluidboxTarget;
}

/** Scopes an item for the Trigger and ThumbnailOverlay inside. */
const Item = defineComponent(
  <TItem extends FluidboxItem>(props: FluidboxItemProps<TItem>, { slots }: SetupContext) => {
    provide(
      ItemKey,
      computed(() => toTarget(props.item)),
    );
    return () => slots.default?.();
  },
  {
    name: "FluidboxItem",
    props: ["item"],
  },
);

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Decorate the one child instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /** The item this trigger opens, or its index or id. Defaults to the first of `items` or the enclosing Item. */
  readonly item?: TItem | FluidboxTarget;
  /** Every item that may close back onto this trigger, as an album cover's. */
  readonly items?: readonly (TItem | FluidboxTarget)[];
}

type TriggerSlots<TItem extends FluidboxItem> = SlotsType<{
  default?: (preview: FluidboxTriggerSlotProps<TItem>) => VNode[];
}>;

/**
 * Opens an item. Renders a `<button>`, or with `as-child` decorates its one
 * child. The default slot gets `{ item, index, status }`: the item it shows,
 * which follows the viewer while it is open.
 */
const Trigger = defineComponent(
  <TItem extends FluidboxItem>(
    props: FluidboxTriggerProps<TItem>,
    { attrs, slots }: SetupContext<{}, TriggerSlots<TItem>>,
  ) => {
    const { fluidbox, state, items } = useRootContext("Trigger");
    const enclosing = inject(ItemKey, null);
    const instance = getCurrentInstance()!;
    // The opened item comes first; the rest may close back onto this trigger.
    const targets = computed(() => {
      const first = props.item ?? props.items?.[0] ?? enclosing?.value;
      if (first === undefined) {
        throw new Error("<Fluidbox.Trigger> needs item, items, or an enclosing <Fluidbox.Item>.");
      }
      return [...new Set([first, ...(props.items ?? [])].map(toTarget))];
    });
    // Read by render, so the forced update below sees a change.
    const previewed = shallowRef(0);
    const options = () => ({
      targets: targets.value,
      // The closing flight measures right after this, so patch the DOM now.
      onPreviewChange() {
        previewed.value++;
        if (!instance.isUnmounted) instance.update();
      },
    });
    const trigger = createTrigger(fluidbox, options());
    watch(targets, () => trigger.update(options()));
    watch(items, () => trigger.refresh(), { flush: "post" });
    onBeforeUnmount(() => trigger.destroy());
    provide(TriggerKey, targets);

    const handlers = {
      ref: (value: unknown) => trigger.setElement(toElement(value)),
      onClick: (event: MouseEvent) => trigger.click(event),
      onPointerdown: (event: PointerEvent) => trigger.pointerDown(event),
      onPointerup: () => trigger.pointerUp(),
      onPointercancel: () => trigger.pointerCancel(),
    };

    return () => {
      void previewed.value;
      const preview = trigger.preview(state.value) as FluidboxTriggerSlotProps<TItem>;
      const rendered = slots.default?.(preview) ?? [];
      // Your handlers come first in the merge, so preventDefault stops the open.
      const asChild = props.asChild as boolean | "" | undefined;
      if (asChild === true || asChild === "")
        return cloneVNode(onlyChild(rendered), mergeProps(attrs, handlers), true);
      return h("button", mergeProps({ type: "button" }, attrs, handlers), rendered);
    };
  },
  {
    name: "FluidboxTrigger",
    inheritAttrs: false,
    // Declared by name to keep the item type generic; `as-child` arrives as "".
    props: ["asChild", "item", "items"],
  },
);

/**
 * Your own content in the viewer: controls, captions, buttons that move the
 * sheet. Without a Viewer, the viewer has the default Previous, Next and Close.
 */
const Viewer = defineComponent({
  name: "FluidboxViewer",
  setup(_, { slots }) {
    const { features, viewerTarget } = useRootContext("Viewer");
    features.viewers++;
    onBeforeUnmount(() => features.viewers--);
    return () =>
      viewerTarget.value ? h(Teleport, { to: viewerTarget.value }, slots.default?.() ?? []) : null;
  },
});

/**
 * Content over a trigger's thumbnail, such as a count. It follows the viewer's
 * motion through `--fluidbox-progress`, and with `travel` it flies with the photo.
 */
const ThumbnailOverlay = defineComponent({
  name: "FluidboxThumbnailOverlay",
  inheritAttrs: false,
  props: {
    /** Fly with the photo as the viewer opens and closes. */
    travel: Boolean,
  },
  setup(props, { attrs, slots }) {
    const { fluidbox, items } = useRootContext("ThumbnailOverlay");
    const enclosing = inject(ItemKey, null);
    const targets =
      inject(TriggerKey, null) ?? (enclosing ? computed(() => [enclosing.value]) : null);
    if (!targets) {
      throw new Error("<Fluidbox.ThumbnailOverlay> needs an enclosing Trigger or Item.");
    }
    const element = shallowRef<HTMLElement | null>(null);
    const mounts = useMounts();
    watchEffect(
      (onCleanup) => {
        const target = element.value;
        void items.value;
        if (!target) return;
        onCleanup(
          fluidbox.bindOverlay(
            target,
            targets.value,
            props.travel
              ? { travel: (context) => mounts.mount(context.target, () => slots.default?.()) }
              : {},
          ),
        );
      },
      { flush: "post" },
    );
    return () => [
      h(
        "span",
        mergeProps(attrs, {
          ref: element,
          "data-fluidbox-thumbnail-overlay": props.travel ? "travel" : "",
        }),
        slots.default?.(),
      ),
      ...mounts.render(),
    ];
  },
});

function control(name: FluidboxControlName, displayName: string) {
  const definition = fluidboxControls[name];
  return defineComponent({
    name: displayName,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const { fluidbox, state, labels } = useRootContext(displayName.slice("Fluidbox".length));
      const run = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        // Prevented, so the viewer's own handling of the attribute skips it.
        event.preventDefault();
        void definition.run(fluidbox, event);
      };
      return () => {
        const children = slots.default?.();
        return h(
          "button",
          mergeProps(
            {
              type: "button",
              disabled: definition.disabled(state.value),
              [definition.attribute]: "",
              "data-fluidbox-managed": "",
              "aria-label": children ? undefined : definition.label(labels.value),
            },
            attrs,
            { onClick: run },
          ),
          children ?? [controlIcon(name)],
        );
      };
    },
  });
}

function controlIcon(name: FluidboxControlName): VNode {
  return h("svg", { ...fluidboxControlIcon.attributes, "data-fluidbox-icon": "" }, [
    h("path", { d: fluidboxControlIcon.paths[name] }),
  ]);
}

/** Closes the viewer. With no content, it shows the default icon and label. */
const Close = control("close", "FluidboxClose");
/** Moves to the previous item. */
const Previous = control("previous", "FluidboxPrevious");
/** Moves to the next item. */
const Next = control("next", "FluidboxNext");

/** The default Previous, Next and Close, for a Viewer with content of its own. */
const Controls = defineComponent({
  name: "FluidboxControls",
  setup() {
    useRootContext("Controls");
    return () => [h(Previous), h(Next), h(Close)];
  },
});

/**
 * Turns the filmstrip on. With a default slot, it fills each thumbnail button,
 * getting `{ item, index }`; the selected button has `data-fluidbox-selected`.
 */
const Filmstrip = defineComponent({
  name: "FluidboxFilmstrip",
  slots: Object as SlotsType<{ default?: (thumbnail: FluidboxFilmstripSlotProps) => VNode[] }>,
  setup(_, { slots }) {
    const { features, attached } = useRootContext("Filmstrip");
    const custom = !!slots.default;
    const part = { slots: custom };
    features.filmstrip = part;
    onBeforeUnmount(() => {
      if (features.filmstrip === part) features.filmstrip = null;
    });
    const strip = shallowRef<readonly FluidboxFilmstripSlot<AnyItem>[]>([]);
    watchEffect((onCleanup) => {
      const handle = custom ? attached.value?.filmstrip : null;
      strip.value = handle?.slots ?? [];
      if (handle) onCleanup(handle.subscribe(() => (strip.value = handle.slots)));
    });
    return () =>
      strip.value.map(({ item, index, target }) =>
        h(Teleport, { key: idOf(item), to: target }, slots.default?.({ item, index }) ?? []),
      );
  },
});

export interface FluidboxSheetProps {
  /**
   * The stops above the resting one, lowest first.
   * @default ["60%", "content"]
   */
  readonly snapPoints?: readonly FluidboxSheetSnapPoint[];
  /**
   * What a swipe down on the photo does with the sheet down.
   * @default "flight"
   */
  readonly dismiss?: "flight" | "scroll" | "none";
}

/**
 * Turns the sheet on: a panel over the photo for the active item's details.
 * The default slot is its content and gets `{ item, index, stop, set }`.
 * Import `@ogdakke/fluidbox/sheet.css` once.
 */
const Sheet = defineComponent({
  name: "FluidboxSheet",
  props: {
    snapPoints: Array as PropType<readonly FluidboxSheetSnapPoint[]>,
    dismiss: String as PropType<FluidboxSheetProps["dismiss"]>,
  },
  slots: Object as SlotsType<{ default?: (sheet: FluidboxSheetSlotProps) => VNode[] }>,
  setup(props, { slots }) {
    const { features, sheet } = useRootContext("Sheet");
    const mounts = useMounts();
    const part: SheetPart = {
      options: () => ({ snapPoints: props.snapPoints, dismiss: props.dismiss }),
      render: ({ item, index, target }) =>
        mounts.mount(target, () =>
          slots.default?.({
            item,
            index,
            stop: sheet.stop,
            set: (stop, options) => sheet.set(stop, options),
          }),
        ),
    };
    features.sheet = part;
    onBeforeUnmount(() => {
      if (features.sheet === part) features.sheet = null;
    });
    return mounts.render;
  },
});

/**
 * A button that moves the sheet to `stop`, or back down when it is there. It
 * works in the viewer, as in a Viewer or the Sheet.
 */
const SheetStop = defineComponent({
  name: "FluidboxSheetStop",
  props: { stop: { type: Number, required: true } },
  setup(props, { slots }) {
    useRootContext("SheetStop");
    return () =>
      h(
        "button",
        { type: "button", "data-fluidbox-sheet-stop": String(props.stop) },
        slots.default?.(),
      );
  },
});

/**
 * The viewer's state and commands, in one reactive object, or a part of it
 * picked by `selector` as a computed ref. Call it in a component inside Root.
 */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem, TSelected = unknown>(
  selector: (fluidbox: FluidboxApi<TItem>) => TSelected,
): ComputedRef<TSelected>;
export function useFluidbox<TItem extends FluidboxItem, TSelected>(
  selector?: (fluidbox: FluidboxApi<TItem>) => TSelected,
): FluidboxApi<TItem> | ComputedRef<TSelected> {
  const { api } = useRootContext("Root");
  const typed = api as unknown as FluidboxApi<TItem>;
  return selector ? computed(() => selector(typed)) : typed;
}

/** The sheet's stop and a setter, in one reactive object. Call it in a component inside Root. */
export function useFluidboxSheet(): FluidboxSheetApi {
  return useRootContext("Sheet").sheet;
}

/** Every part, as `<Fluidbox.Root>` and so on. */
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

/** The element behind a ref, which is a component instance when the child is a component. */
function toElement(value: unknown): HTMLElement | null {
  if (!value || typeof HTMLElement === "undefined") return null;
  if (value instanceof HTMLElement) return value;
  const element = (value as { $el?: unknown }).$el;
  return element instanceof HTMLElement ? element : null;
}

function onlyChild(vnodes: readonly VNode[]): VNode {
  const elements = vnodes.filter((vnode) => isVNode(vnode) && vnode.type !== Comment);
  if (elements.length !== 1) {
    throw new Error("<Fluidbox.Trigger as-child> needs exactly one child element.");
  }
  return elements[0]!;
}
