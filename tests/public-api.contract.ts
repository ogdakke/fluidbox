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
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxItemTypes,
  type FluidboxIframeItem,
  type FluidboxImageItem,
  type FluidboxItem,
  type FluidboxItemList,
  type FluidboxLabels,
  type FluidboxOptions,
  type FluidboxOrigin,
  type FluidboxOriginAdapter,
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
import type * as FilmstripEntry from "@ogdakke/fluidbox/filmstrip";
import type { FluidboxFilmstripOptions } from "@ogdakke/fluidbox/filmstrip";
import type { FluidboxSheetOptions, FluidboxSheetSnapPoint } from "@ogdakke/fluidbox/sheet";
import {
  renderEmbed,
  vimeoItem,
  youtubeItem,
  type FluidboxEmbedItem,
} from "@ogdakke/fluidbox/embeds";
import { createModelRenderer, modelItem, type FluidboxModelItem } from "@ogdakke/fluidbox/model";
import { createSpinRenderer, spinItem, type FluidboxSpinItem } from "@ogdakke/fluidbox/spin";
import {
  createTrigger,
  bindTrigger,
  defaultLabels,
  fluidboxControlIcon,
  fluidboxControls,
  createSlots,
  fluidboxEventTypes,
  frameLayerOf,
  itemLabel,
  latestOrigins,
  resolveOrigin,
  unloadFluidbox,
  type FluidboxSlot,
  type FluidboxSlots,
  type FluidboxTrigger,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import type {
  FluidboxFilmstripElement,
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

const note2: FluidboxRenderer = ({ item, index, target, signal }) => {
  target.textContent = `${item.type} ${index}`;
  signal.addEventListener("abort", () => target.replaceChildren());
  return () => target.replaceChildren();
};
const viewer: FluidboxViewerRenderer<Photo> = ({ target, fluidbox, signal }) => {
  const caption = document.createElement("p");
  target.append(caption);
  const stop = fluidbox.subscribe((state) => (caption.textContent = state.item?.credit ?? ""));
  signal.addEventListener("abort", stop);
};
const origins: FluidboxOriginAdapter<Photo> = {
  getOrigin(): FluidboxOrigin<Photo> | null {
    const trigger = document.createElement("button");
    const visual = document.createElement("img");
    return {
      trigger,
      visual,
      thumbnail: visual,
      onPreviewChange: (item, index) => void [item.credit, index],
    };
  },
  revealOrigin(_id, _index, { signal, phase }) {
    if (!signal.aborted && phase === "selection") return Promise.resolve();
  },
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
  renderers: { note: note2 },
  viewer,
  controls: ["close"],
  filmstrip: { render: ({ item, target }) => void (target.title = item.credit) },
  sheet: { snapPoints: ["40%", 600, "content"], dismiss: "scroll", render: () => {} },
  origins,
});
assert<Equal<typeof fluidbox, Fluidbox<Photo>>>();
assert<Equal<typeof fluidbox.state, FluidboxState<Photo>>>();
assert<Equal<typeof fluidbox.state.item, Photo | null>>();
assert<Equal<typeof fluidbox.state.status, FluidboxStatus>>();
assert<Equal<FluidboxStatus, "closed" | "opening" | "open" | "closing">>();
assert<Equal<FluidboxTarget<Photo>, number | string | Photo>>();
assert<Equal<typeof fluidbox.sheet, FluidboxSheet | null>>();
// @ts-expect-error the filmstrip has no handle
void fluidbox.filmstrip;
assert<Equal<ReturnType<typeof fluidbox.open>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.close>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.setItems>, Promise<boolean>>>();
assert<Equal<ReturnType<typeof fluidbox.load>, Promise<boolean>>>();
assert<Equal<Root.FluidboxLoading, "hover" | "press" | "eager">>();
assert<Equal<FluidboxReason, "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "items">>();
// A scrub is a kind of move, not a source of one.
void fluidbox.open(1, { scrub: true });

createFluidbox({ items: lazy, controls: true, filmstrip: true, sheet: true, zoom: false });
createFluidbox({ items: photos, loading: "eager" });
fluidbox.update({ loading: "press" });
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
createFluidbox<Photo | ContractNoteItem>({ items: photos, renderers: { "contract-note": clip } });
// Other renderers don't get it.
// @ts-expect-error a filmstrip thumbnail is never on show as a slide
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
  renderers: {
    note: note2,
    embed: renderEmbed,
    spin: createSpinRenderer({ label: (frame, count) => `${frame}/${count}` }),
    model: createModelRenderer({ load: () => Promise.resolve() }),
  },
});

// @ts-expect-error renderers are functions, not objects with mount
createFluidbox({ items: photos, renderers: { note: { mount: note2 } } });
// @ts-expect-error a sheet dismissal is one of flight, scroll or none
createFluidbox({ items: photos, sheet: { dismiss: "swipe" } });

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
void fluidbox.resetZoom();
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
const unbind: () => void = fluidbox.bind(button, photos[0]!, {
  returns: ["one", 1, ...photos],
  signal: new AbortController().signal,
  onPreviewChange(item, index) {
    assert<Equal<typeof item, Photo>>();
    void index;
  },
});
unbind();
// @ts-expect-error one target; the rest go in returns
fluidbox.bind(button, ["one", 1]);
fluidbox.bindOverlay(document.createElement("span"), "one");
fluidbox.bindOverlay(document.createElement("span"), "one", { returns: [1], travel: true });
fluidbox.bindOverlay(document.createElement("span"), 0, {
  travel: ({ item, target }) => void (target.textContent = item.credit),
  frameLayer: document.createElement("span"),
});
// @ts-expect-error a frame layer is an element
fluidbox.bindOverlay(button, 0, { travel: true, frameLayer: "badge" });

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
  void [event.stop, event.reason];
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
  stop: 1,
  reason: "pointer",
});
const zoomChange = new FluidboxZoomEvent("zoomchange", { scale: 2, reason: "wheel" });
void [change, sheetChange, zoomChange];

const update: FluidboxUpdateOptions<Photo> = { labels: { close: "Sulje" }, zoom: undefined };
fluidbox.update(update);
fluidbox.update({ controls: ["close"], filmstrip: true, sheet: { snapPoints: ["50%"] } });
const id: string = idOf(photo);
const name: string = rootItemLabel(photo);
void [id, name];

const sheet = fluidbox.sheet;
if (sheet) {
  sheet.set(1, { animate: false });
  const stop: number = sheet.stop;
  void stop;
  // @ts-expect-error the sheet's stop changes arrive as sheetchange events
  sheet.subscribe(() => {});
}
fluidbox.destroy();

const options: FluidboxOptions = { items: [photo, video, embed, note] };
void options;

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
    | "FluidboxSheetEvent"
    | "FluidboxValueChangeEvent"
    | "FluidboxZoomEvent"
  >
>();

// Add-on entries register on import and export types only.
assert<Equal<keyof typeof SheetEntry, never>>();
assert<Equal<keyof typeof FilmstripEntry, never>>();
const snap: FluidboxSheetSnapPoint[] = [120, "50%", "content"];
const sheetOptions: FluidboxSheetOptions<Photo> = { snapPoints: snap, dismiss: "none" };
const filmstripOptions: FluidboxFilmstripOptions<Photo> = {
  render: ({ item, target }) => void (target.title = item.credit),
};
// @ts-expect-error the filmstrip renders; frameworks fill slots through the kit
void ({ slots: true } satisfies FluidboxFilmstripOptions);
void [sheetOptions, filmstripOptions];

// The binding kit.

const stand: Fluidbox<Photo> = createFluidbox<Photo>({ items: photos });
const trigger: FluidboxTrigger<Photo> = createTrigger(stand, {
  target: "one",
  returns: photos,
  onPreviewChange: (item) => void item.credit,
});
const preview: FluidboxTriggerPreview<Photo> = trigger.preview(stand.state);
void preview.item?.credit;
trigger.setElement(button);
trigger.click({ defaultPrevented: false });
trigger.destroy();
bindTrigger(stand, button, { target: 0 }).destroy();
stand.update({ zoom: false });
const slotRenderer: FluidboxSlots<Photo> = createSlots<Photo>();
const firstSlot: FluidboxSlot<Photo> | undefined = slotRenderer.slots[0];
slotRenderer.subscribe(
  () => void [firstSlot?.item.credit, firstSlot?.target, firstSlot?.container],
)();
const layer: HTMLElement | undefined = frameLayerOf(button);
void layer;
unloadFluidbox(stand);
const label: string = itemLabel(note);
const close: Promise<boolean> = fluidboxControls.close.run(stand);
const disabled: boolean = fluidboxControls.next.disabled(stand.state);
void fluidboxControls.zoomIn.run(stand);
void [label, close, disabled, fluidboxControlIcon.paths, defaultLabels.viewer, fluidboxEventTypes];
const adapter: FluidboxOriginAdapter = latestOrigins(() => origins as FluidboxOriginAdapter);
const resolved: FluidboxOrigin = resolveOrigin(button);
void [adapter, resolved];

// The custom elements.

const gallery = document.createElement("fluidbox-gallery");
assert<Equal<typeof gallery, FluidboxGalleryElement>>();
gallery.items = photos;
gallery.renderers = { note: note2 };
gallery.viewer = ({ target }) => {
  target.append("Caption");
};
gallery.origins = origins as FluidboxOriginAdapter;
gallery.zoom = false;
gallery.labels = labels;
const galleryState: FluidboxState = gallery.state;
const gallerySheet: FluidboxSheet | null = gallery.sheet;
const galleryFluidbox: Fluidbox | null = gallery.fluidbox;
void [galleryState, gallerySheet, galleryFluidbox];
gallery.preload(photo)();
void gallery.load().then((loaded: boolean) => loaded);
gallery.loading = "press";
void gallery.setItems(photos).then((applied: boolean) => applied);
gallery.addEventListener("sheetchange", (event) => void event.stop);
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
void gallery.resetZoom();
gallery.addEventListener("zoomchange", (event) => void event.scale);
void gallery.close();
void gallery.whenReady().then((ready: Fluidbox) => ready.state);
gallery.subscribe((state) => void state.index)();
// @ts-expect-error items, not a source
gallery.source = photos;
// @ts-expect-error the viewer, not a portal
gallery.portal = viewer;

const item: FluidboxItemElement = document.createElement("fluidbox-item");
void [item.itemId, item.returns, item.trigger];
item.addEventListener("fluidbox-preview-change", (event: FluidboxPreviewChangeEvent) => {
  void [event.detail.id, event.detail.item];
});
const strip: FluidboxFilmstripElement = document.createElement("fluidbox-filmstrip");
strip.render = ({ target, index }) => void (target.textContent = String(index));
const sheetElement: FluidboxSheetElement = document.createElement("fluidbox-sheet");
sheetElement.render = ({ target }) => {
  target.append("Details");
};
