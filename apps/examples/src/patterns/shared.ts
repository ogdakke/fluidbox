/**
 * Data and styles shared by every framework's pattern examples. Each framework
 * implements the same thirteen patterns in `src/patterns/<framework>/`, against the
 * hooks listed in CONTRACT.md, so one browser spec checks them all.
 */
import type {
  FluidboxCustomItemBase,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxLabels,
} from "@ogdakke/fluidbox";
import { youtubeItem } from "@ogdakke/fluidbox/embeds";
import { modelItem } from "@ogdakke/fluidbox/model";
import { spinItem } from "@ogdakke/fluidbox/spin";
import { artItem, artSrc, sceneById, scenes } from "../art";
import { mapEmbedUrl, mapView } from "../map-view";
import "./patterns.css";

export { artSrc, sceneById, scenes };

const art = (prefix: string, ids: string[]) =>
  ids.map((id) => artItem(sceneById(id), `${prefix}-${id}`));

/** 1 basic, 5 programmatic, 6 zoom (zoom off), 7 filmstrip, 8 sheet, 9 headless, 10 rtl. */
export const photos: FluidboxImageItem[] = art("photo", ["aurora", "ridge", "fjord", "lagoon"]);

/** 2 overlay: an album behind one trigger. */
export const album: FluidboxImageItem[] = art("album", [
  "dune",
  "canyon",
  "coast",
  "meadow",
  "alpine",
]);

/** 3 origins: a product card and a horizontal scroller. */
export const product: FluidboxImageItem = {
  type: "image",
  src: "/runner.svg",
  alt: "Illustrated coral running shoe",
  width: 1000,
  height: 700,
};
export const strip: FluidboxImageItem[] = art("strip", [
  "alpine",
  "meadow",
  "aurora",
  "ridge",
  "fjord",
  "lagoon",
  "dune",
  "canyon",
]);

/** 4 renderers: a note, an item type of the examples' own. */
export interface NoteItem extends FluidboxCustomItemBase<"note"> {
  readonly id: string;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    note: NoteItem;
  }
}

/** 4 renderers: one custom note, one live map, one video, one YouTube embed. */
export const media: FluidboxItem[] = [
  {
    type: "note",
    id: "media-note",
    title: "A note",
    width: 800,
    height: 600,
    thumbnail: { src: "/art/meadow.svg", width: 1200, height: 800 },
  },
  {
    type: "iframe",
    id: "media-map",
    src: mapEmbedUrl(),
    title: mapView.title,
    width: mapView.width,
    height: mapView.height,
    thumbnail: { src: "/map/preview.svg", width: mapView.width, height: mapView.height },
  },
  {
    type: "video",
    id: "media-video",
    src: "/video/drift.webm",
    title: "Drifting clouds",
    width: 960,
    height: 540,
    poster: "/video/drift-poster.jpg",
  },
  {
    type: "iframe",
    id: "media-youtube",
    src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    title: "Rick Astley - Never Gonna Give You Up",
    width: 1280,
    height: 720,
    allow: "autoplay; encrypted-media; picture-in-picture",
    // YouTube won't play an embed that sends no referrer.
    referrerPolicy: "strict-origin-when-cross-origin",
    thumbnail: {
      src: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      width: 1280,
      height: 720,
    },
  },
];

/**
 * 6 zoom: photos at two widths in `srcset`, and the full-size file as `zoom.src`,
 * which the viewer loads once a zoom shows more pixels than the 1280w has.
 */
const ladder = (id: string, alt: string, width: number, height: number): FluidboxImageItem => ({
  id: `zoom-${id}`,
  type: "image",
  src: `/photos/${id}-1280.webp`,
  srcset: `/photos/${id}-640.webp 640w, /photos/${id}-1280.webp 1280w`,
  zoom: { src: `/photos/${id}.webp` },
  alt,
  width,
  height,
  thumbnail: { src: `/photos/${id}-thumb.webp` },
});
export const zoomPhotos: FluidboxImageItem[] = [
  ladder("1015", "Fjord from the cliff edge", 1800, 1200),
  ladder("883", "Still lake", 1800, 1200),
  ladder("1016", "Red rock canyon", 1920, 1080),
  ladder("1043", "Granite valley", 1600, 1200),
];

/** 12 hover: a product photo, shown on the page at 640w, magnified from the 1600w. */
export const productPhoto: FluidboxImageItem = {
  id: "fjord-wood",
  type: "image",
  src: "/products/fjord-wood.webp",
  srcset: "/products/fjord-wood-640.webp 640w, /products/fjord-wood.webp 1600w",
  alt: "The print in a wood frame",
  width: 1600,
  height: 1600,
  thumbnail: { src: "/products/fjord-wood-640.webp", width: 640, height: 640 },
};

/** 13 media: a photo, a video, a 360° spin and a 3D model, from the add-ons' helpers. */
export const productMedia: FluidboxItem[] = [
  productPhoto,
  youtubeItem("https://www.youtube.com/watch?v=M7lc1UVf-VE", {
    id: "product-video",
    title: "How the print is made",
    thumbnail: { src: "https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg", width: 320, height: 180 },
  }),
  spinItem({
    id: "product-spin",
    title: "The framed print, all the way round",
    frames: { src: "/products/spin/fjord-{index}.webp", count: 36, digits: 2 },
    width: 800,
    height: 800,
    thumbnail: { src: "/products/spin/fjord-00-thumb.webp", width: 160, height: 160 },
  }),
  modelItem({
    id: "product-model",
    // Khronos's glTF sample: CC BY-NC 4.0 © 2016 theblueturtle_, CC BY 4.0 © 2018 ctxwing.
    title: "Damaged Helmet, a 3D model",
    src: "/products/damaged-helmet/damaged-helmet.glb",
    poster: "/products/damaged-helmet/damaged-helmet.webp",
    width: 800,
    height: 800,
    thumbnail: {
      src: "/products/damaged-helmet/damaged-helmet-thumb.webp",
      width: 160,
      height: 160,
    },
  }),
];

/**
 * The model add-on draws Google's <model-viewer>, which it doesn't bundle. The
 * examples load a pinned build from its CDN; an app would `import("@google/model-viewer")`.
 */
export const modelViewerUrl =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

/** The value each framework provides through its own context, read by the custom renderer. */
export const theme = "dusk";

/** The picture a trigger shows for an item: its thumbnail, a video's poster, or the image. */
export const thumbnailSrc = (item: FluidboxItem) =>
  item.thumbnail?.src ??
  (item.type === "video" ? item.poster : item.type === "image" ? item.src : "");

/** 10 rtl: the viewer's words in Arabic, with Arabic-Indic digits in the position. */
// Plain "ar" now formats with Western digits; nu-arab asks for Arabic-Indic ones.
const arabicNumber = new Intl.NumberFormat("ar-u-nu-arab");
export const arabic: Partial<FluidboxLabels> = {
  viewer: "عارض الوسائط",
  close: "إغلاق",
  previous: "السابق",
  next: "التالي",
  position: (index, count) =>
    `العنصر ${arabicNumber.format(index + 1)} من ${arabicNumber.format(count)}`,
  slides: "عناصر المعرض",
  filmstrip: "شريط الصور المصغّرة",
  filmstripList: "اختر عنصرًا من المعرض",
  zoomed: "صورة مكبّرة",
  sheet: "التفاصيل",
  error: "تعذّر تحميل الوسائط.",
  retry: "إعادة المحاولة",
};

export type PatternName =
  | "basic"
  | "overlay"
  | "origins"
  | "renderers"
  | "programmatic"
  | "zoom"
  | "filmstrip"
  | "sheet"
  | "headless"
  | "rtl"
  | "url"
  | "hover"
  | "media";

export const patternNames: readonly PatternName[] = [
  "basic",
  "overlay",
  "origins",
  "renderers",
  "programmatic",
  "zoom",
  "filmstrip",
  "sheet",
  "headless",
  "rtl",
  "url",
  "hover",
  "media",
];
