/** The Vue binding: the `Fluidbox` parts and the `useFluidbox`, `useFluidboxSheet` and `useFluidboxSlide` composables. */
import {
  Comment,
  Fragment,
  Suspense,
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
  onUnmounted,
  onUpdated,
  provide,
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
  type WatchSource,
} from "vue";
import {
  createFluidbox,
  type Fluidbox as FluidboxInstance,
  type FluidboxControlName,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxLabels,
  type FluidboxMediaErrorEvent,
  type FluidboxOptions,
  type FluidboxSheetEvent,
  type FluidboxSheetSnapPoint,
  type FluidboxSlide,
  type FluidboxSlideRenderer,
  type FluidboxSlides,
  type FluidboxState,
  type FluidboxTarget,
  type FluidboxValue,
  type FluidboxValueChangeDetails,
  type FluidboxVideoItem,
  type FluidboxVideoOptions,
  type FluidboxViewerRenderer,
  type FluidboxHotspotCoordinate,
  type FluidboxZoomEvent,
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
  placeHotspot,
  latestFindTrigger,
  resolveLabels,
  takeOverFluidbox,
  targetKeys,
  unloadFluidbox,
  valueChangeDetails,
  watchFluidbox,
  zoomControlNames,
  type FluidboxSlot,
  type FluidboxSlots,
  type FluidboxStaticNode,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxApi,
  FluidboxCommands,
  FluidboxItemContext,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSlideApi,
  FluidboxSlideContent,
  FluidboxSlidesSlots,
  FluidboxThumbnailContext,
  FluidboxTriggerProps,
} from "./types";

export type {
  FluidboxApi,
  FluidboxCommands,
  FluidboxControlProps,
  FluidboxHotspotProps,
  FluidboxIframeProps,
  FluidboxImageProps,
  FluidboxItemContext,
  FluidboxMediaProps,
  FluidboxOverlayProps,
  FluidboxRootProps,
  FluidboxSheetApi,
  FluidboxSheetProps,
  FluidboxSheetSnapProps,
  FluidboxSlideApi,
  FluidboxSlideContent,
  FluidboxSlidesSlots,
  FluidboxThumbnailContext,
  FluidboxTriggerProps,
  FluidboxVideoProps,
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
  FluidboxHotspotCoordinate,
  FluidboxHotspotOptions,
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

type AnyItem = FluidboxItem;

/** Content the runtime asked for, teleported from Root so it keeps the app's context. */
interface Mount {
  readonly key: number;
  readonly target: HTMLElement;
  readonly render: () => VNodeChild;
}

/**
 * Patches the current component at once, for content the runtime asked for:
 * it may measure what it asked for, and it empties a target right after the
 * dispose, which must find Vue's nodes gone.
 */
function usePatch() {
  const instance = getCurrentInstance()!;
  let live = true;
  onBeforeUnmount(() => (live = false));
  return () => {
    if (live && instance.isMounted && !instance.isUnmounted) instance.update();
  };
}

/** Renders content into runtime targets, each in a host of its own, until the returned dispose runs. */
function useMounts() {
  const patch = usePatch();
  const list = shallowRef<readonly Mount[]>([]);
  let nextKey = 0;
  return {
    mount: (target: HTMLElement, render: () => VNodeChild): (() => void) => {
      const host = target.ownerDocument.createElement("span");
      host.dataset.fluidboxMount = "";
      target.append(host);
      const entry = { key: nextKey++, target: host, render };
      list.value = [...list.value, entry];
      patch();
      return () => {
        list.value = list.value.filter((candidate) => candidate !== entry);
        patch();
        host.remove();
      };
    },
    render: () =>
      list.value.map(({ key, target, render }) => h(Teleport, { key, to: target }, [render()])),
  };
}

/** The Thumbnails and Sheet parts' options. Their presence turns each on. */
interface Addons {
  thumbnails: { readonly custom: boolean } | null;
  sheet: FluidboxSheetProps | null;
}

/** The Slides part's slots, as a new object whenever they may have changed. */
interface SlidesEntry {
  readonly slots: Readonly<Record<string, FluidboxSlideContent<any> | undefined>>;
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
  readonly thumbnailsSlots: FluidboxSlots<AnyItem>;
  readonly sheetSlots: FluidboxSlots<AnyItem>;
  readonly slides: ShallowRef<SlidesEntry | null>;
  /** Render content into a runtime target until the returned function runs. */
  readonly mount: (target: HTMLElement, render: () => VNodeChild) => () => void;
  readonly setAddon: <K extends keyof Addons>(name: K, value: Addons[K]) => void;
  /** Count a Viewer part, which the viewer patches as it draws its layer. */
  readonly addViewer: (patch: () => void) => () => void;
  /** What the server's copy of an open viewer needs to know, set as the parts set up. */
  readonly serverHints: ServerHints;
}

interface ServerHints {
  thumbnails: boolean;
  sheet: boolean;
  viewer: boolean;
}

interface SlideContext {
  readonly slide: FluidboxSlide<any>;
  readonly api: FluidboxSlideApi<any>;
}

interface TriggerContext {
  /** The item keys of the trigger: its first opens, and every one closes back onto it. */
  readonly keys: () => readonly (number | string)[];
}

const RootKey: InjectionKey<RootContext> = Symbol("fluidbox");
const SlideKey: InjectionKey<SlideContext> = Symbol("fluidbox-slide");
const TriggerKey: InjectionKey<TriggerContext> = Symbol("fluidbox-trigger");
/** Provided inside the live copy an overlay renders into the flying frame. */
const TravelKey: InjectionKey<true> = Symbol("fluidbox-travel");

function useRootContext(): RootContext {
  const context = inject(RootKey, null);
  if (!context)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "Fluidbox parts must be rendered inside <Fluidbox.Root>.";
        } catch {}
        return "fluidbox";
      })(),
    );
  return context;
}

function useSlideContext(part: string): SlideContext {
  const context = inject(SlideKey, null);
  if (!context)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return `<Fluidbox.${part}> must be inside a slide, in <Fluidbox.Slides>.`;
        } catch {}
        return "fluidbox";
      })(),
    );
  return context;
}

/** A target as the runtime takes it: the raw item, not Vue's proxy. */
const rawTarget = <T>(target: T): T =>
  (typeof target === "object" && target !== null ? toRaw(target) : target) as T;

const stateKeys = [
  "status",
  "value",
  "index",
  "item",
  "count",
  "hasPrevious",
  "hasNext",
  "zoom",
  "fullscreen",
] as const satisfies readonly (keyof FluidboxState)[];

type RootEmits<TItem extends FluidboxItem> = {
  /**
   * Before every open, move and close, from any input, with the value the
   * viewer goes to: an id, or null for a close. `details.cancel()` stops it.
   */
  valueChange: (value: FluidboxValue, details: FluidboxValueChangeDetails<TItem>) => true;
  /**
   * The value the viewer went to, for `v-model`, once an open, move or close
   * goes through: a canceled one never reaches the model.
   */
  "update:modelValue": (value: FluidboxValue, details: FluidboxValueChangeDetails<TItem>) => true;
  /** Once the motion of a value change settled: the flight landed, a move came to rest, or a close finished. */
  valueChangeComplete: (value: FluidboxValue, details: FluidboxValueChangeDetails<TItem>) => true;
  /** When the image on show comes to rest at another zoom. */
  zoomChange: (event: FluidboxZoomEvent) => true;
  /** When a slide's media fails to load, as it shows its error. */
  mediaError: (event: FluidboxMediaErrorEvent<TItem>) => true;
};

type RootSlots<TItem extends FluidboxItem> = SlotsType<{
  default?: (fluidbox: FluidboxApi<TItem>) => VNode[];
}>;

/**
 * Owns one fluidbox per gallery. It touches nothing until a viewer is pressed
 * or opened, so Root is safe to render on the server, and prop and part
 * changes apply to it in place. Unmounting drops the viewer. The default slot
 * gets the `useFluidbox()` object.
 */
const Root = defineComponent(
  <TItem extends FluidboxItem>(
    props: FluidboxRootProps<TItem>,
    { emit, slots }: SetupContext<RootEmits<TItem>, RootSlots<TItem>>,
  ) => {
    // Reading items one by one tracks in-place changes to a reactive array.
    const items = computed(() => {
      const value = props.items;
      return Array.isArray(value) ? value.map((item: TItem) => toRaw(item)) : toRaw(value);
    });
    const mounts = useMounts();
    const thumbnailsSlots = createSlots<TItem>();
    const sheetSlots = createSlots<TItem>();
    const slides = shallowRef<SlidesEntry | null>(null);
    const viewerTarget = shallowRef<HTMLElement | null>(null);
    const viewers = new Set<() => void>();
    const labels = computed(() => resolveLabels(props.labels));
    const serverHints: ServerHints = { thumbnails: false, sheet: false, viewer: false };

    // One function for the life of Root, so `update` redraws the layer only when it comes or goes.
    const renderViewer: FluidboxViewerRenderer<TItem> = ({ target }) => {
      viewerTarget.value = target;
      // A viewer made by the open it serves measures its layer right after
      // this, and the content can change the layer's insets, so draw it now.
      for (const patch of viewers) patch();
      return () => {
        if (viewerTarget.value === target) viewerTarget.value = null;
      };
    };

    const labelOptions = (): Partial<FluidboxLabels> => ({
      ...toRaw(props.labels),
      position: (index, count) => (props.labels?.position ?? defaultLabels.position)(index, count),
    });
    const zoomOption = (): FluidboxOptions<TItem>["zoom"] => {
      const { zoom } = props;
      return zoom === false ? false : zoom ? { ...toRaw(zoom) } : undefined;
    };
    const dismissOption = () => props.dismiss && { ...toRaw(props.dismiss) };

    // findTrigger and revealTrigger are read from the newest props on each use.
    const fluidbox = createFluidbox<TItem>(
      latestFindTrigger<TItem, FluidboxOptions<TItem>>(
        {
          items: items.value,
          labels: labelOptions(),
          zoom: zoomOption(),
          loop: props.loop,
          preload: props.preload,
          dismiss: dismissOption(),
          wheel: props.wheel,
          // Share shares the item's href unless shareUrl says otherwise.
          shareUrl: (item) => (props.shareUrl ? props.shareUrl(item) : props.href?.(idOf(item))),
          // Slides are looked up by type as one mounts, so the Slides part's
          // newest slots are used without telling the viewer.
          slides: new Proxy({} as Record<string, FluidboxSlideRenderer<TItem>>, {
            get(_, key) {
              if (typeof key !== "string" || !slides.value?.slots[key]) return undefined;
              const renderer: FluidboxSlideRenderer<TItem> = (slide) => {
                // The open waits until the slide's content reports its commit.
                const release = holdSlideCommit(slide);
                const unmount = mounts.mount(slide.layer, () =>
                  h(SlideHost, { slide, type: key, release }),
                );
                return () => {
                  release();
                  unmount();
                };
              };
              return renderer;
            },
            has: (_, key) => typeof key === "string" && !!slides.value?.slots[key],
          }) as FluidboxSlides<TItem>,
        },
        () => props as FluidboxRootProps<TItem>,
      ),
    );
    const state = shallowRef(fluidbox.state);
    const list = shallowRef(fluidbox.items);
    const sheetSnap = shallowRef(0);
    const unsubscribe = fluidbox.subscribe(() => {
      state.value = fluidbox.state;
      if (fluidbox.items !== list.value) list.value = fluidbox.items;
      // A sheet that loads or goes changes the snap too.
      sheetSnap.value = fluidbox.sheet?.snap ?? 0;
    });
    // The fluidbox ignores items equal to its own, as an inline `:items="[product]"`.
    watch(items, (next) => void fluidbox.setItems(next));

    // The Viewer, Thumbnails and Sheet parts register as they set up. Changes
    // go to the viewer together, after the parts that render with them.
    let addons: Addons = { thumbnails: null, sheet: null };
    let scheduled = false;
    const applyAddons = () => {
      if (!scheduled) return;
      scheduled = false;
      const { thumbnails, sheet } = addons;
      fluidbox.update({
        viewer: viewers.size > 0 ? renderViewer : undefined,
        thumbnails: thumbnails
          ? thumbnails.custom
            ? { render: thumbnailsSlots.render }
            : true
          : undefined,
        sheet: sheet
          ? {
              render: sheetSlots.render,
              snapPoints: sheet.snapPoints,
              dismissMotion: sheet.dismissMotion,
            }
          : undefined,
      });
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      // A part that unmounts and mounts again within one patch changes nothing.
      queueMicrotask(applyAddons);
    };
    const setAddon = <K extends keyof Addons>(name: K, value: Addons[K]) => {
      addons = { ...addons, [name]: value };
      schedule();
    };
    const addViewer = (patch: () => void) => {
      viewers.add(patch);
      schedule();
      return () => {
        viewers.delete(patch);
        schedule();
      };
    };

    // Objects are compared by value, so inline labels, zoom or dismiss change nothing.
    watch(
      () =>
        JSON.stringify([
          props.labels ?? {},
          props.zoom ?? null,
          props.dismiss ?? null,
          props.loop,
          props.preload,
          props.wheel,
        ]),
      () =>
        fluidbox.update({
          labels: labelOptions(),
          zoom: zoomOption(),
          loop: props.loop,
          preload: props.preload,
          dismiss: dismissOption(),
          wheel: props.wheel,
        }),
    );

    const events = new AbortController();
    const { signal } = events;
    fluidbox.addEventListener("zoomchange", (event) => emit("zoomChange", event), { signal });
    fluidbox.addEventListener("mediaerror", (event) => emit("mediaError", event), { signal });
    fluidbox.addEventListener("sheetchange", (event) => (sheetSnap.value = event.snap), {
      signal,
    });
    // valueChange comes from the before-event, so `details.cancel()` works in
    // its handler; the model hears only of changes that went through.
    watchFluidbox(
      fluidbox,
      {
        value: (value, details) => emit("valueChange", value, details),
        complete: (value, details) => emit("valueChangeComplete", value, details),
      },
      signal,
    );
    fluidbox.addEventListener(
      "valuechange",
      (event) => emit("update:modelValue", event.value, valueChangeDetails(event)),
      { signal },
    );

    // A Root that renders open on an image draws the viewer's copy on its
    // first render, so the server's HTML shows the photo, and the viewer
    // takes it over as the Root mounts.
    const initial =
      props.modelValue !== undefined ? props.modelValue : (props.defaultValue ?? null);
    const first = Array.isArray(items.value) ? (items.value as readonly TItem[]) : [];
    const at = initial === null ? -1 : first.findIndex((item) => idOf(item) === initial);
    const serverIndex = first[at]?.type === "image" ? at : null;
    const serverViewer = shallowRef<HTMLElement | null>(null);
    const takenOver = shallowRef(false);

    // Your value wins whenever it changes. The triggers and parts have
    // registered by now, so an open flies from the item's own. The default
    // value opens once, as the Root mounts.
    onMounted(() => {
      applyAddons();
      const sync = createFluidboxSync(fluidbox);
      const copy = serverViewer.value;
      if (copy && serverIndex !== null) {
        const done = () => (takenOver.value = true);
        void takeOverFluidbox(fluidbox, copy, idOf(first[serverIndex]!)).then(done, done);
      } else {
        sync(props.modelValue === undefined ? (props.defaultValue ?? undefined) : props.modelValue);
      }
      watch(
        () => props.modelValue,
        (value) => sync(value),
      );
    });
    // The events stop first, so the drop never reaches `update:modelValue` as a close.
    onBeforeUnmount(() => {
      events.abort();
      unsubscribe();
      unloadFluidbox(fluidbox);
    });

    const commands: FluidboxCommands<TItem> = {
      open: (target, options) => fluidbox.open(rawTarget(target), options),
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
      setItems: (next) => fluidbox.setItems(rawTarget(next)),
      preload: (target) => fluidbox.preload(rawTarget(target)),
      load: () => fluidbox.load(),
    };
    // The state's fields read the state ref, so a template that reads them follows the viewer.
    const api = { ...commands } as FluidboxApi<TItem>;
    for (const key of stateKeys) {
      Object.defineProperty(api, key, { enumerable: true, get: () => state.value[key] });
    }
    const sheet: FluidboxSheetApi = {
      get snap() {
        return sheetSnap.value;
      },
      setSnap: (snap, options) => fluidbox.sheet?.setSnap(snap, options),
    };

    provide(RootKey, {
      fluidbox: fluidbox as unknown as FluidboxInstance<AnyItem>,
      state: state as ShallowRef<FluidboxState<AnyItem>>,
      items: list as ShallowRef<FluidboxItemList<AnyItem>>,
      labels,
      api: api as FluidboxApi<AnyItem>,
      sheet,
      viewerTarget,
      thumbnailsSlots: thumbnailsSlots as unknown as FluidboxSlots<AnyItem>,
      sheetSlots: sheetSlots as unknown as FluidboxSlots<AnyItem>,
      slides,
      mount: mounts.mount,
      setAddon,
      addViewer,
      serverHints,
    });
    return () => [
      slots.default?.(api),
      // After the Root's content, so the parts in it have said what the copy needs.
      serverIndex !== null && !takenOver.value
        ? h(ServerViewer, {
            setElement: (element: HTMLElement | null) => (serverViewer.value = element),
            items: first,
            index: serverIndex,
            labels: labels.value,
            loop: props.loop,
            href: props.href,
            hints: serverHints,
          })
        : null,
      ...mounts.render(),
    ];
  },
  {
    name: "FluidboxRoot",
    // Declared without types to keep the item type generic, but `loop`, so a
    // bare `loop` attribute is true; unset, it stays undefined.
    props: {
      items: null,
      modelValue: null,
      defaultValue: null,
      loop: { type: Boolean, default: undefined },
      href: null,
      labels: null,
      zoom: null,
      findTrigger: null,
      revealTrigger: null,
      preload: null,
      dismiss: null,
      wheel: null,
      shareUrl: null,
      // Typed as the names, which keeps the generic signature's props.
    } as unknown as (keyof FluidboxRootProps)[],
    emits: ["valueChange", "update:modelValue", "valueChangeComplete", "zoomChange", "mediaError"],
  },
);

function staticElement(each: FluidboxStaticNode | string): VNode | string {
  if (typeof each === "string") return each;
  return h(each.tag, { ...each.attributes }, each.children.map(staticElement));
}

/**
 * The open viewer's copy. It is built as elements, not HTML, so it renders
 * under Trusted Types and a strict style-src.
 */
const ServerViewer = defineComponent({
  name: "FluidboxServerViewer",
  props: {
    setElement: {
      type: Function as PropType<(element: HTMLElement | null) => void>,
      required: true,
    },
    items: { type: Array as PropType<readonly FluidboxItem[]>, required: true },
    index: { type: Number, required: true },
    labels: { type: Object as PropType<FluidboxLabels>, required: true },
    loop: { type: Boolean, default: undefined },
    href: Function as PropType<FluidboxRootProps["href"]>,
    hints: { type: Object as PropType<ServerHints>, required: true },
  },
  setup(props) {
    return () => {
      const copy = fluidboxStaticViewerNodes({
        items: props.items,
        value: idOf(props.items[props.index]!),
        labels: props.labels,
        loop: props.loop,
        href: props.href,
        thumbnails: props.hints.thumbnails,
        sheet: props.hints.sheet,
        controls: !props.hints.viewer,
      });
      if (!copy) return null;
      return h(
        "div",
        {
          ref: (element: unknown) => props.setElement(toElement(element)),
          "data-fluidbox-server-viewer": "",
        },
        [staticElement(copy)],
      );
    };
  },
});

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
    const { fluidbox, state, items } = useRootContext();
    const instance = getCurrentInstance()!;
    const value = () => {
      const target = props.value as FluidboxTarget<AnyItem> | readonly FluidboxTarget<AnyItem>[];
      if (target === null || target === undefined) {
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
      return Array.isArray(target) ? target.map(rawTarget) : rawTarget(target);
    };
    // Its first opens; every one closes back onto it. Compared by value.
    const keys = computed(() => JSON.stringify(targetKeys(value())));
    provide(TriggerKey, { keys: () => JSON.parse(keys.value) as (number | string)[] });
    // Read by render, so the forced update below sees a change.
    const previewed = shallowRef(0);
    // Whether the last render's slot read the preview: only then does it follow the viewer.
    let follows = false;
    const options = () => ({
      value: value(),
      // The closing flight measures the trigger right after this, so patch the DOM now.
      onPreviewChange() {
        if (!follows) return;
        previewed.value++;
        if (instance.isMounted && !instance.isUnmounted) instance.update();
      },
    });
    const trigger = createTrigger(fluidbox, options());
    watch(
      () => props.value,
      () => trigger.update(options()),
    );
    // Indexes name other items after the items change.
    watch(items, () => trigger.refresh(), { flush: "post" });
    onBeforeUnmount(() => trigger.destroy());

    const handlers = {
      ref: (element: unknown) => trigger.setElement(toElement(element)),
      onClick: (event: MouseEvent) => trigger.click(event),
      onPointerdown: (event: PointerEvent) => trigger.pointerDown(event),
      onPointerup: () => trigger.pointerUp(),
      onPointercancel: () => trigger.pointerCancel(),
    };

    return () => {
      follows = false;
      // Read the state only for a slot that reads the preview, so other triggers
      // do not render again on every change.
      let shown: FluidboxTriggerPreview<TItem> | undefined;
      const read = () => {
        if (!shown) {
          follows = true;
          void previewed.value;
          shown = trigger.preview(state.value) as FluidboxTriggerPreview<TItem>;
        }
        return shown;
      };
      const preview: FluidboxTriggerPreview<TItem> = {
        get item() {
          return read().item;
        },
        get index() {
          return read().index;
        },
        get status() {
          return read().status;
        },
      };
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
    props: ["asChild", "value"],
  },
);

/** Renders your controls and captions into the viewer's layer. Without one, the viewer has the default controls. */
const Viewer = defineComponent({
  name: "FluidboxViewer",
  setup(_, { slots }) {
    const { viewerTarget, addViewer, serverHints } = useRootContext();
    // Read by the server's copy of the open viewer, which renders after this.
    serverHints.viewer = true;
    // Once mounted, so a server render loads nothing.
    const patch = usePatch();
    let remove: (() => void) | undefined;
    onMounted(() => (remove = addViewer(patch)));
    onBeforeUnmount(() => remove?.());
    return () =>
      viewerTarget.value ? h(Teleport, { to: viewerTarget.value }, slots.default?.() ?? []) : null;
  },
});

/** The Slides parts claimed, per Root. */
const claimed = new WeakSet<object>();

/**
 * The slide for each item type, as a named slot: your own types, or the
 * built-in ones. Types it has no slot for draw the built-in slide, or
 * `#default`. It renders nothing: the viewer asks for a slide's content as
 * the slide mounts, and renders it into the slide's layer.
 */
const Slides = defineComponent({
  name: "FluidboxSlides",
  slots: Object as SlotsType<FluidboxSlidesSlots>,
  setup(_, { slots }) {
    const { slides } = useRootContext();
    // Development builds only; a page without a bundler has no process.
    const twice = (() => {
      try {
        if (process.env.NODE_ENV !== "production") return claimed.has(slides);
      } catch {}
      return false;
    })();
    if (twice) throw new Error("A <Fluidbox.Root> takes one <Fluidbox.Slides>.");
    claimed.add(slides);
    const entry = () => ({ slots: slots as SlidesEntry["slots"] });
    slides.value = entry();
    // The slides on show render the newest slots.
    onUpdated(() => (slides.value = entry()));
    onBeforeUnmount(() => {
      claimed.delete(slides);
      slides.value = null;
    });
    return () => null;
  },
});

/**
 * One slide's content, in the slide's layer. Content that suspends waits
 * inside the slide, not the app around the viewer, and the open waits with
 * it: the commit is reported beside the content, so once the boundary shows it.
 */
const SlideHost = defineComponent({
  name: "FluidboxSlide",
  props: {
    slide: { type: Object as PropType<FluidboxSlide<any>>, required: true },
    type: { type: String, required: true },
    release: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const { slides, items } = useRootContext();
    const { slide } = props;
    const active = shallowRef(slide.active);
    onBeforeUnmount(slide.onActiveChange((next) => (active.value = next)));
    const api: FluidboxSlideApi<any> = {
      item: slide.item,
      get index() {
        // New items keep a slide whose item moved, so a template that reads it renders again.
        void items.value;
        return slide.index;
      },
      get active() {
        return active.value;
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
    provide(SlideKey, { slide, api });
    return () => {
      const contents = slides.value?.slots;
      const content = contents?.[props.type] ?? contents?.default;
      return h(Suspense, null, {
        default: () =>
          h(Fragment, null, [
            content?.({ item: slide.item, index: api.index }),
            h(SlideCommitted, { release: props.release }),
          ]),
        fallback: () => null,
      });
    };
  },
});

/**
 * Reports the slide's commit as it mounts. Its mounted hook runs after the
 * content's before it, and a pending Suspense holds it until the content resolves.
 */
const SlideCommitted = defineComponent({
  name: "FluidboxSlideCommitted",
  props: { release: { type: Function as PropType<() => void>, required: true } },
  setup(props) {
    onMounted(() => props.release());
    return () => null;
  },
});

/**
 * The slide this part is inside, in one reactive object: its item, whether it
 * is on show, and its hooks into the open.
 */
export function useFluidboxSlide<
  TItem extends FluidboxItem = FluidboxItem,
>(): FluidboxSlideApi<TItem> {
  return useSlideContext("useFluidboxSlide").api;
}

/** What a part put on an element of the viewer's is put back by the returned function. */
function applyAttributes(element: HTMLElement, attrs: Record<string, unknown>): () => void {
  const restores: (() => void)[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || typeof value === "function") continue;
    if (key === "class") {
      const added = normalizeClass(value)
        .split(/\s+/)
        .filter((name) => name && !element.classList.contains(name));
      element.classList.add(...added);
      restores.push(() => element.classList.remove(...added));
    } else if (key === "style") {
      const style = normalizeStyle(value);
      const declarations: [string, string][] =
        typeof style === "string"
          ? style
              .split(";")
              .map((each) => each.split(/:(.*)/s).map((part) => part.trim()) as [string, string])
              .filter(([name, css]) => name && css)
          : Object.entries(style ?? {}).map(([name, css]) => [cssName(name), String(css)]);
      for (const [name, css] of declarations) {
        const before = element.style.getPropertyValue(name);
        const priority = element.style.getPropertyPriority(name);
        element.style.setProperty(name, css);
        restores.push(() => element.style.setProperty(name, before, priority));
      }
    } else {
      // aria-* and data-* write booleans as text; other attributes are there or not.
      const text = /^(aria|data)-/.test(key)
        ? String(value as string | number | boolean)
        : value === true
          ? ""
          : value === false
            ? null
            : String(value as string | number);
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

const cssName = (name: string) =>
  name.startsWith("--") ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Give an element of the viewer's this component's attributes, again after every update. */
function useAttributes(element: () => HTMLElement | null, attrs: Record<string, unknown>) {
  let restore: (() => void) | undefined;
  const apply = () => {
    restore?.();
    const target = element();
    restore = target ? applyAttributes(target, attrs) : undefined;
  };
  onMounted(apply);
  onUpdated(apply);
  onBeforeUnmount(() => restore?.());
  return apply;
}

/**
 * The slide's media box: the element that flies, follows a drag to dismiss
 * and zooms. It is the viewer's own element; this part gives it its
 * attributes, its default slot and what `render` draws.
 */
const Media = defineComponent({
  name: "FluidboxMedia",
  inheritAttrs: false,
  props: ["zoom", "render"],
  setup(props: { zoom?: boolean | ""; render?: FluidboxSlideRenderer<any> }, { attrs, slots }) {
    const { slide } = useSlideContext("Media");
    // In the box from the start, so what renders into it is never moved there.
    const host = slide.media.ownerDocument.createElement("span");
    host.dataset.fluidboxMount = "";
    slide.media.append(host);
    onUnmounted(() => host.remove());
    useAttributes(() => slide.media, attrs);
    onMounted(() => {
      watch(
        () => props.render,
        (render, _, onCleanup) => {
          if (!render) return;
          // Its own signal and the nodes it adds go when this part does, so a
          // new render function draws afresh.
          const scope = new AbortController();
          slide.signal.addEventListener("abort", () => scope.abort(), {
            once: true,
            signal: scope.signal,
          });
          const before = new Set(slide.media.childNodes);
          const dispose = render(Object.create(slide, { signal: { value: scope.signal } }));
          onCleanup(() => {
            dispose?.();
            scope.abort();
            for (const node of [...slide.media.childNodes]) if (!before.has(node)) node.remove();
          });
        },
        { immediate: true },
      );
      // Its mounted hook runs after Image's, so an explicit `zoom` wins.
      watch(
        () => props.zoom,
        (zoom) => {
          if (zoom !== undefined) slide.zoomable(zoom === "" || zoom);
        },
        { immediate: true },
      );
    });
    // One Teleport to one target, never disabled, so what it holds is never moved.
    return () => h(Teleport, { to: host }, slots.default?.() ?? []);
  },
});

/**
 * A pin on a point of the slide's painted media: your button, inside `Media`,
 * which the viewer keeps on its point as the box fits and zooms.
 */
const Hotspot = defineComponent({
  name: "FluidboxHotspot",
  props: {
    x: { type: [String, Number] as PropType<FluidboxHotspotCoordinate>, required: true },
    y: { type: [String, Number] as PropType<FluidboxHotspotCoordinate>, required: true },
    scaleWithZoom: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    const { slide } = useSlideContext("Hotspot");
    const button = shallowRef<HTMLButtonElement>();
    onMounted(() => watchEffect(() => placeHotspot(slide, button.value!, { ...props })));
    return () => h("button", { type: "button", ref: button }, slots.default?.());
  },
});

/** Draw one of the built-in media into the slide's box, again when a source changes. */
function useDraw(
  part: string,
  draw: (slide: FluidboxSlide<any>) => () => void,
  sources: WatchSource[],
) {
  const { slide } = useSlideContext(part);
  let dispose: (() => void) | undefined;
  onMounted(() => {
    watch(
      sources,
      () => {
        dispose?.();
        dispose = draw(slide);
      },
      { immediate: true },
    );
  });
  onBeforeUnmount(() => dispose?.());
}

const itemKey = (item: unknown) => JSON.stringify(item ?? null);

/** The built-in image in the slide's box: it loads, sharpens and fails as a photo's does. */
const Image = defineComponent({
  name: "FluidboxImage",
  props: ["item"],
  setup(props: { item?: FluidboxItem }) {
    useDraw("Image", (slide) => slide.drawImage(props.item && toRaw(props.item as never)), [
      () => itemKey(props.item),
    ]);
    return () => null;
  },
});

/** The built-in video in the slide's box. `attach` loads the media yourself; pass a stable function. */
const Video = defineComponent({
  name: "FluidboxVideo",
  props: ["item", "attach"],
  setup(props: { item?: FluidboxVideoItem; attach?: FluidboxVideoOptions["attach"] }) {
    useDraw(
      "Video",
      (slide) => {
        const { attach } = props;
        return slide.drawVideo(props.item && toRaw(props.item), attach && { attach });
      },
      // A new attach function loads the media afresh, so pass a stable one.
      [() => itemKey(props.item), () => props.attach],
    );
    return () => null;
  },
});

/** The built-in iframe in the slide's box. */
const Iframe = defineComponent({
  name: "FluidboxIframe",
  props: ["item"],
  setup(props: { item?: FluidboxItem }) {
    useDraw("Iframe", (slide) => slide.drawIframe(props.item && toRaw(props.item as never)), [
      () => itemKey(props.item),
    ]);
    return () => null;
  },
});

/** Whether a slot rendered anything but comments. */
function hasContent(nodes: readonly VNode[] | undefined): nodes is VNode[] {
  return !!nodes?.some((node) => !isVNode(node) || node.type !== Comment);
}

/**
 * The content and name of a control: its label as text without content, and
 * with it, the label as `aria-label` unless `label` is false.
 */
function named(
  children: VNode[] | undefined,
  label: string | false | undefined,
  text: string,
  ariaLabel: unknown,
) {
  const name = typeof label === "string" ? label : text;
  return hasContent(children)
    ? {
        naming: { "aria-label": ariaLabel ?? (label === false ? undefined : name) },
        content: children,
      }
    : { naming: { "data-fluidbox-default": "", "aria-label": ariaLabel }, content: name };
}

/** The disabled and hidden states, name and Download's link of a control, as the state has it. */
function useControl(name: FluidboxControlName) {
  const { fluidbox, state, labels } = useRootContext();
  const control = fluidboxControls[name];
  const shown = computed(() => ({
    disabled: control.disabled(state.value),
    hidden: !!control.hidden?.(fluidbox, state.value),
    label: control.label(labels.value, state.value),
  }));
  return { fluidbox, state, control, shown };
}

const labelProp = {
  label: { type: [String, Boolean] as PropType<string | false>, default: undefined },
};

function control(name: Exclude<FluidboxControlName, "download" | "counter">, displayName: string) {
  return defineComponent({
    name: displayName,
    inheritAttrs: false,
    props: labelProp,
    setup(props, { attrs, slots }) {
      const { fluidbox, control, shown } = useControl(name);
      const run = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        // Prevented, so the viewer's own handling of the attribute skips it.
        event.preventDefault();
        void control.run(fluidbox, event);
      };
      return () => {
        const { disabled, hidden, label } = shown.value;
        const { naming, content } = named(
          slots.default?.(),
          props.label,
          label,
          attrs["aria-label"],
        );
        return h(
          "button",
          mergeProps({ type: "button", disabled, hidden: hidden || undefined }, attrs, naming, {
            [control.attribute]: "",
            "data-fluidbox-managed": "",
            onClick: run,
          }),
          content,
        );
      };
    },
  });
}

/** Closes the viewer. With no content, it shows its label. */
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
/** Makes the viewer fullscreen, or leaves it. Hidden where fullscreen isn't available. */
const Fullscreen = control("fullscreen", "FluidboxFullscreen");
/** Shares the item's link, or copies it. Hidden without a link or a way to share it. */
const Share = control("share", "FluidboxShare");
/** Loads the failed media again. */
const Retry = control("retry", "FluidboxRetry");
const parts = {
  previous: Previous,
  next: Next,
  close: Close,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  zoomReset: ZoomReset,
};

/** A link that downloads the item on show's file. Off-site files are fetched, so they download too. */
const Download = defineComponent({
  name: "FluidboxDownload",
  inheritAttrs: false,
  props: labelProp,
  setup(props, { attrs, slots }) {
    const { fluidbox, state, control, shown } = useControl("download");
    const run = (event: MouseEvent) => {
      const href = (event.currentTarget as HTMLAnchorElement).href;
      // A same-site file downloads by itself; elsewhere the browser would navigate.
      if (event.defaultPrevented || !href || !crossOrigin(href)) return;
      event.preventDefault();
      void fluidbox.download();
    };
    return () => {
      const { hidden, label } = shown.value;
      const { naming, content } = named(slots.default?.(), props.label, label, attrs["aria-label"]);
      return h(
        "a",
        mergeProps(
          { ...downloadLink(state.value.item), hidden: hidden || undefined },
          attrs,
          naming,
          { [control.attribute]: "", "data-fluidbox-managed": "", onClick: run },
        ),
        content,
      );
    };
  },
});

/** A group of controls. With no content it holds Previous, Next and Close. */
const Toolbar = defineComponent({
  name: "FluidboxToolbar",
  setup(_, { slots }) {
    return () =>
      h(
        "div",
        { role: "group", "data-fluidbox-toolbar": "" },
        slots.default?.() ?? controlNames.map((name) => h(parts[name], { key: name })),
      );
  },
});

/** The zoom controls' group, named like the zoomed image. With no content it holds Zoom in, Zoom out and Fit. */
const ZoomControls = defineComponent({
  name: "FluidboxZoomControls",
  setup(_, { slots }) {
    const { labels } = useRootContext();
    return () =>
      h(
        "div",
        { role: "group", "aria-label": labels.value.zoomed, "data-fluidbox-zoom-controls": "" },
        slots.default?.() ?? zoomControlNames.map((name) => h(parts[name], { key: name })),
      );
  },
});

/**
 * Where the viewer is, as `1 / 4`, or what its slot makes of `{ index, count }`.
 * Hidden from screen readers, which hear the slide's name.
 */
const Counter = defineComponent({
  name: "FluidboxCounter",
  slots: Object as SlotsType<{
    default?: (counter: { readonly index: number; readonly count: number }) => VNode[];
  }>,
  setup(_, { slots }) {
    const { state, labels } = useRootContext();
    return () => {
      const { index, count } = state.value;
      return h(
        "span",
        {
          "aria-hidden": "true",
          hidden: index === null || undefined,
          "data-fluidbox-counter": "",
          // The binding renders it; the core's painting would replace its slot.
          "data-fluidbox-managed": "",
        },
        index === null
          ? undefined
          : slots.default
            ? slots.default({ index, count })
            : labels.value.counter(index, count),
      );
    };
  },
});

/**
 * The item's caption, which describes the dialog, or what its slot makes of
 * `{ item, index }`. Inside a slide it is that slide's item; elsewhere the item
 * on show. Nothing without a caption.
 */
const Caption = defineComponent({
  name: "FluidboxCaption",
  slots: Object as SlotsType<{ default?: (context: FluidboxItemContext) => VNode[] }>,
  setup(_, { slots }) {
    const { state } = useRootContext();
    const slide = inject(SlideKey, null)?.slide;
    return () => {
      const item = slide ? slide.item : state.value.item;
      const index = slide ? slide.index : state.value.index;
      if (!item || index === null) return null;
      const content = slots.default ? slots.default({ item, index }) : item.caption;
      if (content === undefined || content === null || content === "") return null;
      return h("div", { "data-fluidbox-caption": "", "data-fluidbox-description": "" }, content);
    };
  },
});

/** The loading and error state of the slide a part follows: its own, or the one on show. */
function useSlideStatus() {
  const { fluidbox, viewerTarget } = useRootContext();
  const slide = inject(SlideKey, null)?.slide;
  const busy = shallowRef(false);
  const error = shallowRef(false);
  const causes = new Map<number, unknown>();
  watchEffect(
    (onCleanup) => {
      const root = slide
        ? slide.media.closest<HTMLElement>("[data-fluidbox-slide]")
        : viewerTarget.value?.closest<HTMLElement>("[data-fluidbox-dialog]");
      if (!root) return;
      const events = new AbortController();
      fluidbox.addEventListener("mediaerror", (event) => causes.set(event.index, event.cause), {
        signal: events.signal,
      });
      const read = () => {
        const shown = slide ? root : root.querySelector("[data-fluidbox-slide][data-active]");
        busy.value = !!shown?.hasAttribute("data-busy");
        error.value = !!shown?.hasAttribute("data-error");
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
    },
    { flush: "post" },
  );
  return { busy, error, slide, causes };
}

/** Its default slot, while the item on show is loading. */
const Loading = defineComponent({
  name: "FluidboxLoading",
  setup(_, { slots }) {
    const { busy } = useSlideStatus();
    return () =>
      busy.value
        ? h("div", { "aria-hidden": "true", "data-fluidbox-loading": "" }, slots.default?.())
        : null;
  },
});

/**
 * Its default slot, in place of the default error, while the item on show
 * failed. The slot gets `{ item, error }`, where `error` is the `cause` of
 * the item's last `mediaerror`.
 */
const ErrorPart = defineComponent({
  name: "FluidboxError",
  slots: Object as SlotsType<{
    default?: (failed: { readonly item: FluidboxItem; readonly error: unknown }) => VNode[];
  }>,
  setup(_, { slots }) {
    const { state } = useRootContext();
    const { error, slide, causes } = useSlideStatus();
    return () => {
      const item = slide ? slide.item : state.value.item;
      const index = slide ? slide.index : state.value.index;
      if (!error.value || !item) return null;
      return h(
        "div",
        { "data-fluidbox-error-content": "" },
        slots.default?.({ item, error: index === null ? undefined : causes.get(index) }),
      );
    };
  },
});

/** The slots on show, patched into at once as they change. */
function useSlotList(
  slots: FluidboxSlots<AnyItem>,
  onChange?: (shown: readonly FluidboxSlot<AnyItem>[]) => void,
) {
  const patch = usePatch();
  const list = shallowRef<readonly FluidboxSlot<AnyItem>[]>(slots.slots);
  const keys = new WeakMap<FluidboxSlot<AnyItem>, number>();
  let nextKey = 0;
  const key = (slot: FluidboxSlot<AnyItem>) => {
    if (!keys.has(slot)) keys.set(slot, nextKey++);
    return keys.get(slot)!;
  };
  onBeforeUnmount(
    slots.subscribe(() => {
      list.value = slots.slots;
      onChange?.(slots.slots);
      patch();
    }),
  );
  return {
    list,
    teleport: (content: (slot: FluidboxSlot<AnyItem>) => VNodeChild) =>
      list.value.map((slot) => h(Teleport, { key: key(slot), to: slot.target }, [content(slot)])),
  };
}

/**
 * Turns the thumbnails on. With a default slot, it fills each thumbnail
 * button, getting `{ item, index, active }`; the selected button has `data-active`.
 */
const Thumbnails = defineComponent({
  name: "FluidboxThumbnails",
  slots: Object as SlotsType<{
    default?: (thumbnail: FluidboxThumbnailContext) => VNode[];
  }>,
  setup(_, { slots }) {
    const { setAddon, thumbnailsSlots, state, serverHints } = useRootContext();
    // Read by the server's copy of the open viewer, which renders after this.
    serverHints.thumbnails = true;
    // Once mounted, so a server render loads nothing, and again when a slot
    // comes or goes.
    let custom: boolean | undefined;
    const register = () => {
      if (custom === !!slots.default) return;
      custom = !!slots.default;
      setAddon("thumbnails", { custom });
    };
    onMounted(register);
    onUpdated(register);
    onBeforeUnmount(() => setAddon("thumbnails", null));
    const strip = useSlotList(thumbnailsSlots);
    return () => {
      if (!slots.default) return null;
      const shown = state.value.index;
      return strip.teleport(({ item, index }) =>
        slots.default?.({ item, index, active: index === shown }),
      );
    };
  },
});

/**
 * Turns the sheet on: a panel over the photo for the item on show. The
 * viewer's `<section data-fluidbox-sheet>` is the sheet and gets this part's
 * attributes; the default slot is its content and gets `{ item, index }`.
 * Import `@ogdakke/fluidbox/sheet.css` once.
 */
const Sheet = defineComponent({
  name: "FluidboxSheet",
  inheritAttrs: false,
  props: {
    /**
     * The snaps above the resting one, lowest first.
     * @default ["60%", "content"]
     */
    snapPoints: Array as PropType<readonly FluidboxSheetSnapPoint[]>,
    /**
     * What a swipe down on the photo does with the sheet down.
     * @default "flight"
     */
    dismissMotion: String as PropType<FluidboxSheetProps["dismissMotion"]>,
  },
  emits: {
    /** When the sheet comes to rest at another snap. */
    snapChange: (_event: FluidboxSheetEvent) => true,
  },
  slots: Object as SlotsType<{
    default?: (sheet: FluidboxItemContext) => VNode[];
  }>,
  setup(props, { attrs, emit, slots }) {
    const { fluidbox, setAddon, sheetSlots, serverHints } = useRootContext();
    // Read by the server's copy of the open viewer, which renders after this.
    serverHints.sheet = true;
    // The snap points are compared by value, so an inline array changes nothing.
    // Once mounted, so a server render loads nothing.
    onMounted(() =>
      watch(
        () => JSON.stringify([props.snapPoints ?? null, props.dismissMotion ?? null]),
        () =>
          setAddon("sheet", {
            snapPoints: props.snapPoints && [...toRaw(props.snapPoints)],
            dismissMotion: props.dismissMotion,
          }),
        { immediate: true },
      ),
    );
    onBeforeUnmount(() => setAddon("sheet", null));
    const events = new AbortController();
    fluidbox.addEventListener("sheetchange", (event) => emit("snapChange", event), {
      signal: events.signal,
    });
    onBeforeUnmount(() => events.abort());
    const restores = new Map<HTMLElement, () => void>();
    const decorate = (shown: readonly FluidboxSlot<AnyItem>[]) => {
      for (const [container, restore] of restores) {
        restore();
        restores.delete(container);
      }
      for (const { container } of shown) restores.set(container, applyAttributes(container, attrs));
    };
    const sheet = useSlotList(sheetSlots, decorate);
    onMounted(() => decorate(sheet.list.value));
    onUpdated(() => decorate(sheet.list.value));
    onBeforeUnmount(() => decorate([]));
    return () => sheet.teleport(({ item, index }) => slots.default?.({ item, index }));
  },
});

/** A button that moves the sheet to the snap `to`. Its content names it, unless `label` says otherwise. */
const SheetSnap = defineComponent({
  name: "FluidboxSheetSnap",
  inheritAttrs: false,
  props: { to: { type: Number, required: true }, ...labelProp },
  setup(props, { attrs, slots }) {
    const { labels } = useRootContext();
    return () => {
      // Its content usually names it, so the label names it only when asked.
      const { naming, content } = named(
        slots.default?.(),
        props.label ?? false,
        labels.value.sheet,
        attrs["aria-label"],
      );
      return h(
        "button",
        mergeProps({ type: "button" }, attrs, naming, {
          "data-fluidbox-sheet-snap": String(props.to),
        }),
        content,
      );
    };
  },
});

/** The live copy of an overlay's content that flies with the photo. */
const Travelling = defineComponent({
  name: "FluidboxTravelling",
  setup(_, { slots }) {
    provide(TravelKey, true);
    return () => slots.default?.();
  },
});

/**
 * A badge, caption or scrim on a trigger. It gets `--fluidbox-closed` and
 * `data-fluidbox-phase` as the viewer opens and closes, and goes with the
 * photo's flight as `flight` says.
 */
const Overlay = defineComponent({
  name: "FluidboxOverlay",
  inheritAttrs: false,
  props: {
    flight: {
      type: String as PropType<"none" | "copy" | "live" | "frame">,
      default: "none",
    },
  },
  setup(props, { attrs, slots }) {
    const { fluidbox, mount, items } = useRootContext();
    const trigger = inject(TriggerKey, null);
    // In the live copy a flight renders, an overlay is a picture, not another overlay.
    const travelling = inject(TravelKey, false);
    if (!trigger && !travelling) {
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
    const element = shallowRef<HTMLElement | null>(null);
    if (trigger && !travelling) {
      watchEffect(
        (onCleanup) => {
          const overlay = element.value;
          void items.value;
          if (!overlay) return;
          const { flight } = props;
          onCleanup(
            fluidbox.bindOverlay(overlay, trigger.keys(), {
              flight:
                flight === "live"
                  ? {
                      live: ({ target }) =>
                        mount(target, () => h(Travelling, null, () => slots.default?.())),
                    }
                  : flight,
            }),
          );
        },
        { flush: "post" },
      );
    }
    return () =>
      // The frame overlay itself flies, so a live copy leaves it out.
      travelling && props.flight === "frame"
        ? null
        : h(
            "span",
            mergeProps(attrs, { ref: element, "data-fluidbox-trigger-overlay": props.flight }),
            slots.default?.(),
          );
  },
});

/**
 * The viewer's state and commands, in one reactive object, or a part of it
 * picked by `selector` as a computed ref. Call it in a component inside Root.
 */
export function useFluidbox<TItem extends FluidboxItem = FluidboxItem>(): FluidboxApi<TItem>;
export function useFluidbox<TSelected, TItem extends FluidboxItem = FluidboxItem>(
  selector: (fluidbox: FluidboxApi<TItem>) => TSelected,
): ComputedRef<TSelected>;
export function useFluidbox<TSelected>(
  selector?: (fluidbox: FluidboxApi) => TSelected,
): FluidboxApi | ComputedRef<TSelected> {
  const { api } = useRootContext();
  return selector ? computed(() => selector(api)) : api;
}

/** The sheet's snap, which follows `sheetchange`, and a function that moves it, in one reactive object. */
export function useFluidboxSheet(): FluidboxSheetApi {
  return useRootContext().sheet;
}

/** Every part, as `<Fluidbox.Root>` and so on. */
export const Fluidbox = {
  Root,
  Trigger,
  Overlay,
  Slides,
  Media,
  Image,
  Video,
  Iframe,
  Hotspot,
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
export type FluidboxVueParts = typeof Fluidbox;

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
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return "<Fluidbox.Trigger as-child> needs exactly one child element.";
        } catch {}
        return "fluidbox";
      })(),
    );
  }
  return elements[0]!;
}
