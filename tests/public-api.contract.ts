import { arraySource } from "../packages/lightbox/src/index";
import type {
  CreateLightbox,
  LightboxController,
  LightboxImageMedia,
  LightboxItem,
  LightboxOriginAdapter,
  LightboxSource,
} from "../packages/lightbox/src/index";

const image = {
  type: "image",
  src: "/full.jpg",
  alt: "Description",
  width: 2400,
  height: 1600,
} satisfies LightboxImageMedia;

const items = [
  { id: "one", media: image, thumbnail: { src: "/thumb.jpg", width: 480, height: 320 } },
] as const satisfies readonly LightboxItem[];

const source: LightboxSource<(typeof items)[number]> = arraySource(items);
const origins: LightboxOriginAdapter = {
  getOrigin() {
    const trigger = document.createElement("button");
    const visual = document.createElement("img");
    return { trigger, visual, thumbnail: visual };
  },
  revealOrigin(_id, _index, { signal, reason }) {
    if (!signal.aborted && reason === "selection") return Promise.resolve();
  },
};

declare const createLightbox: CreateLightbox;
const controller: LightboxController<(typeof items)[number]> = createLightbox({ source, origins });
void controller.open({ id: "one" }, { reason: "api" });
void controller.goTo({ index: 0 });
void controller.close();
controller.registerOrigin("one", origins.getOrigin("one")!);
controller.registerThumbnailOverlay("one", {
  element: document.createElement("span"),
  behavior: "travel",
  renderer: {
    mount({ item, target }) {
      target.textContent = item.id;
      return () => target.replaceChildren();
    },
  },
});

// @ts-expect-error image media requires intrinsic dimensions
const missingDimensions: LightboxImageMedia = { type: "image", src: "/bad.jpg", alt: "Bad" };
void missingDimensions;

// @ts-expect-error targets use exactly an id or an index
void controller.open({ slug: "one" });

// @ts-expect-error targets cannot identify two destinations
void controller.open({ id: "one", index: 0 });

// @ts-expect-error traveling overlays require a renderer
controller.registerThumbnailOverlay("one", {
  element: document.createElement("span"),
  behavior: "travel",
});

// @ts-expect-error the source snapshot does not own DOM origins
const invalidSource: LightboxSource = { count: 0, getItem() {}, getIndex() {}, getOrigin() {} };
void invalidSource;
