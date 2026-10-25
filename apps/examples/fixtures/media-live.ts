import { mountSite } from "../src/site";
import { createFluidbox } from "@ogdakke/fluidbox";
import { createModelSlide, modelItem } from "@ogdakke/fluidbox/model";
import "./media.css";

mountSite("fixtures", {
  fixture: "Media add-ons · live 3D thumbnails that open on the view they show",
});

const MODEL_VIEWER = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
// The cards draw live models, so <model-viewer> loads with the page.
const loadModelViewer = () => import(/* @vite-ignore */ MODEL_VIEWER);
void loadModelViewer();

const helmet = "/products/damaged-helmet/damaged-helmet.glb";
const model = (id: string, src: string, title: string) =>
  modelItem({
    id,
    title,
    src,
    poster: "/products/damaged-helmet/damaged-helmet.webp",
    width: 800,
    height: 800,
    thumbnail: {
      src: "/products/damaged-helmet/damaged-helmet-thumb.webp",
      width: 160,
      height: 160,
    },
  });

// Two live cards, and a model whose card is a still: the query string makes
// each a model of its own.
const items = [
  model("live-a", helmet, "Damaged Helmet"),
  model("live-b", `${helmet}?copy=b`, "Damaged Helmet, a second copy"),
  model("still-c", `${helmet}?copy=c`, "Damaged Helmet, with a still card"),
];

const fluidbox = createFluidbox({
  items,
  slides: { model: createModelSlide({ load: loadModelViewer }) },
});

const grid = document.querySelector<HTMLElement>("#live")!;
for (const item of items) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.item = item.id;
  button.setAttribute("aria-label", `Open 3D view: ${item.title}`);
  if (item.id === "still-c") {
    const image = document.createElement("img");
    image.alt = "";
    image.src = item.thumbnail!.src;
    button.append(image);
  } else {
    // A live model: a drag on it turns it, and a click without one opens the viewer.
    const card = document.createElement("model-viewer");
    card.setAttribute("src", item.src);
    card.setAttribute("poster", item.thumbnail!.src);
    card.setAttribute("camera-controls", "");
    card.setAttribute("touch-action", "pan-y");
    card.setAttribute("interaction-prompt", "none");
    button.append(card);
  }
  grid.append(button);
  fluidbox.bind(button, item);
}

Object.assign(window, { liveFixture: { fluidbox } });
