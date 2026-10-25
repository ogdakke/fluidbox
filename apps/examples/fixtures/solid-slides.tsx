/** @jsxImportSource solid-js */
import { mountSite } from "../src/site";
import {
  createResource,
  createSignal,
  For,
  lazy,
  onCleanup,
  onMount,
  Suspense,
  type Component,
} from "solid-js";
import { render } from "solid-js/web";
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxSlideOrigin,
} from "@ogdakke/fluidbox";
import { Fluidbox, useFluidboxSlide } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/baseline.css";
import "@ogdakke/fluidbox/thumbnails.css";
import "./media.css";

mountSite("fixtures", {
  fixture: "Solid slides · content that suspends, holds the open, or plays on its own",
});

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    lazy: FluidboxCustomItemBase<"lazy">;
    fetched: FluidboxCustomItemBase<"fetched">;
    held: FluidboxCustomItemBase<"held">;
    reel: FluidboxCustomItemBase<"reel">;
  }
}

/** What the slides saw, and the gates the tests open. */
const fixture = {
  /** Resolves the lazy slide's module. */
  resolveLazy: undefined as (() => void) | undefined,
  /** Resolves the fetched slide's resource. */
  resolveFetch: undefined as (() => void) | undefined,
  /** Settles the held slide's waitUntil promise. */
  openGate: undefined as (() => void) | undefined,
  /** Each reel slide's origin, read again whenever the test asks. */
  reels: [] as { index: number; read: () => FluidboxSlideOrigin | null }[],
  /** Each held slide's index, read again whenever the test asks. */
  held: [] as { id: string; read: () => number }[],
  /** The items of the held viewer, which the test can change. */
  setHeldItems: undefined as ((items: FluidboxItem[]) => void) | undefined,
  /** The ids of the items whose media failed. */
  errors: [] as string[],
  /** While true, the parts viewer's Close calls preventDefault in its onClick. */
  keepOpen: false,
  /** How many times that onClick ran. */
  closeClicks: 0,
  /** Each onValueChange of the controlled viewer, as "action reason value". */
  changes: [] as string[],
  /** The controlled viewer's value signal, and its setter. */
  value: undefined as (() => string | null) | undefined,
  setValue: undefined as ((value: string | null) => void) | undefined,
  /** While true, the controlled viewer cancels moves and leaves its value. */
  cancelMoves: false,
  /** Switches the thumbnails viewer between your thumbnails and the default ones. */
  setCustomThumbnails: undefined as ((custom: boolean) => void) | undefined,
  /** How many times each slide reported mounting its content. */
  mounted: {} as Record<string, number>,
};
Object.assign(window, { solidSlides: fixture });

const photo = (id: string, src: string): FluidboxImageItem => ({
  type: "image",
  id,
  src,
  alt: `Photo ${id}`,
  width: 800,
  height: 800,
});
const photos = [photo("one", "/photo-square.svg"), photo("two", "/photo-portrait.svg")];

function Grid(props: { items: readonly FluidboxItem[]; id: string }) {
  return (
    <div class="media-grid" id={props.id}>
      <For each={props.items}>
        {(item) => (
          <Fluidbox.Trigger value={item.id!} data-item={item.id}>
            <img alt="" src={item.type === "image" ? item.src : "/photo-square.svg"} />
          </Fluidbox.Trigger>
        )}
      </For>
    </div>
  );
}

// A slide whose code loads on its first open, until the test lets it.
const LazyCard = lazy(
  () =>
    new Promise<{ default: Component }>((resolve) => {
      fixture.resolveLazy = () =>
        resolve({
          default: () => (
            <Fluidbox.Media>
              <div class="media-probe" data-test="lazy-card">
                Loaded
              </div>
            </Fluidbox.Media>
          ),
        });
    }),
);

// A slide that reads a resource, which loads until the test lets it.
function Fetched() {
  const [text] = createResource(
    () =>
      new Promise<string>((resolve) => {
        fixture.resolveFetch = () => resolve("Fetched");
      }),
  );
  onMount(() => {
    fixture.mounted.fetched = (fixture.mounted.fetched ?? 0) + 1;
  });
  return (
    <Fluidbox.Media>
      <div class="media-probe" data-test="fetched-card">
        {text()}
      </div>
    </Fluidbox.Media>
  );
}

const gate = new Promise<void>((resolve) => (fixture.openGate = resolve));

function Held() {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"held">>();
  slide.waitUntil(gate);
  fixture.held.push({ id: slide.item.id!, read: () => slide.index });
  return (
    <Fluidbox.Media>
      <div class="media-probe" data-test="held-card">
        {slide.item.title} at {slide.index}
      </div>
    </Fluidbox.Media>
  );
}

function Reel() {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"reel">>();
  fixture.reels.push({ index: slide.index, read: () => slide.origin });
  // As a player of your own would: it hands its time back on close.
  onCleanup(slide.returnPlayback({ currentTime: 2.5, paused: false }));
  return (
    <Fluidbox.Media>
      <div class="media-probe" data-test="reel">
        {slide.item.title}
      </div>
    </Fluidbox.Media>
  );
}

const custom = (type: "lazy" | "fetched" | "held" | "reel", id: string): FluidboxItem => ({
  type,
  id,
  title: `${type} ${id}`,
  width: 800,
  height: 600,
});
const reels = [custom("reel", "reel-a"), custom("reel", "reel-b")];
const partsItems = [
  { ...photo("square", "/photo-square.svg"), caption: "A square study" },
  photo("broken", "/missing-photo.webp"),
];

function ControlledViewer() {
  const [value, setValue] = createSignal<string | null>(null);
  fixture.value = value;
  fixture.setValue = setValue;
  return (
    <Fluidbox.Root
      items={photos}
      value={value()}
      onValueChange={(next, details) => {
        fixture.changes.push(`${details.action} ${details.reason} ${next}`);
        if (fixture.cancelMoves && details.action === "move") details.cancel();
        else setValue(next);
      }}
    >
      <Grid items={photos} id="controlled" />
    </Fluidbox.Root>
  );
}

function ThumbnailsViewer() {
  const [custom, setCustom] = createSignal(false);
  fixture.setCustomThumbnails = setCustom;
  return (
    <Fluidbox.Root items={photos}>
      <Grid items={photos} id="thumbnails" />
      <Fluidbox.Thumbnails>
        {custom()
          ? ({ index }: { index: number }) => <span data-test="thumb">{index + 1}</span>
          : undefined}
      </Fluidbox.Thumbnails>
    </Fluidbox.Root>
  );
}

function HeldViewer() {
  const [items, setItems] = createSignal<FluidboxItem[]>([
    custom("held", "held-a"),
    custom("held", "held-b"),
  ]);
  fixture.setHeldItems = setItems;
  return (
    <Fluidbox.Root items={items()}>
      <Grid items={items()} id="held" />
      <Fluidbox.Slides held={() => <Held />} />
    </Fluidbox.Root>
  );
}

function App() {
  return (
    <>
      <p id="outside">The page around the viewers.</p>
      <h2>Built-in images, and the same through a slide of your own</h2>
      <Fluidbox.Root items={photos}>
        <Grid items={photos} id="builtin" />
      </Fluidbox.Root>
      <h2>A slideshow, with a Slideshow of text and one with an icon</h2>
      <Fluidbox.Root items={photos} slideshow={{ interval: 60_000 }}>
        <Grid items={photos} id="slideshow" />
        <Fluidbox.Viewer>
          <Fluidbox.Slideshow data-test="slideshow-text" />
          <Fluidbox.Slideshow data-test="slideshow-icon">
            <svg aria-hidden="true" />
          </Fluidbox.Slideshow>
          <Fluidbox.Close />
        </Fluidbox.Viewer>
      </Fluidbox.Root>
      <Fluidbox.Root items={photos}>
        <Grid items={photos} id="custom" />
        <Fluidbox.Slides image={() => <Fluidbox.Image />} />
      </Fluidbox.Root>
      <h2>A slide that suspends</h2>
      <Fluidbox.Root items={[custom("lazy", "lazy")]}>
        <Grid items={[custom("lazy", "lazy")]} id="lazy" />
        <Fluidbox.Slides lazy={() => <LazyCard />} />
      </Fluidbox.Root>
      <Fluidbox.Root items={[custom("fetched", "fetched")]}>
        <Grid items={[custom("fetched", "fetched")]} id="fetched" />
        <Fluidbox.Slides fetched={() => <Fetched />} />
      </Fluidbox.Root>
      <h2>A controlled value</h2>
      <ControlledViewer />
      <h2>Thumbnails that switch between yours and the default ones</h2>
      <ThumbnailsViewer />
      <h2>A slide that holds the open</h2>
      <HeldViewer />
      <h2>The viewer's parts, with a photo that fails</h2>
      <Fluidbox.Root
        items={partsItems}
        onMediaError={(event) => fixture.errors.push(event.item.id!)}
      >
        <Grid items={partsItems} id="parts" />
        <Fluidbox.Viewer>
          <Fluidbox.Toolbar>
            <Fluidbox.Counter />
            <Fluidbox.Download />
            <Fluidbox.Close
              label={false}
              onClick={(event) => {
                fixture.closeClicks += 1;
                if (fixture.keepOpen) event.preventDefault();
              }}
            >
              Done
            </Fluidbox.Close>
          </Fluidbox.Toolbar>
          <Fluidbox.ZoomControls />
          <Fluidbox.Next>
            <span>›</span>
          </Fluidbox.Next>
          <Fluidbox.Caption />
          <Fluidbox.Error<FluidboxImageItem>>
            {({ item }) => (
              <p data-test="error">
                {item.alt} failed <Fluidbox.Retry />
              </p>
            )}
          </Fluidbox.Error>
        </Fluidbox.Viewer>
      </Fluidbox.Root>
      <h2>A player of your own that continues the trigger's video</h2>
      <Fluidbox.Root items={reels}>
        <div class="media-grid" id="reels">
          <Fluidbox.Trigger value="reel-a" data-item="reel-a">
            <video data-fluidbox-origin autoplay loop muted playsinline src="/video/drift.webm" />
          </Fluidbox.Trigger>
          <Fluidbox.Trigger value="reel-b" data-item="reel-b">
            <img alt="" src="/video/drift-poster.jpg" />
          </Fluidbox.Trigger>
        </div>
        <Fluidbox.Slides reel={() => <Reel />} />
      </Fluidbox.Root>
    </>
  );
}

render(
  () => (
    // Shows in place of the page if a slide's suspense escapes the viewer.
    <Suspense fallback={<p id="page-fallback">The page suspended.</p>}>
      <App />
    </Suspense>
  ),
  document.querySelector("#root")!,
);
