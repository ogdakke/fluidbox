import type { ReactElement } from "react";
import { arraySource } from "../packages/lightbox/src/index";
import type { LightboxItem } from "../packages/lightbox/src/index";
import type {
  LightboxReactParts,
  UseLightbox,
  UseLightboxState,
} from "../packages/lightbox/src/react";

const items = [
  {
    id: "one",
    media: { type: "image", src: "/one.jpg", alt: "One", width: 1200, height: 800 },
  },
] as const satisfies readonly LightboxItem[];
const source = arraySource(items);

declare const Lightbox: LightboxReactParts;
declare const useLightbox: UseLightbox;
declare const useLightboxState: UseLightboxState;

function ContractExample(): ReactElement {
  const controller = useLightbox<(typeof items)[number]>();
  const activeId = useLightboxState((state) => state.activeId);
  void controller;
  return (
    <Lightbox.Root source={source} onEvent={(event) => void event.type}>
      <Lightbox.Item id="one">
        <Lightbox.Trigger asChild>
          <button type="button">
            <img src="/thumb.jpg" alt="One" />
            <Lightbox.ThumbnailOverlay behavior="host" data-active={activeId === "one"}>
              One
            </Lightbox.ThumbnailOverlay>
          </button>
        </Lightbox.Trigger>
      </Lightbox.Item>
      <Lightbox.Portal>
        <Lightbox.Content />
        <Lightbox.Previous>Previous</Lightbox.Previous>
        <Lightbox.Next>Next</Lightbox.Next>
        <Lightbox.Close>Close</Lightbox.Close>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
void ContractExample;

// @ts-expect-error item identity is required
const missingId = <Lightbox.Item />;
void missingId;

// @ts-expect-error controlled state is not in the first locked Root contract
const prematureControlledState = <Lightbox.Root source={source} open />;
void prematureControlledState;
