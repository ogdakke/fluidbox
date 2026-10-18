import { mountSite } from "../src/site";
import { arraySource, createLightbox } from "@ogdakke/fluidbox";
import type { LightboxController, LightboxItem, LightboxOrigin } from "@ogdakke/fluidbox";
import { artItem, artSrc, sceneById } from "../src/art";
import { mapEmbedUrl, mapView } from "../src/map-view";
import "./flight.css";

mountSite("fixtures", {
  fixture: "Flight conformance · one card per kind of origin, each with its own viewer",
});

type FlightCase = {
  readonly id: string;
  readonly title: string;
  /** What a correct flight looks like, shown under the card. */
  readonly expect: string;
  readonly items: LightboxItem[];
  /** The card's inner markup. The visual box carries `data-lightbox-origin`. */
  readonly markup: string;
  /** Extra wiring once the controller exists. */
  readonly setup?: (controller: LightboxController, trigger: HTMLElement) => void;
};

const art = (id: string, itemId = `flight-${id}`) => artItem(sceneById(id), itemId);
const video: LightboxItem = {
  id: "flight-video",
  media: {
    type: "video",
    src: "/video/drift.webm",
    mimeType: "video/webm",
    title: "Drifting gradient",
    width: 960,
    height: 540,
    poster: { src: "/video/drift-poster.jpg", width: 960, height: 540 },
  },
  thumbnail: { src: "/video/drift-poster.jpg", width: 960, height: 540 },
};
const inlineVideo = `<video data-lightbox-origin autoplay loop muted playsinline poster="/video/drift-poster.jpg">
  <source src="/video/drift.webm" type="video/webm" />
  <source src="/video/drift.mp4" type="video/mp4" />
</video>`;

const cases: FlightCase[] = [
  {
    id: "cover",
    title: "Cropped image",
    expect: "The image grows out of the crop and its corners straighten. No fade.",
    items: [art("aurora")],
    markup: `<span class="flight-visual" data-lightbox-origin><img src="${artSrc(sceneById("aurora"))}" alt="" /></span>`,
  },
  {
    id: "contain",
    title: "Letterboxed image",
    expect: "The whole image is visible in the card; the flight should not crop it first.",
    items: [art("coast")],
    markup: `<span class="flight-visual flight-visual--contain" data-lightbox-origin><img src="${artSrc(sceneById("coast"))}" alt="" /></span>`,
  },
  {
    id: "position",
    title: "Top-anchored crop",
    expect: "The card shows the top of the image. The flight should start from that crop.",
    items: [art("fjord")],
    markup: `<span class="flight-visual flight-visual--top" data-lightbox-origin><img src="${artSrc(sceneById("fjord"))}" alt="" /></span>`,
  },
  {
    id: "different",
    title: "Different picture",
    expect: "The card shows another image. The slide fades in over it; no picture-in-picture.",
    items: [art("lagoon")],
    markup: `<span class="flight-visual" data-lightbox-origin><img src="${artSrc(sceneById("ridge"))}" alt="" /></span>`,
  },
  {
    id: "text",
    title: "Text card",
    expect: "No image at all. The slide fades in as it grows and fades back into the card.",
    items: [art("dune")],
    markup: `<span class="flight-text" data-lightbox-origin><strong>04</strong><span>Open the dunes</span></span>`,
  },
  {
    id: "badge",
    title: "Travelling badge",
    expect: "The badge rides on the image at its own size and lands where it started.",
    items: [art("meadow")],
    markup: `<span class="flight-visual" data-lightbox-origin><img src="${artSrc(sceneById("meadow"))}" alt="" /><span class="flight-badge-host" data-flight-badge-host><span class="flight-badge">New</span></span></span>`,
    setup(controller, trigger) {
      const host = trigger.querySelector<HTMLElement>("[data-flight-badge-host]")!;
      controller.registerThumbnailOverlay("flight-meadow", {
        behavior: "travel",
        element: host,
        renderer: {
          mount({ target }) {
            // Travel content fades near the card by default; a badge stays on the image.
            target.style.setProperty("--lightbox-transition-content-opacity", "1");
            const badge = document.createElement("span");
            badge.className = "flight-badge";
            badge.textContent = "New";
            target.append(badge);
          },
        },
      });
    },
  },
  {
    id: "scroll",
    title: "Inside a scroller",
    expect:
      "The scroller hides a third of the card. The flight leaves from and lands on the visible part.",
    items: [art("canyon")],
    markup: `<span class="flight-scroller" data-flight-scroller><span class="flight-scroller__spacer"></span><span class="flight-visual" data-lightbox-origin><img src="${artSrc(sceneById("canyon"))}" alt="" /></span><span class="flight-scroller__spacer"></span></span>`,
  },
  {
    id: "sticky",
    title: "Sticky card",
    expect: "Scroll the page while it closes. The flight follows the card.",
    items: [art("alpine")],
    markup: `<span class="flight-visual flight-visual--sticky" data-lightbox-origin><img src="${artSrc(sceneById("alpine"))}" alt="" /></span>`,
  },
  {
    id: "scaled",
    title: "Scaled ancestor",
    expect: "The card sits in a scaled container. The flight matches its painted size.",
    items: [art("ridge")],
    markup: `<span class="flight-scaled"><span class="flight-visual" data-lightbox-origin><img src="${artSrc(sceneById("ridge"))}" alt="" /></span></span>`,
  },
  {
    id: "video-poster",
    title: "Poster to video",
    expect:
      "The poster grows into the player, controls and all, so playback never stops; closing lands on the poster.",
    items: [video],
    markup: `<span class="flight-visual" data-lightbox-origin><img src="/video/drift-poster.jpg" alt="" /><span class="flight-play" aria-hidden="true">▶</span></span>`,
  },
  {
    id: "video-inline",
    title: "Playing video",
    expect: "A muted inline loop opens the full player, like the portfolio post.",
    items: [{ ...video, id: "flight-video-inline" }],
    markup: `<span class="flight-visual">${inlineVideo}</span>`,
  },
  {
    id: "iframe",
    title: "Map to iframe",
    expect: "The snapshot covers the embed until it loads. Closing never reloads the page.",
    items: [
      {
        id: "flight-map",
        media: {
          type: "iframe",
          src: mapEmbedUrl(),
          title: mapView.title,
          width: mapView.width,
          height: mapView.height,
        },
        thumbnail: { src: "/map/preview.svg", width: mapView.width, height: mapView.height },
      },
    ],
    markup: `<span class="flight-visual" data-lightbox-origin><img src="/map/preview.svg" alt="" /></span>`,
  },
];

const grid = document.querySelector<HTMLElement>("[data-flight-cases]")!;
const viewers: Record<string, LightboxController> = {};

for (const flight of cases) {
  const cell = document.createElement("article");
  cell.className = "fb-cell flight-case";
  cell.dataset.flightCase = flight.id;
  cell.innerHTML = `
    <button type="button" class="flight-trigger" data-flight-trigger aria-label="Open ${flight.title}">${flight.markup}</button>
    <h3>${flight.title}</h3>
    <p>${flight.expect}</p>`;
  grid.append(cell);
  const trigger = cell.querySelector<HTMLElement>("[data-flight-trigger]")!;
  const origin = (): LightboxOrigin => {
    const visual =
      trigger.querySelector<HTMLElement>("[data-lightbox-origin]") ??
      trigger.querySelector<HTMLElement>("video") ??
      trigger;
    const thumbnail = visual.matches("img") ? visual : visual.querySelector("img");
    return { trigger, visual, thumbnail: (thumbnail as HTMLImageElement | null) ?? undefined };
  };
  const controller = createLightbox({
    source: arraySource(flight.items),
    origins: { getOrigin: (id) => (flight.items.some((item) => item.id === id) ? origin() : null) },
  });
  flight.setup?.(controller, trigger);
  trigger.addEventListener("click", () => {
    void controller.open({ id: flight.items[0]!.id }, { reason: "trigger" });
  });
  viewers[flight.id] = controller;
}

// Scroll the card a third of the way out, so the scroller clips its left side.
const scroller = document.querySelector<HTMLElement>("[data-flight-scroller]");
const scrolled = scroller?.querySelector<HTMLElement>("[data-lightbox-origin]");
if (scroller && scrolled) {
  scroller.scrollLeft = scrolled.offsetLeft - scroller.offsetLeft + scrolled.offsetWidth / 3;
}

if (new URLSearchParams(location.search).has("slow")) {
  // Web Animations has no global rate. Slow script animations as they are
  // created, and CSS animations on a timer (WebKit throttles frame callbacks).
  const animate = Object.getOwnPropertyDescriptor(Element.prototype, "animate")!.value as (
    this: Element,
    ...args: Parameters<Element["animate"]>
  ) => Animation;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
    const animation = animate.apply(this, args);
    animation.playbackRate = 0.1;
    return animation;
  };
  setInterval(() => {
    for (const animation of document.getAnimations()) {
      if (animation.playbackRate === 1) animation.playbackRate = 0.1;
    }
  }, 16);
}

declare global {
  interface Window {
    flightViewers: typeof viewers;
  }
}
window.flightViewers = viewers;
