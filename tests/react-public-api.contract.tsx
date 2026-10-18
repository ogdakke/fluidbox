import type { ReactElement } from "react";
import { arraySource } from "../packages/fluidbox/src/index";
import type { FluidboxItem } from "../packages/fluidbox/src/index";
import { Fluidbox, useFluidbox, useFluidboxState } from "../packages/fluidbox/src/react";

const items = [
  {
    id: "one",
    media: { type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
  },
] as const satisfies readonly FluidboxItem[];
const source = arraySource(items);

function ContractExample(): ReactElement {
  const controller = useFluidbox<(typeof items)[number]>();
  const activeId = useFluidboxState((state) => state.activeId);
  void controller;
  return (
    <Fluidbox.Root source={source} onEvent={(event) => void event.type}>
      <Fluidbox.Item id="one">
        <Fluidbox.Trigger asChild>
          <button type="button">
            <img src="/thumb.jpg" alt="One" />
            <Fluidbox.ThumbnailOverlay behavior="host" data-active={activeId === "one"}>
              One
            </Fluidbox.ThumbnailOverlay>
          </button>
        </Fluidbox.Trigger>
      </Fluidbox.Item>
      <Fluidbox.Portal>
        <Fluidbox.Content />
        <Fluidbox.Filmstrip
          renderItem={({ item, selected }) => (
            <img src={item.thumbnail?.src} alt="" data-selected={selected} />
          )}
        />
        <Fluidbox.Previous>Previous</Fluidbox.Previous>
        <Fluidbox.Next>Next</Fluidbox.Next>
        <Fluidbox.Close>Close</Fluidbox.Close>
      </Fluidbox.Portal>
    </Fluidbox.Root>
  );
}
void ContractExample;

function GroupedTrigger(): ReactElement {
  return (
    <Fluidbox.Root items={items}>
      <Fluidbox.Trigger items={items} item={items[0]} asChild>
        {({ item, status }) => (
          <button type="button" data-status={status}>
            {item?.id}
          </button>
        )}
      </Fluidbox.Trigger>
    </Fluidbox.Root>
  );
}
void GroupedTrigger;

// @ts-expect-error item identity is required
const missingId = <Fluidbox.Item />;
void missingId;

// @ts-expect-error controlled state is not in the first locked Root contract
const prematureControlledState = <Fluidbox.Root source={source} open />;
void prematureControlledState;
