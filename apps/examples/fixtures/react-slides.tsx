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
import { modelItem } from "@ogdakke/fluidbox/model";
import { Fluidbox, useFluidboxSlide } from "@ogdakke/fluidbox/react";
import { Model } from "@ogdakke/fluidbox/react/model";
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

const MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

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
  /** Loads <model-viewer>, which the test serves, for the live model card. */
  loadModels: () => import(/* @vite-ignore */ MODEL_VIEWER),
  /** The controlled value of the model viewer, which the test can set. */
  setModelValue: undefined as ((value: string | null) => void) | undefined,
};
/** Each reachend the growing gallery heard: its value, index and count. */
const reachEnds: [string, number, number][] = [];
Object.assign(window, { reactSlides: fixture, reachEnds });

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

const helmet = modelItem({
  id: "helmet",
  title: "Damaged Helmet",
  src: "/products/damaged-helmet/damaged-helmet.glb",
  width: 800,
  height: 800,
});

/** A live model card whose viewer the page's state owns. */
function ControlledModel() {
  const [value, setValue] = useState<string | null>(null);
  fixture.setModelValue = setValue;
  return (
    <Fluidbox.Root items={[helmet]} value={value} onValueChange={(next) => setValue(next)}>
      <div className="media-grid" id="models">
        <Fluidbox.Trigger
          value="helmet"
          data-item="helmet"
          aria-label="Open 3D view: Damaged Helmet"
        >
          <model-viewer src={helmet.src} camera-controls="" touch-action="pan-y" />
        </Fluidbox.Trigger>
      </div>
      <Fluidbox.Slides model={() => <Model load={fixture.loadModels} />} />
    </Fluidbox.Root>
  );
}

/** The first `count` photos of a gallery that grows, the same objects each time. */
const grown: FluidboxImageItem[] = [];
const growing = (count: number) => {
  for (let index = grown.length; index < count; index++) {
    grown.push(photo(`grow-${index}`, index % 2 ? "/photo-portrait.svg" : "/photo-square.svg"));
  }
  return grown.slice(0, count);
};

/** A gallery that appends four photos each time the viewer nears its end. */
function Growing() {
  const [items, setItems] = useState(() => growing(4));
  return (
    <Fluidbox.Root
      items={items}
      reachEndThreshold={1}
      onReachEnd={({ value, index, count }) => {
        reachEnds.push([value, index, count]);
        setItems(growing(count + 4));
      }}
    >
      <Grid items={items} id="growing" />
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
      <h2>A counter of your own</h2>
      <Fluidbox.Root items={photos}>
        <Grid items={photos} id="counter" />
        <Fluidbox.Viewer>
          <Fluidbox.Counter>
            {({ index, count }) => (
              <b data-test="counter">
                {index + 1} of {count}
              </b>
            )}
          </Fluidbox.Counter>
          <Fluidbox.Next />
        </Fluidbox.Viewer>
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
      <h2>A gallery that grows as the viewer nears its end</h2>
      <Growing />
      <h2>A live 3D model card, with the value in the page's state</h2>
      <ControlledModel />
      <p className="fb-muted">
        3D model: Damaged Helmet, from the Khronos glTF Sample Assets. © 2016 theblueturtle_, CC
        BY-NC 4.0; glTF rebuild © 2018 ctxwing, CC BY 4.0. For non-commercial use only.
      </p>
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
