import { mountSite } from "../src/site";
import {
  Suspense,
  createApp,
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  type Component,
} from "vue";
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxSlideOrigin,
} from "@ogdakke/fluidbox";
import { Fluidbox, useFluidboxSlide } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";

mountSite("fixtures", {
  fixture: "Vue slides · content that suspends, holds the open, or plays on its own",
});

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    lazy: FluidboxCustomItemBase<"lazy">;
    held: FluidboxCustomItemBase<"held">;
    reel: FluidboxCustomItemBase<"reel">;
  }
}

/** What the slides saw, and the gates the tests open. */
const fixture = {
  /** Resolves the lazy slide's component. */
  resolveLazy: undefined as (() => void) | undefined,
  /** Settles the held slide's waitUntil promise. */
  openGate: undefined as (() => void) | undefined,
  /** Each reel slide's origin, read again whenever the test asks. */
  reels: [] as { index: number; read: () => FluidboxSlideOrigin | null }[],
  /** Each held slide's index, read again whenever the test asks. */
  held: [] as { id: string; read: () => number }[],
  /** The items of the held viewer, which the test can change. */
  setHeldItems: undefined as ((items: FluidboxItem[]) => void) | undefined,
  /** Unmount the built-in viewer's Root and mount a new one, as a re-created view does. */
  remount: undefined as (() => void) | undefined,
  /** How many mediaerror events the parts viewer has emitted. */
  mediaErrors: () => 0,
};
Object.assign(window, { vueSlides: fixture });

const photo = (id: string, src: string): FluidboxImageItem => ({
  type: "image",
  id,
  src,
  alt: `Photo ${id}`,
  width: 800,
  height: 800,
});
const photos = [photo("one", "/photo-square.svg"), photo("two", "/photo-portrait.svg")];

const Grid = defineComponent({
  props: {
    items: { type: Array as () => readonly FluidboxItem[], required: true },
    id: { type: String, required: true },
  },
  setup: (props) => () =>
    h(
      "div",
      { class: "media-grid", id: props.id },
      props.items.map((item) =>
        h(Fluidbox.Trigger, { key: item.id, value: item.id!, "data-item": item.id }, () =>
          h("img", { alt: "", src: item.type === "image" ? item.src : "/photo-square.svg" }),
        ),
      ),
    ),
});

// A slide whose component loads on its first open, until the test lets it.
const LazyCard = defineAsyncComponent(
  () =>
    new Promise<Component>((resolve) => {
      fixture.resolveLazy = () =>
        resolve(
          defineComponent(
            () => () =>
              h(Fluidbox.Media, null, () =>
                h("div", { class: "media-probe", "data-test": "lazy-card" }, "Loaded"),
              ),
          ),
        );
    }),
);

const gate = new Promise<void>((resolve) => (fixture.openGate = resolve));

const Held = defineComponent(() => {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"held">>();
  slide.waitUntil(gate);
  fixture.held.push({ id: slide.item.id!, read: () => slide.index });
  return () =>
    h(Fluidbox.Media, null, () =>
      h(
        "div",
        { class: "media-probe", "data-test": "held-card" },
        `${slide.item.title} at ${slide.index}`,
      ),
    );
});

const Reel = defineComponent(() => {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"reel">>();
  // As a player of your own would: it hands its time back on close.
  let release: (() => void) | undefined;
  onMounted(() => {
    fixture.reels.push({ index: slide.index, read: () => slide.origin });
    release = slide.returnPlayback({ currentTime: 2.5, paused: false });
  });
  onBeforeUnmount(() => release?.());
  return () =>
    h(Fluidbox.Media, null, () =>
      h("div", { class: "media-probe", "data-test": "reel" }, slide.item.title as string),
    );
});

const custom = (type: "lazy" | "held" | "reel", id: string): FluidboxItem => ({
  type,
  id,
  title: `${type} ${id}`,
  width: 800,
  height: 600,
});
const reels = [custom("reel", "reel-a"), custom("reel", "reel-b")];
const lazyItems = [custom("lazy", "lazy")];

const HeldViewer = defineComponent(() => {
  const items = shallowRef<FluidboxItem[]>([custom("held", "held-a"), custom("held", "held-b")]);
  fixture.setHeldItems = (next) => (items.value = next);
  return () =>
    h(Fluidbox.Root, { items: items.value }, () => [
      h(Grid, { items: items.value, id: "held" }),
      h(Fluidbox.Slides, null, { held: () => h(Held) }),
    ]);
});

// The parts of the viewer, over a photo with a caption and a file and one that fails.
const partsItems: FluidboxItem[] = [
  { ...photo("caption", "/photo-square.svg"), caption: "A square, captioned" },
  { ...photo("broken", "/missing-photo.jpg"), thumbnail: { src: "/second.svg" } },
];
const mediaErrors = shallowRef(0);
fixture.mediaErrors = () => mediaErrors.value;

const Parts = defineComponent(
  () => () =>
    h(
      Fluidbox.Root,
      {
        items: partsItems,
        href: (value: string | null) => (value ? `/vue-slides.html?photo=${value}` : undefined),
        onMediaError: () => mediaErrors.value++,
      },
      () => [
        h(Grid, { items: partsItems, id: "parts" }),
        h(Fluidbox.Viewer, null, () => [
          h(Fluidbox.Toolbar, null, () => [
            h(Fluidbox.Counter),
            h(Fluidbox.Share),
            h(Fluidbox.Download),
            h(Fluidbox.Fullscreen),
            // Your icon, named by the label.
            h(Fluidbox.Close, null, () => h("svg", { "data-test": "close-icon" })),
          ]),
          h(Fluidbox.Previous, { label: false }, () => "Back"),
          h(Fluidbox.Next),
          h(Fluidbox.Caption, { "data-test": "caption" }),
          h(Fluidbox.Error, null, {
            default: ({ item }: { item: FluidboxItem }) =>
              h("div", { "data-test": "error" }, [
                h("p", `${item.id} didn't load.`),
                h(Fluidbox.Retry, { "data-test": "retry" }),
              ]),
          }),
        ]),
      ],
    ),
);

const App = defineComponent(() => {
  const generation = shallowRef(0);
  fixture.remount = () => generation.value++;
  return () => [
    h("p", { id: "outside" }, "The page around the viewers."),
    h("h2", "Built-in images, and the same through a slide of your own"),
    h(Fluidbox.Root, { key: generation.value, items: photos }, () =>
      h(Grid, { items: photos, id: "builtin" }),
    ),
    h(Fluidbox.Root, { items: photos }, () => [
      h(Grid, { items: photos, id: "custom" }),
      h(Fluidbox.Slides, null, { image: () => h(Fluidbox.Image) }),
    ]),
    h("h2", "The viewer's parts"),
    h(Parts),
    h("h2", "A slide that suspends"),
    h(Fluidbox.Root, { items: lazyItems }, () => [
      h(Grid, { items: lazyItems, id: "lazy" }),
      h(Fluidbox.Slides, null, { lazy: () => h(LazyCard) }),
    ]),
    h("h2", "A slide that holds the open"),
    h(HeldViewer),
    h("h2", "A player of your own that continues the trigger's video"),
    h(Fluidbox.Root, { items: reels }, () => [
      h("div", { class: "media-grid", id: "reels" }, [
        h(Fluidbox.Trigger, { value: "reel-a", "data-item": "reel-a" }, () =>
          h("video", {
            "data-fluidbox-origin": "",
            autoplay: true,
            loop: true,
            muted: true,
            playsinline: true,
            src: "/video/drift.webm",
          }),
        ),
        h(Fluidbox.Trigger, { value: "reel-b", "data-item": "reel-b" }, () =>
          h("img", { alt: "", src: "/video/drift-poster.jpg" }),
        ),
      ]),
      h(Fluidbox.Slides, null, { reel: () => h(Reel) }),
    ]),
  ];
});

createApp(
  defineComponent(
    () => () =>
      // Shows in place of the page if a slide's suspense escapes the viewer.
      h(Suspense, null, {
        default: () => h(App),
        fallback: () => h("p", { id: "page-fallback" }, "The page suspended."),
      }),
  ),
).mount("#root");
