/**
 * Data and styles shared by every framework's pattern examples. Each framework
 * implements the same ten patterns in `src/patterns/<framework>/`, against the
 * hooks listed in CONTRACT.md, so one browser spec checks them all.
 */
import type { FluidboxImageItem, FluidboxItem, FluidboxLabels } from "@ogdakke/fluidbox";
import { artItem, artSrc, sceneById, scenes } from "../art";
import { mapEmbedUrl, mapView } from "../map-view";
import "./patterns.css";

export { artSrc, sceneById, scenes };

const art = (prefix: string, ids: string[]) =>
  ids.map((id) => artItem(sceneById(id), `${prefix}-${id}`));

/** 1 basic, 5 programmatic, 6 zoom, 7 filmstrip, 8 sheet, 9 headless, 10 rtl. */
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
  type: "img",
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

/** 4 renderers: one custom note, one live map, one video, one YouTube embed. */
export const media: FluidboxItem[] = [
  {
    type: "custom",
    id: "media-note",
    render: "note",
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

/** The value each framework provides through its own context, read by the custom renderer. */
export const theme = "dusk";

/** The picture a trigger shows for an item: its thumbnail, a video's poster, or the image. */
export const thumbnailSrc = (item: FluidboxItem) =>
  item.thumbnail?.src ??
  (item.type === "video" ? item.poster : item.type === "img" ? item.src : "");

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
  | "rtl";

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
];
