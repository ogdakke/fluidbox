import { mountSite } from "../src/site";
import { createFluidbox, type FluidboxItem, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { renderEmbed, vimeoItem, youtubeItem } from "@ogdakke/fluidbox/embeds";
import { createModelRenderer, modelItem } from "@ogdakke/fluidbox/model";
import { createSpinRenderer, spinItem } from "@ogdakke/fluidbox/spin";
import "./media.css";

mountSite("fixtures", {
  fixture: "Media add-ons · slide activity, YouTube and Vimeo, a 360° spin and a 3D model",
});

/** What the probe slides saw, in order, for the tests. */
const log: string[] = [];

/** A slide that records when it mounts, comes on show, leaves it and unloads. */
const probe: FluidboxSlideRenderer = ({ item, target, signal, active, onActiveChange }) => {
  const id = item.id ?? "";
  log.push(`${id} mount ${active ? "active" : "inactive"}`);
  const text = document.createElement("p");
  text.className = "media-probe";
  text.textContent = `${id}: ${active ? "on show" : "waiting"}`;
  target.append(text);
  onActiveChange((now) => {
    log.push(`${id} ${now ? "active" : "inactive"}`);
    text.textContent = `${id}: ${now ? "on show" : "waiting"}`;
  });
  signal.addEventListener("abort", () => log.push(`${id} abort`));
};

const probeItem = (id: string): FluidboxItem => ({
  type: "custom",
  id,
  render: "probe",
  title: `Probe ${id}`,
  width: 800,
  height: 600,
  thumbnail: { src: "/photo-square.svg" },
});

const items: FluidboxItem[] = [
  { type: "img", id: "photo", src: "/photo-square.svg", alt: "Square", width: 800, height: 800 },
  probeItem("a"),
  probeItem("b"),
  youtubeItem("https://youtu.be/M7lc1UVf-VE", {
    title: "YouTube video",
    thumbnail: { src: "/products/fjord-room-thumb.webp", width: 160, height: 160 },
  }),
  vimeoItem("https://vimeo.com/76979871/8272103f6e", {
    title: "Vimeo video",
    poster: "/products/fjord-detail.webp",
    thumbnail: { src: "/products/fjord-detail-thumb.webp", width: 160, height: 160 },
  }),
  spinItem({
    title: "Framed print, all the way round",
    frames: { src: "/products/spin/fjord-{index}.webp", count: 36, digits: 2 },
    width: 800,
    height: 800,
    thumbnail: { src: "/products/spin/fjord-00-thumb.webp", width: 160, height: 160 },
  }),
  modelItem({
    title: "Damaged Helmet in 3D",
    src: "/products/damaged-helmet/damaged-helmet.glb",
    poster: "/products/damaged-helmet/damaged-helmet.webp",
    width: 800,
    height: 800,
    thumbnail: {
      src: "/products/damaged-helmet/damaged-helmet-thumb.webp",
      width: 160,
      height: 160,
    },
    ar: true,
    arModes: "webxr quick-look",
    iosSrc: "/products/damaged-helmet/damaged-helmet.usdz",
  }),
  probeItem("c"),
];

const MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

const fluidbox = createFluidbox({
  items,
  renderers: {
    probe,
    embed: renderEmbed,
    spin: createSpinRenderer(),
    model: createModelRenderer({ load: () => import(/* @vite-ignore */ MODEL_VIEWER) }),
  },
});

const grid = document.querySelector<HTMLElement>("#media")!;
for (const item of items) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.item = item.id;
  button.setAttribute("aria-label", `Open ${item.type === "img" ? item.alt : item.title}`);
  const image = document.createElement("img");
  image.alt = "";
  image.src = item.type === "img" ? item.src : (item.thumbnail?.src ?? "");
  button.append(image);
  grid.append(button);
  fluidbox.bind(button, item);
}

Object.assign(window, { mediaFixture: { fluidbox, log } });
