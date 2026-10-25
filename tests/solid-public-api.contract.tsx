/** @jsxImportSource solid-js */
import type { Accessor, JSX } from "solid-js";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import {
  Fluidbox,
  useFluidbox,
  useFluidboxSheet,
  useFluidboxSlide,
  type FluidboxApi,
  type FluidboxMediaErrorEvent,
  type FluidboxSheetApi,
  type FluidboxSheetEvent,
  type FluidboxSlideApi,
  type FluidboxValueChangeDetails,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/solid";
import { Embed } from "@ogdakke/fluidbox/solid/embed";
import { Model } from "@ogdakke/fluidbox/solid/model";
import { Spin } from "@ogdakke/fluidbox/solid/spin";

interface Photo extends FluidboxImageItem {
  readonly id: string;
  readonly credit: string;
}

const items: readonly Photo[] = [
  { id: "one", type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800, credit: "A" },
  { id: "two", type: "image", src: "/two.jpg", alt: "Two", width: 1200, height: 800, credit: "B" },
];

function Details(): JSX.Element {
  const fluidbox: FluidboxApi<Photo> = useFluidbox<Photo>();
  const credit: string | undefined = fluidbox.item?.credit;
  const fullscreen: boolean = fluidbox.fullscreen;
  const index: Accessor<number | null> = useFluidbox((state) => state.index);
  const sheet: FluidboxSheetApi = useFluidboxSheet();
  const snap: Accessor<number> = sheet.snap;
  void fluidbox.open("one");
  void fluidbox.open(1);
  void fluidbox.open(items[1]!);
  void fluidbox.setFullscreen();
  void fluidbox.download();
  void fluidbox.share();
  const release: () => void = fluidbox.preload(items[0]!);
  release();
  void fluidbox.setItems(items);
  sheet.setSnap(1, { animate: false });
  return (
    <p>
      {credit} {index()} {snap()} {String(fullscreen)}
    </p>
  );
}

function Price(): JSX.Element {
  const slide: FluidboxSlideApi<Photo> = useFluidboxSlide<Photo>();
  slide.waitUntil(Promise.resolve());
  const stop: () => void = slide.onActiveChange((active: boolean) => void active);
  stop();
  slide.onZoom((pose) => void pose.scale);
  const from: number | undefined = slide.origin?.video?.currentTime;
  const unregister: () => void = slide.returnPlayback(() =>
    from ? null : { currentTime: 1, paused: true },
  );
  unregister();
  if (slide.opening && !slide.active) slide.fail(new Error("no price"));
  return <p>{`${slide.item.credit} ${slide.index}`}</p>;
}

function ContractExample(): JSX.Element {
  return (
    <Fluidbox.Root
      items={items}
      defaultValue="one"
      labels={{ close: "Sulje" }}
      zoom={{ step: 3, max: 6, click: "double", tap: false }}
      loop
      preload="press"
      dismiss={{ drag: false }}
      wheel="navigate"
      href={(value) => (value ? `/photos/${value}` : "/photos")}
      shareUrl={(item) => `https://example.com/${item.id}`}
      onMediaError={(event: FluidboxMediaErrorEvent<Photo>) => void event.item.credit}
      onValueChange={(value: string | null, details: FluidboxValueChangeDetails<Photo>) => {
        if (value === null && details.reason === "keyboard") details.cancel();
        void details.item?.credit;
      }}
      onValueChangeComplete={(value, details) => void [value?.length, details.action]}
      onZoomChange={(event) => void event.scale}
    >
      <Fluidbox.Trigger value="one" as="a" href="/photos/one">
        <img src="/thumb.jpg" alt="One" />
        <Fluidbox.Overlay>One</Fluidbox.Overlay>
      </Fluidbox.Trigger>
      <Fluidbox.Trigger value={1}>
        <img src="/thumb-two.jpg" alt="Two" />
      </Fluidbox.Trigger>
      <Fluidbox.Slides<Photo>
        image={({ item }) => (
          <>
            <Fluidbox.Media zoom class="photo" style={{ "border-radius": "4px" }}>
              <Fluidbox.Image item={item} />
            </Fluidbox.Media>
            <Price />
            <Fluidbox.Caption<Photo>>{({ item }) => item.credit}</Fluidbox.Caption>
            <Fluidbox.Error<Photo>>
              {({ item, error }) => `${item.credit} ${String(error)}`}
            </Fluidbox.Error>
          </>
        )}
        default={() => <Fluidbox.Media render={({ media }) => void media.append("…")} />}
      />
      <Fluidbox.Thumbnails<Photo>>
        {(thumbnail) => (
          <img
            src={thumbnail.item.src}
            alt={`${thumbnail.item.credit} ${thumbnail.index}`}
            data-active={thumbnail.active || undefined}
          />
        )}
      </Fluidbox.Thumbnails>
      <Fluidbox.Sheet<Photo>
        snapPoints={["40%", "content"]}
        dismissMotion="scroll"
        class="details"
        onSnapChange={(event: FluidboxSheetEvent) => void event.snap}
      >
        {({ item, index }) => (
          <>
            <p>{`${item.credit} ${index}`}</p>
            <Details />
          </>
        )}
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        <Fluidbox.Toolbar class="bar">
          <Fluidbox.Counter>{({ index, count }) => `${index + 1}/${count}`}</Fluidbox.Counter>
          <Fluidbox.Share />
          <Fluidbox.Download label="Save" />
          <Fluidbox.Fullscreen>
            <svg />
          </Fluidbox.Fullscreen>
          <Fluidbox.Close label={false}>Done</Fluidbox.Close>
        </Fluidbox.Toolbar>
        <Fluidbox.ZoomControls />
        <Fluidbox.SheetSnap to={1}>Details</Fluidbox.SheetSnap>
        <Fluidbox.Previous aria-label="Previous photo">‹</Fluidbox.Previous>
        <Fluidbox.Next>Next</Fluidbox.Next>
        <Fluidbox.Caption />
        <Fluidbox.Loading>Loading…</Fluidbox.Loading>
        <Fluidbox.Error>
          <Fluidbox.Retry />
        </Fluidbox.Error>
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
void ContractExample;

function GroupedTrigger(): JSX.Element {
  return (
    <Fluidbox.Root items={items} value={null} onValueChange={() => {}}>
      <Fluidbox.Trigger value={items}>
        {(preview: Accessor<FluidboxTriggerPreview<Photo>>) => (
          <>
            <img
              src={preview().item?.src}
              alt={preview().item?.credit}
              data-status={preview().status}
            />
            <Fluidbox.Overlay flight="frame" class="scrim" />
            <Fluidbox.Overlay flight="live">+1</Fluidbox.Overlay>
          </>
        )}
      </Fluidbox.Trigger>
      <Fluidbox.Slides
        embed={() => <Embed label={(item) => `Toista ${item.title}`} play={<svg />} />}
        spin={() => <Spin keep={24} turns={2} />}
        model={() => <Model load={() => Promise.resolve()} />}
        video={() => (
          <Fluidbox.Video attach={(video, item, signal) => void [video, item, signal]} />
        )}
        iframe={() => <Fluidbox.Iframe />}
      />
    </Fluidbox.Root>
  );
}
void GroupedTrigger;

const missingValue = (
  // @ts-expect-error a trigger needs its value
  <Fluidbox.Trigger>Open</Fluidbox.Trigger>
);
void missingValue;

// @ts-expect-error the Root takes value, not open and index
const openProp = <Fluidbox.Root items={items} open index={0} />;
void openProp;

// @ts-expect-error slides are a part
const renderersProp = <Fluidbox.Root items={items} renderers={{}} />;
void renderersProp;

// @ts-expect-error Controls is gone; a Toolbar holds the controls
const controls = <Fluidbox.Controls />;
void controls;

// @ts-expect-error ThumbnailOverlay is now Overlay
const thumbnailOverlay = <Fluidbox.ThumbnailOverlay />;
void thumbnailOverlay;

// @ts-expect-error FrameLayer is now Overlay flight="frame"
const frameLayer = <Fluidbox.FrameLayer />;
void frameLayer;

// @ts-expect-error the sheet's snap moved to useFluidboxSheet().snap
const stopField = useFluidboxSheet().stop;
void stopField;

// @ts-expect-error the thumbnails is a part, not a Root prop
const thumbnailsProp = <Fluidbox.Root items={items} thumbnails />;
void thumbnailsProp;

// @ts-expect-error a sheet snap needs its snap
const missingSnap = <Fluidbox.SheetSnap />;
void missingSnap;

// @ts-expect-error SheetStop is now SheetSnap
const sheetStop = <Fluidbox.SheetStop stop={1} />;
void sheetStop;

// @ts-expect-error an Image draws image items
const wrongImage = <Fluidbox.Image item={{ type: "video", src: "/a.mp4", width: 1, height: 1 }} />;
void wrongImage;

// @ts-expect-error the box takes no event handlers, in either spelling
const mediaHandler = <Fluidbox.Media onclick={() => {}} />;
void mediaHandler;
