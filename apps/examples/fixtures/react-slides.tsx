import { mountSite } from "../src/site";
import {
  StrictMode,
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactElement,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxSlideOrigin,
} from "@ogdakke/fluidbox";
import { Fluidbox, useFluidboxSlide } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";

mountSite("fixtures", {
  fixture: "React slides · content that suspends, holds the open, or plays on its own",
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
  /** Resolves the lazy slide's module. */
  resolveLazy: undefined as (() => void) | undefined,
  /** Settles the held slide's waitUntil promise. */
  openGate: undefined as (() => void) | undefined,
  /** Each reel slide's origin, read again whenever the test asks. */
  reels: [] as { index: number; read: () => FluidboxSlideOrigin | null }[],
  /** Each held slide's index, read again whenever the test asks. */
  held: [] as { id: string; read: () => number }[],
  /** The items of the held viewer, which the test can change. */
  setHeldItems: undefined as ((items: FluidboxItem[]) => void) | undefined,
};
Object.assign(window, { reactSlides: fixture });

const photo = (id: string, src: string): FluidboxImageItem => ({
  type: "image",
  id,
  src,
  alt: `Photo ${id}`,
  width: 800,
  height: 800,
});
const photos = [photo("one", "/photo-square.svg"), photo("two", "/photo-portrait.svg")];

function Grid({ items, id }: { items: readonly FluidboxItem[]; id: string }) {
  return (
    <div className="media-grid" id={id}>
      {items.map((item) => (
        <Fluidbox.Trigger key={item.id} value={item.id!} data-item={item.id}>
          <img alt="" src={item.type === "image" ? item.src : "/photo-square.svg"} />
        </Fluidbox.Trigger>
      ))}
    </div>
  );
}

// A slide whose code loads on its first open, until the test lets it.
const LazyCard = lazy(
  () =>
    new Promise<{ default: () => ReactElement }>((resolve) => {
      fixture.resolveLazy = () =>
        resolve({
          default: () => (
            <Fluidbox.Media>
              <div className="media-probe" data-test="lazy-card">
                Loaded
              </div>
            </Fluidbox.Media>
          ),
        });
    }),
);

const gate = new Promise<void>((resolve) => (fixture.openGate = resolve));

function Held() {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"held">>();
  useLayoutEffect(() => {
    slide.waitUntil(gate);
    fixture.held.push({ id: slide.item.id!, read: () => slide.index });
  }, [slide]);
  return (
    <Fluidbox.Media>
      <div className="media-probe" data-test="held-card">
        {slide.item.title} at {slide.index}
      </div>
    </Fluidbox.Media>
  );
}

function Reel() {
  const slide = useFluidboxSlide<FluidboxCustomItemBase<"reel">>();
  useEffect(() => {
    fixture.reels.push({ index: slide.index, read: () => slide.origin });
  }, [slide]);
  // As a player of your own would: it hands its time back on close.
  useEffect(() => slide.returnPlayback({ currentTime: 2.5, paused: false }), [slide]);
  return (
    <Fluidbox.Media>
      <div className="media-probe" data-test="reel">
        {slide.item.title}
      </div>
    </Fluidbox.Media>
  );
}

const custom = (type: "lazy" | "held" | "reel", id: string): FluidboxItem => ({
  type,
  id,
  title: `${type} ${id}`,
  width: 800,
  height: 600,
});
const reels = [custom("reel", "reel-a"), custom("reel", "reel-b")];

function HeldViewer() {
  const [items, setItems] = useState<FluidboxItem[]>(() => [
    custom("held", "held-a"),
    custom("held", "held-b"),
  ]);
  fixture.setHeldItems = setItems;
  return (
    <Fluidbox.Root items={items}>
      <Grid items={items} id="held" />
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
      <Fluidbox.Root items={photos}>
        <Grid items={photos} id="custom" />
        <Fluidbox.Slides image={() => <Fluidbox.Image />} />
      </Fluidbox.Root>
      <h2>A slide that suspends</h2>
      <Fluidbox.Root items={[custom("lazy", "lazy")]}>
        <Grid items={[custom("lazy", "lazy")]} id="lazy" />
        <Fluidbox.Slides lazy={() => <LazyCard />} />
      </Fluidbox.Root>
      <h2>A slide that holds the open</h2>
      <HeldViewer />
      <h2>A player of your own that continues the trigger's video</h2>
      <Fluidbox.Root items={reels}>
        <div className="media-grid" id="reels">
          <Fluidbox.Trigger value="reel-a" data-item="reel-a">
            <video data-fluidbox-origin autoPlay loop muted playsInline src="/video/drift.webm" />
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

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    {/* Shows in place of the page if a slide's suspense escapes the viewer. */}
    <Suspense fallback={<p id="page-fallback">The page suspended.</p>}>
      <App />
    </Suspense>
  </StrictMode>,
);
