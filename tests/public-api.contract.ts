// A type-level contract of the public API: what each entry point exports, and
// the shapes a consumer writes. `tsc --noEmit` checks it; nothing runs it.
import {
  createFluidbox,
  createItemList,
  FluidboxItemChangeEvent,
  FluidboxSheetEvent,
  FluidboxToggleEvent,
  idOf,
  itemLabel as rootItemLabel,
  type Fluidbox,
  type FluidboxCustomItem,
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
  type FluidboxState,
  type FluidboxStatus,
  type FluidboxTarget,
  type FluidboxUpdateOptions,
  type FluidboxVideoItem,
  type FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import type * as Root from "@ogdakke/fluidbox";
import type * as SheetEntry from "@ogdakke/fluidbox/sheet";
import type * as FilmstripEntry from "@ogdakke/fluidbox/filmstrip";
import type { FluidboxFilmstripOptions } from "@ogdakke/fluidbox/filmstrip";
import type { FluidboxSheetOptions, FluidboxSheetSnapPoint } from "@ogdakke/fluidbox/sheet";
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
  type: "img",
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
const note = {
  type: "custom",
  id: "note",
  render: "note",
  title: "Note",
  width: 400,
  height: 300,
} satisfies FluidboxCustomItem;

// @ts-expect-error images need intrinsic dimensions
const missingDimensions: FluidboxImageItem = { type: "img", src: "/bad.jpg", alt: "Bad" };
// @ts-expect-error a custom item needs an id: there is no src to default it to
const anonymousCustom: FluidboxCustomItem = {
  type: "custom",
  render: "note",
  title: "N",
  width: 1,
  height: 1,
};
// @ts-expect-error a video poster is a URL, not an image object
const posterObject: FluidboxVideoItem = { ...video, poster: { src: "/poster.jpg" } };
// @ts-expect-error there is no media wrapper
const nested: FluidboxItem = { id: "nested", media: photo };
// @ts-expect-error srcset strings replace candidate lists
const candidates: FluidboxImageItem = { ...photo, candidates: [{ src: "/a.jpg", width: 1 }] };
// @ts-expect-error the old "image" type name is gone
const oldType: FluidboxItem = { ...photo, type: "image" };
void [missingDimensions, anonymousCustom, posterObject, nested, candidates, oldType];

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
assert<Equal<FluidboxReason, "api" | "trigger" | "keyboard" | "pointer" | "wheel" | "items">>();
// A scrub is a kind of move, not a source of one.
void fluidbox.open(1, { scrub: true });

createFluidbox({ items: lazy, controls: true, filmstrip: true, sheet: true, zoom: false });
// @ts-expect-error items, not a source
createFluidbox({ source: photos });
// @ts-expect-error the viewer, not a portal
createFluidbox({ items: photos, portal: viewer });
// @ts-expect-error events replace callbacks
createFluidbox({ items: photos, onEvent() {} });
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

fluidbox.addEventListener("beforetoggle", (event) => {
  assert<Equal<typeof event, FluidboxToggleEvent>>();
  if (event.newState === "closed" && event.reason === "keyboard") event.preventDefault();
});
fluidbox.addEventListener("itemchange", (event) => {
  assert<Equal<typeof event, FluidboxItemChangeEvent<Photo>>>();
  assert<Equal<typeof event.item, Photo>>();
  void [event.id, event.index];
});
fluidbox.addEventListener("settle", (event) => void event.item.credit);
fluidbox.addEventListener("sheetchange", (event) => {
  assert<Equal<typeof event, FluidboxSheetEvent>>();
  void [event.stop, event.reason];
});
const toggle = new FluidboxToggleEvent("toggle", {
  oldState: "closed",
  newState: "open",
  reason: "api",
});
const change = new FluidboxItemChangeEvent("itemchange", {
  id: "one",
  index: 0,
  item: photo,
  reason: "api",
});
const sheetChange = new FluidboxSheetEvent("sheetchange", { stop: 1, reason: "pointer" });
void [toggle, change, sheetChange];

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
    | "FluidboxItemChangeEvent"
    | "FluidboxSheetEvent"
    | "FluidboxToggleEvent"
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
void gallery.setItems(photos).then((applied: boolean) => applied);
gallery.addEventListener("sheetchange", (event) => void event.stop);
gallery.addEventListener("itemchange", (event) => {
  const reason: FluidboxReason = event.reason;
  void [reason, event.item];
});
gallery.addEventListener("toggle", (event) => void event.newState.startsWith("o"));
gallery.addEventListener("click", (event) => void event.clientX);
void gallery.open(2);
void gallery.open("one");
void gallery.next();
void gallery.previous();
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
