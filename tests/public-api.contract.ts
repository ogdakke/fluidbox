// A type-level contract of the public API: what each entry point exports, and
// the shapes a consumer writes. `tsc --noEmit` checks it; nothing runs it.
import {
  createFluidbox,
  createItemList,
  FluidboxSheetEvent,
  FluidboxValueChangeEvent,
  FluidboxZoomEvent,
  idOf,
  itemLabel as rootItemLabel,
  videoSlide,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxItemTypes,
  type FluidboxIframeItem,
  type FluidboxImageItem,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxLabels,
  type FluidboxOptions,
  type FluidboxRevealContext,
  type FluidboxTriggerValue,
  type FluidboxReason,
  type FluidboxRenderer,
  type FluidboxSheet,
  type FluidboxSlideRenderer,
  type FluidboxState,
  type FluidboxStatus,
  type FluidboxTarget,
  type FluidboxUpdateOptions,
  type FluidboxVideoItem,
  type FluidboxViewerRenderer,
  type FluidboxZoomState,
} from "@ogdakke/fluidbox";
import type * as Root from "@ogdakke/fluidbox";
import type * as SheetEntry from "@ogdakke/fluidbox/sheet";
import type * as ThumbnailsEntry from "@ogdakke/fluidbox/thumbnails";
import type { FluidboxThumbnailsOptions } from "@ogdakke/fluidbox/thumbnails";
import type { FluidboxSheetOptions, FluidboxSheetSnapPoint } from "@ogdakke/fluidbox/sheet";
import {
  createEmbedProvider,
  createEmbedSlide,
  embedItem,
  embedSlide,
  vimeo,
  vimeoItem,
  youtube,
  youtubeItem,
  type FluidboxEmbedItem,
  type FluidboxEmbedProvider,
} from "@ogdakke/fluidbox/embed";
import { createModelSlide, modelItem, type FluidboxModelItem } from "@ogdakke/fluidbox/model";
import { createSpinSlide, spinItem, type FluidboxSpinItem } from "@ogdakke/fluidbox/spin";
import {
  createTrigger,
  bindTrigger,
  defaultLabels,
  fluidboxControls,
  createSlots,
  fluidboxEventTypes,
  latestFindTrigger,
  itemLabel,
  resolveOrigin,
  unloadFluidbox,
  type FluidboxSlot,
  type FluidboxSlots,
  type FluidboxTrigger,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxThumbnailsElement,
  FluidboxGalleryElement,
  FluidboxItemElement,
  FluidboxPreviewChangeEvent,
  FluidboxSheetElement,
} from "@ogdakke/fluidbox/elements";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <T extends true>(): T => true as T;

// Items: flat, with the HTML attribute names of the element the viewer draws.

const photo = {
  type: "image",
  src: "/full.jpg",
  srcset: "/full-1200.jpg 1200w, /full.jpg 2400w",
  sizes: "100vw",
  alt: "Description",
  width: 2400,
  height: 1600,
  sources: [{ srcset: "/full.avif", type: "image/avif" }],
  thumbnail: { src: "/thumb.jpg", srcset: "/thumb.jpg 1x, /thumb@2x.jpg 2x", width: 480 },
  placeholder: "data:image/png;base64,",
} satisfies FluidboxImageItem;
const video = {
  type: "video",
  src: "/clip.mp4",
  title: "Clip",
  width: 1920,
  height: 1080,
  poster: "/poster.jpg",
  autoplay: true,
  loop: true,
  muted: true,
  playsInline: true,
  controls: false,
  preload: "auto",
} satisfies FluidboxVideoItem;
const embed = {
  type: "iframe",
  src: "https://example.com/embed",
  title: "Embed",
  width: 800,
  height: 600,
  allow: "fullscreen",
  referrerPolicy: "no-referrer",
  sandbox: "allow-scripts",
} satisfies FluidboxIframeItem;
// Types of your own join the union by declaration merging, keyed by their `type`.
interface ContractNoteItem extends FluidboxCustomItemBase<"contract-note"> {
  readonly id: string;
}
declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    "contract-note": ContractNoteItem;
  }
}
const note = {
  type: "contract-note",
  id: "note",
  title: "Note",
  width: 400,
  height: 300,
} satisfies FluidboxItem;
assert<Equal<FluidboxItemTypes["contract-note"], ContractNoteItem>>();
assert<Equal<Extract<FluidboxItem, { type: "contract-note" }>, ContractNoteItem>>();
assert<Equal<Extract<FluidboxItem, { type: "image" }>, FluidboxImageItem>>();

// @ts-expect-error images need intrinsic dimensions
const missingDimensions: FluidboxImageItem = { type: "image", src: "/bad.jpg", alt: "Bad" };
// @ts-expect-error a type of your own needs its title and size
const anonymousCustom: FluidboxItem = { type: "contract-note", id: "n" };
// @ts-expect-error a type nobody declared is not an item
const undeclared: FluidboxItem = { type: "undeclared", id: "x", title: "", width: 1, height: 1 };
// @ts-expect-error "custom" items are gone: the type names the slide
const customType: FluidboxItem = { type: "custom", id: "x", title: "", width: 1, height: 1 };
// @ts-expect-error a video poster is a URL, not an image object
const posterObject: FluidboxVideoItem = { ...video, poster: { src: "/poster.jpg" } };
// @ts-expect-error there is no media wrapper
const nested: FluidboxItem = { id: "nested", media: photo };
// @ts-expect-error srcset strings replace candidate lists
const candidates: FluidboxImageItem = { ...photo, candidates: [{ src: "/a.jpg", width: 1 }] };
// @ts-expect-error the old "img" type name is gone
const oldType: FluidboxItem = { ...photo, type: "img" };
void [missingDimensions, anonymousCustom, undeclared, customType, posterObject, nested];
void [candidates, oldType];

// Your own fields flow through every callback and the state.
type Photo = FluidboxImageItem & { readonly credit: string };
const photos: readonly Photo[] = [{ ...photo, id: "one", credit: "A. Person" }];
const lazy: FluidboxItemList<Photo> = {
  count: 1_000,
  get: (index) => ({ ...photo, id: String(index), credit: "Generated" }),
  indexOf: (id) => Number(id),
};
const unindexed: FluidboxItemList = { count: 1, get: () => photo };
// The factory keeps the item type, and its list is a plain FluidboxItemList.
const made: FluidboxItemList<Photo> = createItemList({
  count: 1_000,
  item: (index) => ({ ...photo, id: String(index), credit: "Generated" }),
  index: Number,
});
const madeCredit: string = made.get(0).credit;
void [unindexed, madeCredit];

const note2: FluidboxSlideRenderer = ({ item, index, media, signal }) => {
  media.textContent = `${item.type} ${index}`;
  signal.addEventListener("abort", () => media.replaceChildren());
  return () => media.replaceChildren();
};
const viewer: FluidboxViewerRenderer<Photo> = ({ target, fluidbox, signal }) => {
  const caption = document.createElement("p");
  target.append(caption);
  const stop = fluidbox.subscribe((state) => (caption.textContent = state.item?.credit ?? ""));
  signal.addEventListener("abort", stop);
};
const findTrigger = (item: Photo, index: number): HTMLElement | null => {
  void [item.credit, index];
  return document.createElement("button");
};
const revealTrigger = (
  item: Photo,
  _index: number,
  { signal, phase }: FluidboxRevealContext,
): Promise<void> | undefined => {
  void item.credit;
  if (!signal.aborted && phase === "selection") return Promise.resolve();
};
const labels: Partial<FluidboxLabels> = {
  close: "Sulje",
  position: (index, count) => `${index + 1} / ${count}`,
};

// The plain JavaScript API.

const fluidbox = createFluidbox({
  items: photos,
  labels,
  zoom: { step: 2, max: 6 },
  slides: { default: note2 },
  viewer,
  controls: ["close"],
  thumbnails: { render: ({ item, target }) => void (target.title = item.credit) },
  sheet: { snapPoints: ["40%", 600, "content"], dismissMotion: "scroll", render: () => {} },
  findTrigger,
  revealTrigger,
});
assert<Equal<typeof fluidbox, Fluidbox<Photo>>>();
assert<Equal<typeof fluidbox.state, FluidboxState<Photo>>>();
assert<Equal<typeof fluidbox.state.item, Photo | null>>();
assert<Equal<typeof fluidbox.state.status, FluidboxStatus>>();
assert<Equal<FluidboxStatus, "closed" | "opening" | "open" | "closing">>();
assert<Equal<FluidboxTarget<Photo>, number | string | Photo>>();
assert<Equal<typeof fluidbox.sheet, FluidboxSheet | null>>();
// @ts-expect-error the thumbnails has no handle
void fluidbox.thumbnails;
assert<Equal<ReturnType<typeof fluidbox.open>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.close>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.setItems>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.load>, Promise<boolean>>>();
assert<Equal<Root.FluidboxPreload, "intent" | "press" | "eager">>();
assert<
  Equal<
    FluidboxReason,
    "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "items" | "slideshow"
  >
>();
// The slideshow: commands, state, options and its control.
assert<Equal<ReturnType<typeof fluidbox.play>, void>>();
assert<Equal<ReturnType<typeof fluidbox.pause>, void>>();
assert<Equal<typeof fluidbox.state.playing, boolean>>();
createFluidbox({ items: photos, slideshow: { interval: 3000, loop: true, autoplay: true } });
fluidbox.update({ slideshow: { interval: 4000 } });
fluidbox.bindControl(document.createElement("button"), "slideshow");
// @ts-expect-error the interval is a number of ms
createFluidbox({ items: photos, slideshow: { interval: "5s" } });
// A scrub is a kind of move, not a source of one.
void fluidbox.open(1, { scrub: true });

createFluidbox({ items: lazy, controls: true, thumbnails: true, sheet: true, zoom: false });
createFluidbox({ items: photos, preload: "eager" });
fluidbox.update({ preload: "press" });
// @ts-expect-error hover, press or eager
createFluidbox({ items: photos, loading: "lazy" });
// @ts-expect-error items, not a source
createFluidbox({ source: photos });
// @ts-expect-error the viewer, not a portal
createFluidbox({ items: photos, portal: viewer });
// @ts-expect-error events replace callbacks
createFluidbox({ items: photos, onEvent() {} });
// A custom slide's renderer follows whether its slide is on show.
const clip: FluidboxSlideRenderer<Photo | ContractNoteItem> = ({
  active,
  onActiveChange,
  signal,
}) => {
  const playing: boolean = active;
  const stop: () => void = onActiveChange((now: boolean) => void [playing, now]);
  signal.addEventListener("abort", stop);
};
createFluidbox<Photo | ContractNoteItem>({ items: photos, slides: { "contract-note": clip } });
// Each type's slide gets its own items, and can draw the built-in media.
createFluidbox<Photo | ContractNoteItem>({
  items: photos,
  slides: {
    "contract-note": (slide) => {
      assert<Equal<typeof slide.item, ContractNoteItem>>();
      const media: HTMLElement = slide.media;
      void media;
      const undraw: () => void = slide.drawImage(photo);
      return undraw;
    },
    // Listing a built-in type replaces its slide; it can still draw the built-in image.
    image: (slide) => {
      assert<Equal<typeof slide.item, Photo>>();
      slide.drawImage();
    },
    default: (slide) => void slide.item.type,
  },
});
// @ts-expect-error a slide for a type the items don't have
createFluidbox<Photo>({ items: photos, slides: { video: note2 } });
// @ts-expect-error drawImage draws image items
createFluidbox({ items: photos, slides: { note: (slide) => void slide.drawImage(video) } });
// Other renderers don't get it.
// @ts-expect-error a thumbnail is never on show as a slide
const thumbnailActive: FluidboxRenderer = ({ active }) => void active;
void thumbnailActive;
// The media add-ons' items and renderers go into any gallery.
type Shop = Photo | FluidboxEmbedItem | FluidboxModelItem | FluidboxSpinItem;
createFluidbox<Shop>({
  items: [
    youtubeItem("https://youtu.be/M7lc1UVf-VE", { title: "Video" }),
    vimeoItem("76979871", { title: "Video", poster: "/still.jpg" }),
    modelItem({ src: "/chair.glb", title: "Chair", width: 1, height: 1, ar: true }),
    spinItem({
      frames: { src: "/mug/{index}.webp", count: 36 },
      title: "Mug",
      width: 1,
      height: 1,
    }),
  ],
  slides: {
    embed: embedSlide,
    spin: createSpinSlide({ label: (frame, count) => `${frame}/${count}` }),
    model: createModelSlide({ load: () => Promise.resolve() }),
  },
});

// An app's own provider, beside the built-in two.
const wistia: FluidboxEmbedProvider = createEmbedProvider({
  name: "wistia",
  origin: "https://fast.wistia.net",
  parse: (source) => (/^\w{10}$/.test(source) ? { video: source } : null),
  url: (item, { autoplay }) =>
    `https://fast.wistia.net/embed/iframe/${item.video}?autoPlay=${autoplay}`,
});
const wistiaItem: FluidboxEmbedItem = embedItem(wistia, "abc123defg", { title: "Demo" });
createFluidbox({
  items: [wistiaItem],
  slides: {
    embed: createEmbedSlide({
      providers: [youtube, vimeo, wistia],
      label: (item) => `Play ${item.title}`,
      play: () => document.createElement("span"),
    }),
  },
});
// @ts-expect-error a provider's url takes the item
createEmbedProvider({ name: "x", origin: "https://x.example", parse: () => null, url: () => 1 });

// @ts-expect-error slides are functions, not objects with mount
createFluidbox({ items: photos, slides: { note: { mount: note2 } } });
// @ts-expect-error the renderers option is now slides
createFluidbox({ items: photos, renderers: { note: note2 } });
// @ts-expect-error a sheet dismisses by flight or scroll; "none" is the Root's dismiss.drag
createFluidbox({ items: photos, sheet: { dismissMotion: "none" } });

void fluidbox.open();
void fluidbox.open(0);
void fluidbox.open("one", { signal: new AbortController().signal });
void fluidbox.next();
void fluidbox.previous();
void fluidbox.close();
void fluidbox.setItems(lazy);
fluidbox.preload("one")();
void fluidbox.open(photos[0]!);
fluidbox.preload(photos[0]!)();
// @ts-expect-error an object target is a whole item
void fluidbox.open({ id: "one" });
// @ts-expect-error commands take no reason
void fluidbox.open(0, { reason: "trigger" });
void fluidbox.zoomTo(2.5, { origin: { x: 120, y: 80 }, signal: new AbortController().signal });
void fluidbox.zoomIn().then((zoomed: boolean) => zoomed);
void fluidbox.zoomOut({ origin: { x: 0, y: 0 } });
void fluidbox.zoomReset();
// @ts-expect-error the origin is a point, not a keyword
void fluidbox.zoomTo(2, { origin: "center" });
const zoomState: FluidboxZoomState | null = fluidbox.state.zoom;
void zoomState?.scale;
fluidbox.addEventListener("zoomchange", (event) => {
  assert<Equal<typeof event, FluidboxZoomEvent>>();
  const reason: FluidboxReason = event.reason;
  void [event.scale, reason];
});
createFluidbox({ items: photos, controls: ["close", "zoomIn", "zoomOut", "zoomReset"] });
// @ts-expect-error the zoom controls are named in camel case
createFluidbox({ items: photos, controls: ["zoom-in"] });
const masterPhoto: FluidboxImageItem = {
  type: "image",
  src: "/one.jpg",
  alt: "",
  width: 1,
  height: 1,
  zoom: { src: "/one-master.jpg", srcset: "/one-3200.jpg 3200w, /one-6400.jpg 6400w" },
};
// @ts-expect-error the zoom image is `zoom.src`
const flatZoom: FluidboxImageItem = { ...masterPhoto, zoomSrc: "/one-master.jpg" };
void [masterPhoto, flatZoom];

const button = document.createElement("button");
const unbind: () => void = fluidbox.bind(button, [photos[0]!, "one", 1, ...photos], {
  signal: new AbortController().signal,
  onPreviewChange(item, index) {
    assert<Equal<typeof item, Photo>>();
    void index;
  },
});
unbind();
fluidbox.bind(button, "one");
const value: FluidboxTriggerValue<Photo> = ["one", 1];
// @ts-expect-error the list is the value; there are no returns
fluidbox.bind(button, "one", { returns: [1] });
fluidbox.bindOverlay(document.createElement("span"), "one");
fluidbox.bindOverlay(document.createElement("span"), value, { flight: "copy" });
fluidbox.bindOverlay(document.createElement("span"), 0, {
  flight: { live: ({ item, target }) => void (target.textContent = item.credit) },
});
fluidbox.bindOverlay(document.createElement("span"), value, { flight: "frame" });
// @ts-expect-error travel and frameLayer are now flight
fluidbox.bindOverlay(button, 0, { travel: true });
// @ts-expect-error a live flight is an object with its renderer
fluidbox.bindOverlay(button, 0, { flight: "live" });
// @ts-expect-error origins became findTrigger and revealTrigger
createFluidbox({ items: photos, origins: {} });

fluidbox.addEventListener("beforevaluechange", (event) => {
  assert<Equal<typeof event, FluidboxValueChangeEvent<Photo>>>();
  assert<Equal<typeof event.value, string | null>>();
  assert<Equal<typeof event.action, "open" | "move" | "close">>();
  if (event.action === "close" && event.reason === "keyboard") event.preventDefault();
});
fluidbox.addEventListener("valuechange", (event) => {
  assert<Equal<typeof event, FluidboxValueChangeEvent<Photo>>>();
  assert<Equal<typeof event.item, Photo | null>>();
  void [event.value, event.previousValue, event.index];
});
fluidbox.addEventListener("valuechangecomplete", (event) => void event.item?.credit);
// @ts-expect-error toggle events are gone: the value events report opens and closes
fluidbox.addEventListener("toggle", (event: FluidboxValueChangeEvent<Photo>) => void event);
fluidbox.addEventListener("sheetchange", (event) => {
  assert<Equal<typeof event, FluidboxSheetEvent>>();
  void [event.snap, event.reason];
});
const change = new FluidboxValueChangeEvent("valuechange", {
  value: "one",
  previousValue: null,
  index: 0,
  item: photo,
  action: "open",
  reason: "api",
});
const sheetChange = new FluidboxSheetEvent("sheetchange", {
  snap: 1,
  reason: "pointer",
});
const zoomChange = new FluidboxZoomEvent("zoomchange", { scale: 2, reason: "wheel" });
void [change, sheetChange, zoomChange];

const update: FluidboxUpdateOptions<Photo> = { labels: { close: "Sulje" }, zoom: undefined };
fluidbox.update(update);
fluidbox.update({ controls: ["close"], thumbnails: true, sheet: { snapPoints: ["50%"] } });
const id: string = idOf(photo);
const name: string = rootItemLabel(photo);
void [id, name];

const sheet = fluidbox.sheet;
if (sheet) {
  sheet.setSnap(1, { animate: false });
  const snap: number = sheet.snap;
  void snap;
  // @ts-expect-error the sheet's snap changes arrive as sheetchange events
  sheet.subscribe(() => {});
}
fluidbox.destroy();

const options: FluidboxOptions = { items: [photo, video, embed, note] };
void options;

// A video tries its sources in order, then src; attach loads it through an engine.
const encoded: Root.FluidboxVideoItem = {
  type: "video",
  src: "/clip.mp4",
  title: "Clip",
  width: 1920,
  height: 1080,
  sources: [
    { src: "/clip.av1.mp4", type: 'video/mp4; codecs="av01.0.05M.08"' },
    { src: "/clip.webm" },
  ],
};
const streamed: Root.FluidboxSlideRenderer<Root.FluidboxVideoItem> = videoSlide({
  attach(element: HTMLVideoElement, signal: AbortSignal, item: Root.FluidboxVideoItem) {
    element.src = item.src;
    void signal;
  },
});
createFluidbox({ items: [encoded], slides: { video: streamed } });
const productVideo: Root.FluidboxSlideRenderer<Root.FluidboxVideoItem> = (slide) =>
  slide.drawVideo(slide.item, { attach: (element) => void element });
void productVideo;

// The root holds no kit helpers, elements or old names.
type RootValues = keyof typeof Root;
assert<
  Equal<
    RootValues,
    | "createFluidbox"
    | "createItemList"
    | "idOf"
    | "itemLabel"
    | "imageItem"
    | "videoSlide"
    | "FluidboxMediaErrorEvent"
    | "FluidboxSheetEvent"
    | "FluidboxValueChangeEvent"
    | "FluidboxZoomEvent"
  >
>();

// Add-on entries register on import and export types only.
assert<Equal<keyof typeof SheetEntry, never>>();
assert<Equal<keyof typeof ThumbnailsEntry, never>>();
const snap: FluidboxSheetSnapPoint[] = [120, "50%", "content"];
const sheetOptions: FluidboxSheetOptions<Photo> = { snapPoints: snap, dismissMotion: "scroll" };
const thumbnailsOptions: FluidboxThumbnailsOptions<Photo> = {
  render: ({ item, target }) => void (target.title = item.credit),
};
// @ts-expect-error the thumbnails renders; frameworks fill slots through the kit
void ({ slots: true } satisfies FluidboxThumbnailsOptions);
void [sheetOptions, thumbnailsOptions];

// The binding kit.

const stand: Fluidbox<Photo> = createFluidbox<Photo>({ items: photos });
const trigger: FluidboxTrigger<Photo> = createTrigger(stand, {
  value: ["one", ...photos],
  onPreviewChange: (item) => void item.credit,
});
const preview: FluidboxTriggerPreview<Photo> = trigger.preview(stand.state);
void preview.item?.credit;
trigger.setElement(button);
trigger.click({ defaultPrevented: false });
trigger.destroy();
bindTrigger(stand, button, { value: 0 }).destroy();
stand.update({ zoom: false });
const slotRenderer: FluidboxSlots<Photo> = createSlots<Photo>();
const firstSlot: FluidboxSlot<Photo> | undefined = slotRenderer.slots[0];
slotRenderer.subscribe(
  () => void [firstSlot?.item.credit, firstSlot?.target, firstSlot?.container],
)();
unloadFluidbox(stand);
const label: string = itemLabel(note);
const close: Promise<boolean> = fluidboxControls.close.run(stand);
const disabled: boolean = fluidboxControls.next.disabled(stand.state);
void fluidboxControls.zoomIn.run(stand);
void [label, close, disabled, defaultLabels.viewer, fluidboxEventTypes];
const latestOptions: FluidboxOptions<Photo> = latestFindTrigger(
  { items: photos } as FluidboxOptions<Photo>,
  () => ({ findTrigger, revealTrigger }),
);
const resolved: HTMLElement = resolveOrigin(button).visual;
void [latestOptions, resolved];

// The custom elements.

const gallery = document.createElement("fluidbox-gallery");
assert<Equal<typeof gallery, FluidboxGalleryElement>>();
gallery.items = photos;
gallery.slides = { note: note2 };
// @ts-expect-error the renderers property is now slides
gallery.renderers = { note: note2 };
gallery.value = "one";
gallery.value = null;
const galleryValue: string | null = gallery.value;
void galleryValue;
gallery.dismiss = { drag: false, backdrop: false };
gallery.wheel = "navigate";
gallery.shareUrl = (shared) => `/photos/${shared.id}`;
gallery.addEventListener("mediaerror", (event) => void [event.kind, event.cause]);
void gallery.setFullscreen();
void gallery.download();
void gallery.share();
gallery.slideshow = { interval: 4000, autoplay: true };
gallery.play();
gallery.pause();
gallery.viewer = ({ target }) => {
  target.append("Caption");
};
gallery.findTrigger = (found) => (found.id ? button : null);
gallery.revealTrigger = undefined;
gallery.zoom = false;
gallery.labels = labels;
const galleryState: FluidboxState = gallery.state;
const gallerySheet: FluidboxSheet | null = gallery.sheet;
const galleryFluidbox: Fluidbox | null = gallery.fluidbox;
void [galleryState, gallerySheet, galleryFluidbox];
gallery.preload(photo)();
void gallery.load().then((loaded: boolean) => loaded);
// @ts-expect-error preload is the attribute; preload() is the command
gallery.loading = "press";
void gallery.setItems(photos).then((applied: boolean) => applied);
gallery.addEventListener("sheetchange", (event) => void event.snap);
gallery.addEventListener("valuechange", (event) => {
  const reason: FluidboxReason = event.reason;
  void [reason, event.item];
});
gallery.addEventListener("beforevaluechange", (event) => void event.value?.startsWith("o"));
gallery.addEventListener("click", (event) => void event.clientX);
void gallery.open(2);
void gallery.open("one");
void gallery.next();
void gallery.previous();
void gallery.zoomTo(2).then((zoomed: boolean) => zoomed);
void gallery.zoomIn();
void gallery.zoomOut();
void gallery.zoomReset();
gallery.addEventListener("zoomchange", (event) => void event.scale);
void gallery.close();
void gallery.whenReady().then((ready: Fluidbox) => ready.state);
gallery.subscribe((state) => void state.index)();
// @ts-expect-error items, not a source
gallery.source = photos;
// @ts-expect-error the viewer, not a portal
gallery.portal = viewer;

const item: FluidboxItemElement = document.createElement("fluidbox-item");
const itemValue: string = item.value;
void [itemValue, item.trigger];
// @ts-expect-error the id is the value
void item.itemId;
item.addEventListener("fluidbox-preview-change", (event: FluidboxPreviewChangeEvent) => {
  void [event.detail.id, event.detail.item];
});
const strip: FluidboxThumbnailsElement = document.createElement("fluidbox-thumbnails");
strip.render = ({ target, index }) => void (target.textContent = String(index));
const sheetElement: FluidboxSheetElement = document.createElement("fluidbox-sheet");
sheetElement.render = ({ target }) => {
  target.append("Details");
};
