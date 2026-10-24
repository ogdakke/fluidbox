/** The Vue binding: the `Fluidbox` components and the `useFluidbox` and `useFluidboxSheet` composables. */
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
  normalizeClass,
  normalizeStyle,
  onBeforeUnmount,
  onMounted,
  onUpdated,
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
  type FluidboxControlName,
  type FluidboxFilmstripOptions,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxItems,
  type FluidboxLabels,
  type FluidboxLoading,
  type FluidboxOptions,
  type FluidboxRenderer,
  type FluidboxSlide,
  type FluidboxSlideRenderer,
  type FluidboxSlides,
  type FluidboxSheetEvent,
  type FluidboxSheetOptions,
  type FluidboxSheetSnapPoint,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxValueChangeEvent,
  type FluidboxUpdateOptions,
  type FluidboxViewerRenderer,
  type FluidboxZoomEvent,
} from "@ogdakke/fluidbox";
import {
  createSlots,
  createTrigger,
  fluidboxControlIcon,
  fluidboxControls,
  fluidboxEventTypes,
  latestFindTrigger,
  resolveLabels,
  createOpenIndexSync,
  unloadFluidbox,
  watchOpenIndex,
  zoomControlNames,
  type FluidboxChangeDetails,
  type FluidboxSlot,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxApi,
  FluidboxItemContext,
  FluidboxSheetApi,
  FluidboxVueRenderer,
} from "./types";

export type {
  FluidboxApi,
  FluidboxCommands,
  FluidboxItemContext,
  FluidboxSheetApi,
  FluidboxVueRenderContext,
  FluidboxVueRenderer,
} from "./types";
export type { FluidboxChangeDetails, FluidboxTriggerPreview } from "@ogdakke/fluidbox/kit";
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
  FluidboxLoading,
  FluidboxReason,
  FluidboxSheetEvent,
  FluidboxSheetSnapPoint,
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
  FluidboxZoomState,
} from "@ogdakke/fluidbox";

type AnyItem = FluidboxItem;

/** Content the runtime asked for, teleported from a part so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly render: () => VNodeChild;
}

/**
 * Patches the current component at once, for content the runtime asked for:
 * it may measure what it asked for, and it empties a target right after the
 * dispose, which must find Vue's nodes there.
 */
function usePatch() {
  const instance = getCurrentInstance()!;
  let live = true;
  onBeforeUnmount(() => (live = false));
  return () => {
    if (live && instance.isMounted && !instance.isUnmounted) instance.update();
  };
}

/** Teleports content into runtime targets until the returned dispose runs. */
function useMounts() {
  const patch = usePatch();
  const list = shallowRef<readonly Mount[]>([]);
  let nextKey = 0;
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

/** The kit's slots for a sheet or a filmstrip, as a list this component renders at once. */
function useRuntimeSlots(onChange?: (slots: readonly FluidboxSlot<AnyItem>[]) => void) {
  const patch = usePatch();
  const runtime = createSlots<AnyItem>();
  const list = shallowRef<readonly FluidboxSlot<AnyItem>[]>([]);
  const keys = new WeakMap<FluidboxSlot<AnyItem>, number>();
  let nextKey = 0;
  const unsubscribe = runtime.subscribe(() => {
    list.value = runtime.slots;
    for (const slot of runtime.slots) if (!keys.has(slot)) keys.set(slot, nextKey++);
    onChange?.(runtime.slots);
    patch();
  });
  onBeforeUnmount(unsubscribe);
  return {
    /** Stable, so passing it again to `update` remounts nothing. */
    render: runtime.render,
    list,
    teleport: (content: (slot: FluidboxSlot<AnyItem>) => VNodeChild) =>
      list.value.map((slot) =>
        h(Teleport, { key: keys.get(slot), to: slot.target }, [content(slot)]),
      ),
  };
}

interface FilmstripPart {
  readonly options: () => true | FluidboxFilmstripOptions<AnyItem>;
}

interface SheetPart {
  readonly options: () => FluidboxSheetOptions<AnyItem>;
}

/** The parts that turn viewer features on, as they are rendered inside Root. */
interface Features {
  viewers: number;
  filmstrip: FilmstripPart | null;
  sheet: SheetPart | null;
}

interface RootContext {
  /** Made in Root's setup; it touches nothing until a viewer is pressed or opened. */
  readonly fluidbox: FluidboxInstance<AnyItem>;
  readonly state: Readonly<ShallowRef<FluidboxState<AnyItem>>>;
  /** Changes whenever the item list does, so triggers and overlays register again. */
  readonly items: Readonly<ShallowRef<FluidboxItemList<AnyItem>>>;
  readonly labels: ComputedRef<FluidboxLabels>;
  readonly api: FluidboxApi<AnyItem>;
  readonly sheet: FluidboxSheetApi;
  readonly viewerTarget: Readonly<ShallowRef<HTMLElement | null>>;
  readonly features: Features;
}

interface TriggerContext {
  readonly target: () => FluidboxTarget<AnyItem>;
  readonly returns: () => readonly FluidboxTarget<AnyItem>[] | undefined;
}

interface OverlayContext {
  readonly layer: ShallowRef<HTMLElement | null>;
}

const RootKey: InjectionKey<RootContext> = Symbol("fluidbox");
const TriggerKey: InjectionKey<TriggerContext> = Symbol("fluidbox-trigger");
const OverlayKey: InjectionKey<OverlayContext> = Symbol("fluidbox-overlay");
/** Provided inside the copy of an overlay that flies with the photo. */
const TravelKey: InjectionKey<true> = Symbol("fluidbox-travel");

function useRootContext(part: string): RootContext {
  const context = inject(RootKey, null);
  if (!context) throw new Error(`<Fluidbox.${part}> must be rendered inside <Fluidbox.Root>.`);
  return context;
}

/** Equal members, one level down; arrays compare element by element. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => each === b[index])
    );
  }
  const keys = Object.keys(a);
  const other = b as Record<string, unknown>;
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => same((a as Record<string, unknown>)[key], other[key]))
  );
}

const settingKeys = ["labels", "zoom", "loop", "viewer", "filmstrip", "sheet", "loading"] as const;
type Settings = {
  -readonly [K in (typeof settingKeys)[number]]: FluidboxUpdateOptions<AnyItem>[K];
};

export interface FluidboxRootProps<TItem extends FluidboxItem = FluidboxItem> {
  /** The items, or a list read on demand. Reactive, also in place. */
  readonly items: FluidboxItems<TItem>;
  /**
   * Whether the viewer is open, for `v-model:open`. The viewer opens on
   * `index` and closes when this changes. Leave it out to let triggers own it.
   */
  readonly open?: boolean;
  /** The item the viewer shows, for `v-model:index`. */
  readonly index?: number;
  /** Your strings for the viewer. */
  readonly labels?: Partial<FluidboxLabels>;
  /** Pinch, double-tap, wheel and keyboard zoom of images. `false` turns it off. */
  readonly zoom?: false | { readonly step?: number; readonly max?: number };
  /** Go round: past the last item comes the first. A single item never loops. */
  readonly loop?: boolean;
  /** Draw `custom` items, by the name in their `render`. */
  readonly renderers?: Readonly<Record<string, FluidboxVueRenderer<TItem>>>;
  /** Find the trigger of an item without a mounted Trigger, as in a virtualised grid. */
  readonly findTrigger?: FluidboxOptions<TItem>["findTrigger"];
  /** Bring an item's trigger into view. Without it, the viewer scrolls it into view. */
  readonly revealTrigger?: FluidboxOptions<TItem>["revealTrigger"];
  /** When the viewer's code loads: on `"hover"` (the default), on `"press"`, or `"eager"`ly. */
  readonly loading?: FluidboxLoading;
}

type RootEmits<TItem extends FluidboxItem> = {
  beforevaluechange: (event: FluidboxValueChangeEvent<TItem>) => true;
  valuechange: (event: FluidboxValueChangeEvent<TItem>) => true;
  valuechangecomplete: (event: FluidboxValueChangeEvent<TItem>) => true;
  sheetchange: (event: FluidboxSheetEvent) => true;
  zoomchange: (event: FluidboxZoomEvent) => true;
  "update:open": (open: boolean, details: FluidboxChangeDetails) => true;
  "update:index": (index: number, details: FluidboxChangeDetails) => true;
};

type RootSlots<TItem extends FluidboxItem> = SlotsType<{
  default?: (fluidbox: FluidboxApi<TItem>) => VNode[];
}>;

/**
 * Owns one fluidbox per gallery. It touches nothing until a viewer is pressed
 * or opened, so Root is safe to render on the server, and prop and part
 * changes apply to it in place. Unmounting drops the viewer. The default slot gets the `useFluidbox()` object.
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
    const viewerTarget = shallowRef<HTMLElement | null>(null);
    const features = shallowReactive<Features>({ viewers: 0, filmstrip: null, sheet: null });
    const mounts = useMounts();
    const labels = computed(() => resolveLabels(props.labels));

    // Renderers resolve by name when a slide mounts, so the newest one is used.
    const renderers = new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
      get(_, key) {
        const render = typeof key === "string" ? props.renderers?.[key] : undefined;
        if (!render) return undefined;
        return (context: FluidboxSlide<TItem>) =>
          mounts.mount(context.media, () =>
            render({
              item: context.item,
              index: context.index,
              signal: context.signal,
              get active() {
                return context.active;
              },
              onActiveChange: context.onActiveChange,
            }),
          );
      },
      has: (_, key) => typeof key === "string" && !!props.renderers?.[key],
    });

    // One function for the life of Root, so `update` redraws the layer only when it comes or goes.
    const viewer: FluidboxViewerRenderer<TItem> = ({ target }) => {
      viewerTarget.value = target;
      return () => {
        if (viewerTarget.value === target) viewerTarget.value = null;
      };
    };

    /** The options the props and parts ask for now. */
    const settings = (): Settings => {
      const { zoom } = props;
      const labelsInput = props.labels;
      return {
        labels: labelsInput && { ...toRaw(labelsInput) },
        zoom: zoom === false ? false : zoom && { step: zoom.step, max: zoom.max },
        loop: props.loop,
        // Without a Viewer part, the viewer has the default controls.
        viewer:
          features.viewers > 0 ? (viewer as unknown as FluidboxViewerRenderer<AnyItem>) : undefined,
        filmstrip: features.filmstrip?.options(),
        sheet: features.sheet?.options(),
        loading: props.loading,
      };
    };

    let applied = settings();
    // findTrigger and revealTrigger are read from the newest props on each use.
    const fluidbox = createFluidbox<TItem>(
      latestFindTrigger<TItem, FluidboxOptions<TItem>>(
        {
          items: items.value,
          ...(applied as FluidboxUpdateOptions<TItem>),
          slides: renderers as FluidboxSlides<TItem>,
        },
        () => props as FluidboxRootProps<TItem>,
      ),
    );
    const state = shallowRef(fluidbox.state);
    const list = shallowRef(fluidbox.items);
    const sheetStop = shallowRef(0);

    const unsubscribe = fluidbox.subscribe(() => {
      state.value = fluidbox.state;
      if (fluidbox.items !== list.value) list.value = fluidbox.items;
      // A sheet that loads or goes changes the stop too.
      sheetStop.value = fluidbox.sheet?.stop ?? 0;
    });
    // The fluidbox ignores items equal to its own, as an inline `:items="[product]"`.
    watch(items, (next) => void fluidbox.setItems(next));

    const events = new AbortController();
    for (const type of fluidboxEventTypes) {
      fluidbox.addEventListener(
        type,
        (event) => (emit as unknown as (type: string, event: Event) => void)(type, event),
        { signal: events.signal },
      );
    }
    fluidbox.addEventListener("sheetchange", (event) => (sheetStop.value = event.stop), {
      signal: events.signal,
    });
    watchOpenIndex(
      fluidbox,
      {
        open: (open, details) => emit("update:open", open, details),
        index: (index, details) => emit("update:index", index, details),
      },
      events.signal,
    );

    // The parts register as Root mounts; the runtime loads the add-ons they turn on.
    onMounted(() => {
      watch(
        settings,
        (next) => {
          const changes: Partial<Settings> = {};
          for (const key of settingKeys) {
            if (!same(applied[key], next[key]))
              (changes as Record<string, unknown>)[key] = next[key];
          }
          if (Object.keys(changes).length) fluidbox.update(changes as FluidboxUpdateOptions<TItem>);
          applied = next;
        },
        { immediate: true },
      );
      // Your open and index win whenever they change. The triggers have
      // registered by now, so an open flies from the item's own.
      const sync = createOpenIndexSync(fluidbox);
      watch(
        [() => props.open, () => props.index],
        ([open, index]) => sync(open === undefined ? undefined : open !== false, index),
        {
          immediate: true,
        },
      );
    });
    onBeforeUnmount(() => {
      unsubscribe();
      events.abort();
      unloadFluidbox(fluidbox);
    });

    const api: FluidboxApi<TItem> = {
      get status() {
        return state.value.status;
      },
      get value() {
        return state.value.value;
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
      get zoom() {
        return state.value.zoom;
      },
      open: (target, options) => fluidbox.open(target, options),
      close: (options) => fluidbox.close(options),
      next: (options) => fluidbox.next(options),
      previous: (options) => fluidbox.previous(options),
      zoomTo: (scale, options) => fluidbox.zoomTo(scale, options),
      zoomIn: (options) => fluidbox.zoomIn(options),
      zoomOut: (options) => fluidbox.zoomOut(options),
      resetZoom: (options) => fluidbox.resetZoom(options),
      setItems: (next) => fluidbox.setItems(next),
      preload: (target) => fluidbox.preload(target),
      load: () => fluidbox.load(),
    };
    const sheet: FluidboxSheetApi = {
      get stop() {
        return sheetStop.value;
      },
      set: (stop, options) => fluidbox.sheet?.set(stop, options),
    };

    provide(RootKey, {
      fluidbox: fluidbox as unknown as FluidboxInstance<AnyItem>,
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
    props: [
      "items",
      "open",
      "index",
      "labels",
      "zoom",
      "loop",
      "renderers",
      "findTrigger",
      "revealTrigger",
      "loading",
    ],
    emits: [...fluidboxEventTypes, "update:open", "update:index"],
  },
);

export interface FluidboxTriggerProps<TItem extends FluidboxItem = FluidboxItem> {
  /** Decorate the one child instead of rendering a `<button>`. */
  readonly asChild?: boolean;
  /** Required. The item this trigger opens, or its index or id. */
  readonly item: FluidboxTarget<TItem>;
  /** More items that close back onto this trigger, as an album cover's. */
  readonly returns?: readonly FluidboxTarget<TItem>[];
}

type TriggerSlots<TItem extends FluidboxItem> = SlotsType<{
  default?: (preview: FluidboxTriggerPreview<TItem>) => VNode[];
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
    const instance = getCurrentInstance()!;
    const target = (): FluidboxTarget<AnyItem> => {
      const item = props.item as FluidboxTarget<AnyItem> | undefined;
      if (item === undefined || item === null) {
        throw new Error("<Fluidbox.Trigger> needs an item: the item, its index or its id.");
      }
      return typeof item === "object" ? toRaw(item) : item;
    };
    const returns = () =>
      (props.returns as readonly FluidboxTarget<AnyItem>[] | undefined)?.map((each) =>
        typeof each === "object" ? toRaw(each) : each,
      );
    // Read by render, so the forced update below sees a change.
    const previewed = shallowRef(0);
    const options = () => ({
      value: [target(), ...(returns() ?? [])],
      // The closing flight measures right after this, so patch the DOM now.
      onPreviewChange() {
        previewed.value++;
        if (!instance.isUnmounted) instance.update();
      },
    });
    const trigger = createTrigger(fluidbox, options());
    watch([() => props.item, () => props.returns], () => trigger.update(options()));
    watch(items, () => trigger.refresh(), { flush: "post" });
    onBeforeUnmount(() => trigger.destroy());
    provide(TriggerKey, { target, returns });

    const handlers = {
      ref: (value: unknown) => trigger.setElement(toElement(value)),
      onClick: (event: MouseEvent) => trigger.click(event),
      onPointerdown: (event: PointerEvent) => trigger.pointerDown(event),
      onPointerup: () => trigger.pointerUp(),
      onPointercancel: () => trigger.pointerCancel(),
    };

    return () => {
      void previewed.value;
      const preview = trigger.preview(state.value) as FluidboxTriggerPreview<TItem>;
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
    props: ["asChild", "item", "returns"],
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

/** The copy of an overlay's content that flies with the photo. */
const Travelling = defineComponent({
  name: "FluidboxTravelling",
  setup(_, { slots }) {
    provide(TravelKey, true);
    return () => slots.default?.();
  },
});

/**
 * Content over a trigger's thumbnail, such as a count. It follows the viewer's
 * motion through `--fluidbox-closed`, and with `travel` its content renders live
 * in the frame that flies with the photo.
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
    const trigger = inject(TriggerKey, null);
    if (!trigger) {
      throw new Error("<Fluidbox.ThumbnailOverlay> must be rendered inside <Fluidbox.Trigger>.");
    }
    const element = shallowRef<HTMLElement | null>(null);
    const layer = shallowRef<HTMLElement | null>(null);
    provide(OverlayKey, { layer });
    const mounts = useMounts();
    const travel: FluidboxRenderer<AnyItem> = ({ target }) =>
      mounts.mount(target, () => h(Travelling, null, () => slots.default?.()));
    watchEffect(
      (onCleanup) => {
        const overlay = element.value;
        void items.value;
        if (!overlay) return;
        const value = [trigger.target(), ...(trigger.returns() ?? [])];
        onCleanup(
          fluidbox.bindOverlay(overlay, value, {
            flight: props.travel ? { live: travel } : "none",
          }),
        );
        // A FrameLayer inside flies as an overlay of its own, beside this one.
        const frame = props.travel
          ? (layer.value ??
            overlay.querySelector<HTMLElement>(
              '[data-fluidbox-trigger-overlay="frame"]:not([data-fluidbox-ghost])',
            ))
          : null;
        if (frame) onCleanup(fluidbox.bindOverlay(frame, value, { flight: "frame" }));
      },
      { flush: "post" },
    );
    return () => [
      h(
        "span",
        mergeProps(attrs, {
          ref: element,
          "data-fluidbox-trigger-overlay": props.travel ? "live" : "none",
        }),
        slots.default?.(),
      ),
      ...mounts.render(),
    ];
  },
});

/**
 * A layer of a travelling ThumbnailOverlay that is moved into the flying frame
 * for the flight and put back after, as one element: a frame, a border, a
 * shadow. It renders a `<span data-fluidbox-trigger-overlay="frame">`.
 */
const FrameLayer = defineComponent({
  name: "FluidboxFrameLayer",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const overlay = inject(OverlayKey, null);
    if (!overlay) {
      throw new Error("<Fluidbox.FrameLayer> must be rendered inside <Fluidbox.ThumbnailOverlay>.");
    }
    // The flying copy leaves it out: the element itself flies.
    if (inject(TravelKey, null)) return () => null;
    const setLayer = (value: unknown) => (overlay.layer.value = toElement(value));
    onBeforeUnmount(() => (overlay.layer.value = null));
    return () =>
      h(
        "span",
        mergeProps(attrs, { ref: setLayer, "data-fluidbox-trigger-overlay": "frame" }),
        slots.default?.(),
      );
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
/** Zooms the image in by 1.5. */
const ZoomIn = control("zoomIn", "FluidboxZoomIn");
/** Zooms the image out by 1.5. */
const ZoomOut = control("zoomOut", "FluidboxZoomOut");
/** Zooms the image back out to fit. */
const ZoomReset = control("zoomReset", "FluidboxZoomReset");

/**
 * The default Previous, Next and Close, for a Viewer with content of its own,
 * and with `zoom` the zoom controls in their group.
 */
const Controls = defineComponent({
  name: "FluidboxControls",
  props: { zoom: Boolean },
  setup(props) {
    const { labels } = useRootContext("Controls");
    const zooms = { zoomIn: ZoomIn, zoomOut: ZoomOut, zoomReset: ZoomReset } as const;
    return () => [
      ...[Previous, Next, Close].map((part) => h(part)),
      ...(props.zoom
        ? [
            h(
              "div",
              {
                "data-fluidbox-zoom-controls": "",
                role: "group",
                "aria-label": labels.value.zoomed,
              },
              zoomControlNames.map((name) => h(zooms[name as keyof typeof zooms])),
            ),
          ]
        : []),
    ];
  },
});

/**
 * Turns the filmstrip on. With a default slot, it fills each thumbnail button,
 * getting `{ item, index }`; the selected button has `data-fluidbox-selected`.
 */
const Filmstrip = defineComponent({
  name: "FluidboxFilmstrip",
  slots: Object as SlotsType<{
    default?: (thumbnail: FluidboxItemContext) => VNode[];
  }>,
  setup(_, { slots }) {
    const { features } = useRootContext("Filmstrip");
    const strip = useRuntimeSlots();
    const custom = !!slots.default;
    const part: FilmstripPart = {
      options: () => (custom ? { render: strip.render } : true),
    };
    features.filmstrip = part;
    onBeforeUnmount(() => {
      if (features.filmstrip === part) features.filmstrip = null;
    });
    return () => strip.teleport(({ item, index }) => slots.default?.({ item, index }));
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
 * The runtime's `<section data-fluidbox-sheet>` is the sheet and gets this
 * part's attributes; the default slot is its content and gets `{ item, index }`.
 * Import `@ogdakke/fluidbox/sheet.css` once.
 */
const Sheet = defineComponent({
  name: "FluidboxSheet",
  inheritAttrs: false,
  props: {
    snapPoints: Array as PropType<readonly FluidboxSheetSnapPoint[]>,
    dismiss: String as PropType<FluidboxSheetProps["dismiss"]>,
  },
  slots: Object as SlotsType<{
    default?: (sheet: FluidboxItemContext) => VNode[];
  }>,
  setup(props, { attrs, slots }) {
    const { features } = useRootContext("Sheet");
    const applied = new WeakMap<HTMLElement, Applied>();
    const decorate = (shown: readonly FluidboxSlot<AnyItem>[]) => {
      for (const { container } of shown) {
        applied.set(container, applyAttributes(container, attrs, applied.get(container)));
      }
    };
    const sheet = useRuntimeSlots(decorate);
    onUpdated(() => decorate(sheet.list.value));
    const part: SheetPart = {
      options: () => ({
        snapPoints: props.snapPoints && [...toRaw(props.snapPoints)],
        dismiss: props.dismiss,
        render: sheet.render,
      }),
    };
    features.sheet = part;
    onBeforeUnmount(() => {
      if (features.sheet === part) features.sheet = null;
    });
    return () => sheet.teleport(({ item, index }) => slots.default?.({ item, index }));
  },
});

/** What a part put on an element of the runtime's, to take off when it changes. */
interface Applied {
  readonly classes: readonly string[];
  readonly styles: readonly string[];
  readonly attributes: readonly string[];
}

const cssName = (name: string) =>
  name.startsWith("--") ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Put Vue attributes on an element the runtime owns, keeping the runtime's own. */
function applyAttributes(
  element: HTMLElement,
  attrs: Record<string, unknown>,
  previous: Applied | undefined,
): Applied {
  const classes = normalizeClass(attrs.class).split(/\s+/).filter(Boolean);
  for (const name of previous?.classes ?? []) {
    if (!classes.includes(name)) element.classList.remove(name);
  }
  element.classList.add(...classes);

  const style = normalizeStyle(attrs.style);
  const declarations: [string, string][] =
    typeof style === "string"
      ? style
          .split(";")
          .map((each) => each.split(/:(.*)/s).map((part) => part.trim()) as [string, string])
          .filter(([name, value]) => name && value)
      : Object.entries(style ?? {}).map(([name, value]) => [cssName(name), String(value)]);
  const styles = declarations.map(([name]) => name);
  for (const name of previous?.styles ?? []) {
    if (!styles.includes(name)) element.style.removeProperty(name);
  }
  for (const [name, value] of declarations) element.style.setProperty(name, value);

  const attributes: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "class" || name === "style" || typeof value === "function") continue;
    if (value === false || value === null || value === undefined) continue;
    element.setAttribute(name, value === true ? "" : String(value as string | number));
    attributes.push(name);
  }
  for (const name of previous?.attributes ?? []) {
    if (!attributes.includes(name)) element.removeAttribute(name);
  }
  return { classes, styles, attributes };
}

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
  Trigger,
  Viewer,
  Controls,
  Close,
  Previous,
  Next,
  ZoomIn,
  ZoomOut,
  ZoomReset,
  Filmstrip,
  Sheet,
  SheetStop,
  ThumbnailOverlay,
  FrameLayer,
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
