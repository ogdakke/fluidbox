import { mountSite } from "../src/site";
import {
  createFluidbox,
  itemLabel,
  type Fluidbox,
  type FluidboxCustomItemBase,
  type FluidboxImageItem,
  type FluidboxItem,
  type FluidboxOptions,
} from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/thumbnails";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./features.css";

mountSite("fixtures", {
  fixture: "Features · full screen, download, share, media errors, gestures and item data",
});

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    flaky: FluidboxCustomItemBase<"flaky">;
  }
}

const params = new URLSearchParams(location.search);

const photo = (id: string, src: string, fields: Partial<FluidboxImageItem> = {}) =>
  ({
    type: "image",
    id,
    src,
    alt: `Photo ${id}`,
    width: 800,
    height: 800,
    thumbnail: { src },
    ...fields,
  }) satisfies FluidboxImageItem;

const items: FluidboxItem[] = [
  photo("one", "/photo-square.svg", { data: { tone: "light", kind: "product" } }),
  photo("two", "/photo-portrait.svg", {
    height: 1000,
    download: { src: "https://files.example/two.svg", filename: "portrait.svg" },
    data: { tone: "dark" },
  }),
  photo("off", "/first.svg", { download: false }),
  photo("broken", "/missing-photo.jpg", { thumbnail: { src: "/second.svg" } }),
  { type: "flaky", id: "flaky", title: "Flaky", width: 800, height: 800 },
];

/** What happened, in order, for the tests. */
const log: string[] = [];
/** How many times the flaky slide has rendered. */
let renders = 0;

const options = (): FluidboxOptions => ({
  items,
  controls: ["previous", "next", "close", "counter", "fullscreen", "download", "share"],
  slides: {
    flaky: (slide) => {
      renders += 1;
      log.push(`render flaky ${renders}`);
      // The first render fails; Retry renders again, and that one works.
      if (renders === 1) {
        slide.fail(new Error("flaky failed"));
        return;
      }
      slide.media.textContent = "Flaky, working now";
    },
  },
  thumbnails: params.has("thumbnails"),
  ...(params.has("icons")
    ? {
        icons: {
          close: () => {
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("aria-hidden", "true");
            icon.dataset.test = "close-icon";
            return icon;
          },
        },
      }
    : {}),
  ...(params.has("noshare") ? {} : { shareUrl: (item) => `/features.html#${item.id}` }),
  dismiss: {
    drag: !params.has("nodrag"),
    backdrop: !params.has("nobackdrop"),
  },
  wheel: (params.get("wheel") as FluidboxOptions["wheel"]) ?? "dismiss",
});

const fluidbox: Fluidbox = createFluidbox(options());
const modal: Fluidbox = createFluidbox(options());

for (const box of [fluidbox, modal]) {
  box.addEventListener("mediaerror", (event) => {
    log.push(`mediaerror ${event.value} ${event.index} ${event.kind}`);
  });
}

function grid(selector: string, box: Fluidbox) {
  const root = document.querySelector<HTMLElement>(selector)!;
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
    box.bind(button, item);
  }
}

grid("#features", fluidbox);
// Controls of the page's own, kept usable while the viewer is open.
fluidbox.bindControl(document.querySelector("#page-counter")!, "counter");
fluidbox.bindControl(document.querySelector("#page-next")!, "next");
fluidbox.bindControl(document.querySelector("#page-retry")!, "retry");
grid("#quick-grid", modal);
const quick = document.querySelector<HTMLDialogElement>("#quick")!;
document.querySelector("#quick-view")!.addEventListener("click", () => quick.showModal());
document.querySelector("#quick-close")!.addEventListener("click", () => quick.close());

Object.assign(window, { featuresFixture: { fluidbox, modal, items, log } });
document.documentElement.dataset.fixtureReady = "";
