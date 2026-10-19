import type { ReactElement } from "react";
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import {
  Fluidbox,
  useFluidbox,
  useFluidboxSheet,
  type FluidboxChangeEvent,
  type FluidboxToggleEvent,
} from "@ogdakke/fluidbox/react";

interface Photo extends FluidboxImageItem {
  readonly credit: string;
}

const items: readonly Photo[] = [
  { type: "img", src: "/one.jpg", alt: "One", width: 1200, height: 800, credit: "A" },
  { type: "img", src: "/two.jpg", alt: "Two", width: 1200, height: 800, credit: "B" },
];

function Caption(): ReactElement {
  const fluidbox = useFluidbox<Photo>();
  const credit: string | undefined = fluidbox.item?.credit;
  const index = useFluidbox((state) => state.index);
  const sheet = useFluidboxSheet();
  const stop: number = sheet.stop;
  void fluidbox.open("/one.jpg");
  void fluidbox.open(1);
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
      renderers={{ note: ({ item, index }) => <p>{`${item.credit} ${index}`}</p> }}
      onBeforeToggle={(event: FluidboxToggleEvent) => event.preventDefault()}
      onToggle={(event) => void event.newState}
      onBeforeItemChange={(event: FluidboxChangeEvent<Photo>) => void event.item.credit}
      onItemChange={(event) => void event.item.credit}
      onSettle={(event) => void event.index}
    >
      <Fluidbox.Item item={items[0]!}>
        <Fluidbox.Trigger asChild>
          <button type="button">
            <img src="/thumb.jpg" alt="One" />
            <Fluidbox.ThumbnailOverlay>One</Fluidbox.ThumbnailOverlay>
          </button>
        </Fluidbox.Trigger>
      </Fluidbox.Item>
      <Fluidbox.Trigger item={1}>
        <img src="/thumb-two.jpg" alt="Two" />
      </Fluidbox.Trigger>
      <Fluidbox.Filmstrip<Photo>>
        {({ item, index }) => <img src={item.src} alt={`${item.credit} ${index}`} />}
      </Fluidbox.Filmstrip>
      <Fluidbox.Sheet snapPoints={["40%", "content"]} dismiss="scroll" className="details">
        <Caption />
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
      <Fluidbox.Trigger items={items}>
        {({ item, status }) => (
          <>
            <img src={item?.src} alt={item?.credit} data-status={status} />
            <Fluidbox.ThumbnailOverlay travel>+1</Fluidbox.ThumbnailOverlay>
          </>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
void GroupedTrigger;

// @ts-expect-error item identity is required
const missingItem = <Fluidbox.Item />;
void missingItem;

// @ts-expect-error the filmstrip is a part, not a Root prop
const filmstripProp = <Fluidbox.Root items={items} filmstrip />;
void filmstripProp;

// @ts-expect-error the sheet is a part, not a Root prop
const sheetProp = <Fluidbox.Root items={items} sheet />;
void sheetProp;

// @ts-expect-error a sheet stop needs its stop
const missingStop = <Fluidbox.SheetStop />;
void missingStop;
