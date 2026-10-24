import type { ReactElement } from "react";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import {
  Fluidbox,
  useFluidbox,
  useFluidboxSheet,
  type FluidboxApi,
  type FluidboxSheetApi,
  type FluidboxSheetEvent,
  type FluidboxValueChangeDetails,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/react";

interface Photo extends FluidboxImageItem {
  readonly credit: string;
}

const items: readonly Photo[] = [
  { type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800, credit: "A" },
  { type: "image", src: "/two.jpg", alt: "Two", width: 1200, height: 800, credit: "B" },
];

function Caption(): ReactElement {
  const fluidbox: FluidboxApi<Photo> = useFluidbox<Photo>();
  const credit: string | undefined = fluidbox.item?.credit;
  const index = useFluidbox((state) => state.index);
  const sheet: FluidboxSheetApi = useFluidboxSheet();
  const stop: number = sheet.stop;
  void fluidbox.open("/one.jpg");
  void fluidbox.open(1);
  void fluidbox.open(items[1]!);
  const release: () => void = fluidbox.preload(items[0]!);
  release();
  void fluidbox.setItems(items);
  sheet.set(1, { animate: false });
  return (
    <p>
      {credit} {index} {stop}
    </p>
  );
}

function ContractExample(): ReactElement {
  return (
    <Fluidbox.Root
      items={items}
      labels={{ close: "Sulje" }}
      zoom={{ step: 3, max: 6 }}
      renderers={{
        note: ({ item, index }) => <p>{`${item.credit} ${index}`}</p>,
      }}
      onValueChange={(value: string | null, details: FluidboxValueChangeDetails<Photo>) => {
        if (value === null && details.reason === "keyboard") details.cancel();
        void details.item?.credit;
      }}
      onValueChangeComplete={(value, details) => void [value?.length, details.action]}
      onSheetChange={(event: FluidboxSheetEvent) => void event.stop}
    >
      <Fluidbox.Trigger item={items[0]!} asChild>
        <button type="button">
          <img src="/thumb.jpg" alt="One" />
          <Fluidbox.ThumbnailOverlay>One</Fluidbox.ThumbnailOverlay>
        </button>
      </Fluidbox.Trigger>
      <Fluidbox.Trigger item={1}>
        <img src="/thumb-two.jpg" alt="Two" />
      </Fluidbox.Trigger>
      <Fluidbox.Filmstrip<Photo>>
        {({ item, index }) => <img src={item.src} alt={`${item.credit} ${index}`} />}
      </Fluidbox.Filmstrip>
      <Fluidbox.Sheet<Photo> snapPoints={["40%", "content"]} dismiss="scroll" className="details">
        {({ item, index }) => (
          <>
            <p>{`${item.credit} ${index}`}</p>
            <Caption />
          </>
        )}
      </Fluidbox.Sheet>
      <Fluidbox.Viewer>
        <Fluidbox.Controls />
        <Fluidbox.SheetStop stop={1}>Details</Fluidbox.SheetStop>
        <Fluidbox.Previous>Previous</Fluidbox.Previous>
        <Fluidbox.Next>Next</Fluidbox.Next>
        <Fluidbox.Close>Close</Fluidbox.Close>
      </Fluidbox.Viewer>
    </Fluidbox.Root>
  );
}
void ContractExample;

function GroupedTrigger(): ReactElement {
  return (
    <Fluidbox.Root items={items}>
      <Fluidbox.Trigger item={items[0]!} returns={items}>
        {({ item, status }: FluidboxTriggerPreview<Photo>) => (
          <>
            <img src={item?.src} alt={item?.credit} data-status={status} />
            <Fluidbox.ThumbnailOverlay travel>
              <Fluidbox.FrameLayer className="scrim" />
              +1
            </Fluidbox.ThumbnailOverlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
void GroupedTrigger;

const missingItem = (
  // @ts-expect-error a trigger needs its item
  <Fluidbox.Trigger>Open</Fluidbox.Trigger>
);
void missingItem;

// @ts-expect-error the Item part is gone; a Trigger takes its item
const itemPart = <Fluidbox.Item item={0} />;
void itemPart;

const staticSheet = (
  <Fluidbox.Sheet>
    {/* @ts-expect-error the sheet's content is a render function of the item */}
    <p>Details</p>
  </Fluidbox.Sheet>
);
void staticSheet;

// @ts-expect-error the filmstrip is a part, not a Root prop
const filmstripProp = <Fluidbox.Root items={items} filmstrip />;
void filmstripProp;

// @ts-expect-error the sheet is a part, not a Root prop
const sheetProp = <Fluidbox.Root items={items} sheet />;
void sheetProp;

// @ts-expect-error a sheet stop needs its stop
const missingStop = <Fluidbox.SheetStop />;
void missingStop;
