import { mountSite } from "../src/site";
import {
  createFluidbox,
  itemLabel,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
  type FluidboxItem,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";

mountSite("fixtures", { fixture: "Slideshow · timer, pauses, the control and its live region" });

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    held: FluidboxCustomItemBase<"held">;
  }
}

const params = new URLSearchParams(location.search);

const photo = (id: string, src: string) =>
  ({
    type: "image",
    id,
    src,
    alt: `Photo ${id}`,
    width: 800,
    height: 800,
    thumbnail: { src },
  }) satisfies FluidboxImageItem;

// `?held` puts a slide that is ready only once the test says so second;
// `?video` puts a video there.
const second: FluidboxItem = params.has("held")
  ? { type: "held", id: "held", title: "Held", width: 800, height: 800 }
  : params.has("video")
    ? {
        type: "video",
        id: "clip",
        src: "/video/drift.mp4",
        poster: "/video/drift-poster.jpg",
        title: "Drift",
        width: 1280,
        height: 720,
        muted: true,
        controls: true,
      }
    : photo("two", "/photo-portrait.svg");

const items: FluidboxItem[] = [
  photo("one", "/photo-square.svg"),
  second,
  photo("three", "/first.svg"),
  photo("four", "/second.svg"),
];

/** What happened, in order, for the tests. */
const log: string[] = [];
/** Makes the held slide ready. */
let release: () => void = () => {};

const interval = Number(params.get("interval") ?? 5000);
const fluidbox: Fluidbox = createFluidbox({
  items,
  controls: ["previous", "next", "close", "slideshow"],
  slides: {
    held: (slide) => {
      slide.media.textContent = "Held";
      slide.waitUntil(new Promise<void>((resolve) => (release = resolve)));
    },
  },
  loop: params.has("loop"),
  ...(params.has("noslideshow")
    ? {}
    : { slideshow: { interval, autoplay: params.has("autoplay") } }),
});

fluidbox.addEventListener("valuechange", (event) => {
  log.push(`${event.action} ${event.value} ${event.reason}`);
});

const root = document.querySelector<HTMLElement>("#slideshow")!;
for (const item of items) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.item = item.id;
  button.setAttribute("aria-label", `Open ${itemLabel(item)}`);
  const image = document.createElement("img");
  image.alt = "";
  image.src = item.type === "image" ? (item.thumbnail?.src ?? item.src) : "/photo-square.svg";
  button.append(image);
  root.append(button);
  fluidbox.bind(button, item);
}
// A Slideshow button of the page's own.
fluidbox.bindControl(document.querySelector("#page-slideshow")!, "slideshow");

Object.assign(window, { slideshowFixture: { fluidbox, items, log, release: () => release() } });
document.documentElement.dataset.fixtureReady = "";
