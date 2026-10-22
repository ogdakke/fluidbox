import { mountSite } from "../src/site";
import { createFluidbox, type FluidboxItem, type FluidboxZoomEvent } from "@ogdakke/fluidbox";
import "./zoom.css";

mountSite("fixtures", {
  fixture: "Zoom · commands, controls, and a sharper image as it zooms",
});

/**
 * One photo under four widths. The query tells the requests apart; the dev
 * server sends the same file for each, so the widths are the descriptors'.
 */
const ladder = [540, 1080, 2160, 4320]
  .map((width) => `/photos/1015.webp?w=${width} ${width}w`)
  .join(", ");

const items: readonly FluidboxItem[] = [
  {
    id: "ladder",
    type: "img",
    src: "/photos/1015.webp?w=1080",
    srcset: ladder,
    // Twice the fitted width at 1280 × 720, so a zoom past 2 needs more.
    sizes: "2160px",
    alt: "A river valley",
    width: 1800,
    height: 1200,
    thumbnail: { src: "/photos/1015-thumb.webp" },
  },
  {
    id: "master",
    type: "img",
    src: "/photos/1016.webp?w=1080",
    alt: "A mountain lake",
    width: 1800,
    height: 1200,
  },
  {
    id: "clip",
    type: "video",
    src: "/video/drift.mp4",
    title: "Drift",
    width: 1280,
    height: 720,
  },
];

const fluidbox = createFluidbox({
  items,
  controls: ["previous", "next", "close", "zoomIn", "zoomOut", "zoomReset"],
});

const events: { scale: number; reason: string }[] = [];
fluidbox.addEventListener("zoomchange", (event: FluidboxZoomEvent) => {
  events.push({ scale: event.scale, reason: event.reason });
});

for (const trigger of document.querySelectorAll<HTMLElement>("[data-zoom-id]")) {
  fluidbox.bind(trigger, trigger.dataset.zoomId!);
}

declare global {
  interface Window {
    zoomViewer: typeof fluidbox;
    zoomEvents: typeof events;
  }
}

window.zoomViewer = fluidbox;
window.zoomEvents = events;
