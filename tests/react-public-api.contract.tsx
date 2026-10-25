import type { ReactElement } from "react";
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
} from "@ogdakke/fluidbox/react";
import { Embed } from "@ogdakke/fluidbox/react/embed";
import { Model } from "@ogdakke/fluidbox/react/model";
import { Spin } from "@ogdakke/fluidbox/react/spin";

interface Photo extends FluidboxImageItem {
  readonly id: string;
  readonly credit: string;
}

const items: readonly Photo[] = [
  { id: "one", type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800, credit: "A" },
  { id: "two", type: "image", src: "/two.jpg", alt: "Two", width: 1200, height: 800, credit: "B" },
];

function Details(): ReactElement {
  const fluidbox: FluidboxApi<Photo> = useFluidbox<Photo>();
  const credit: string | undefined = fluidbox.item?.credit;
  const fullscreen: boolean = fluidbox.fullscreen;
  const playing: boolean = fluidbox.playing;
  fluidbox.play();
  fluidbox.pause();
  const index = useFluidbox((state) => state.index);
  const sheet: FluidboxSheetApi = useFluidboxSheet();
  const snap: number = sheet.snap;
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
      {credit} {index} {snap} {String(fullscreen)} {String(playing)}
    </p>
  );
}

function Price(): ReactElement {
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
  const model: HTMLElement | undefined = slide.origin?.model;
  const stopClose: () => void = slide.onClose((landing) => void landing?.model?.isConnected);
  stopClose();
  if (!model && slide.opening && !slide.active) slide.fail(new Error("no price"));
  return <p>{`${slide.item.credit} ${slide.index}`}</p>;
}

function ContractExample(): ReactElement {
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
      slideshow={{ interval: 4000, loop: true, autoplay: false }}
      onMediaError={(event: FluidboxMediaErrorEvent<Photo>) => void event.item.credit}
      onValueChange={(value: string | null, details: FluidboxValueChangeDetails<Photo>) => {
        if (value === null && details.reason === "keyboard") details.cancel();
        void details.item?.credit;
      }}
      onValueChangeComplete={(value, details) => void [value?.length, details.action]}
      onZoomChange={(event) => void event.scale}
    >
      <Fluidbox.Trigger value="one" asChild>
        <button type="button">
          <img src="/thumb.jpg" alt="One" />
          <Fluidbox.Overlay>One</Fluidbox.Overlay>
        </button>
      </Fluidbox.Trigger>
      <Fluidbox.Trigger value={1}>
        <img src="/thumb-two.jpg" alt="Two" />
      </Fluidbox.Trigger>
      <Fluidbox.Slides<Photo>
        image={({ item }) => (
          <>
            <Fluidbox.Media zoom className="photo" style={{ borderRadius: 4 }}>
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
        {({ item, index, active }) => (
          <img src={item.src} alt={`${item.credit} ${index}`} data-active={active || undefined} />
        )}
      </Fluidbox.Thumbnails>
      <Fluidbox.Sheet<Photo>
        snapPoints={["40%", "content"]}
        dismissMotion="scroll"
        className="details"
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
        <Fluidbox.Toolbar className="bar">
          <Fluidbox.Counter>{({ index, count }) => `${index + 1}/${count}`}</Fluidbox.Counter>
          <Fluidbox.Share />
          <Fluidbox.Download label="Save" />
          <Fluidbox.Fullscreen>
            <svg />
          </Fluidbox.Fullscreen>
          <Fluidbox.Slideshow />
          <Fluidbox.Slideshow label={false}>Play</Fluidbox.Slideshow>
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

function GroupedTrigger(): ReactElement {
  return (
    <Fluidbox.Root items={items} value={null} onValueChange={() => {}}>
      <Fluidbox.Trigger value={items}>
        {({ item, status }: FluidboxTriggerPreview<Photo>) => (
          <>
            <img src={item?.src} alt={item?.credit} data-status={status} />
            <Fluidbox.Overlay flight="frame" className="scrim" />
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

// @ts-expect-error a trigger names its items in value
const itemProp = <Fluidbox.Trigger item={0}>Open</Fluidbox.Trigger>;
void itemProp;

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

const staticSheet = (
  <Fluidbox.Sheet>
    {/* @ts-expect-error the sheet's content is a render function of the item */}
    <p>Details</p>
  </Fluidbox.Sheet>
);
void staticSheet;

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
