import { mountSite } from "../src/site";
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/filmstrip";
import "@ogdakke/fluidbox/filmstrip.css";
import type {
  Fluidbox,
  FluidboxCustomItemBase,
  FluidboxItem,
  FluidboxSlides,
} from "@ogdakke/fluidbox";
import "./site.css";

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    shop: FluidboxCustomItemBase<"shop">;
  }
}

mountSite("fixtures", {
  fixture: "Accessibility · query flags: filmstrip, unnamed, viewer, broken",
});

const params = new URLSearchParams(location.search);

const items: FluidboxItem[] = [
  { id: "first", type: "image", src: "/first.svg", alt: "Red study", width: 600, height: 400 },
  {
    id: "second",
    type: "image",
    src: params.has("broken") ? "/missing.svg?delay=300" : "/second.svg",
    alt: params.has("unnamed") ? "" : "Blue study",
    width: 600,
    height: 400,
    thumbnail: { src: "/second.svg" },
  },
  {
    id: "video",
    type: "video",
    src: "/video/drift.webm",
    title: "Drifting clouds",
    width: 640,
    height: 360,
    tracks: [
      { src: "/captions.vtt", kind: "captions", srclang: "en", label: "English", default: true },
    ],
  },
  { id: "shop", type: "shop", title: "Product form", width: 600, height: 400 },
];

/** A web component with its own focusable control, as a 3D viewer has. */
class ShadowControl extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: "open" }).innerHTML = `<button type="button">Inside shadow</button>`;
  }
}
if (!customElements.get("a11y-shadow-control"))
  customElements.define("a11y-shadow-control", ShadowControl);

const slides: FluidboxSlides = {
  shop({ media: target }) {
    target.innerHTML = `
      <form class="a11y-shop" onsubmit="return false">
        <input type="hidden" name="id" value="1" />
        <button type="button" data-test="add">Add to cart</button>
        <button type="button" style="display: none">Hidden button</button>
        <button type="button" style="visibility: hidden">Invisible button</button>
        <div contenteditable="true" data-test="note" aria-label="Note">Note</div>
        <a11y-shadow-control></a11y-shadow-control>
        <div role="radiogroup" aria-label="Size">
          <span role="radio" tabindex="0" aria-checked="true" data-test="size-s">S</span>
          <span role="radio" tabindex="-1" aria-checked="false" data-test="size-m">M</span>
        </div>
        <button type="button" data-test="menu-button" aria-haspopup="menu">Options</button>
        <div role="menu" data-test="menu" aria-label="Options" hidden>
          <button type="button" role="menuitem" data-test="menu-item">Share</button>
        </div>
        <button type="button" data-test="details">Details</button>
        <dialog data-test="nested"><button type="button">Inside details</button></dialog>
        <p data-fluidbox-description data-test="description">Ships in two days.</p>
      </form>`;
    const menu = target.querySelector<HTMLElement>("[data-test=menu]")!;
    const menuButton = target.querySelector<HTMLElement>("[data-test=menu-button]")!;
    menuButton.addEventListener("click", () => {
      menu.hidden = false;
      menu.querySelector("button")!.focus();
    });
    // A menu that closes on Escape and only stops the event, as many do.
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      menu.hidden = true;
      menuButton.focus();
    });
    target.querySelector("[data-test=details]")!.addEventListener("click", () => {
      target.querySelector<HTMLDialogElement>("[data-test=nested]")!.showModal();
    });
    target.querySelector("[data-test=add]")!.addEventListener("click", () => {
      // A toast the app adds to the body while the viewer is open.
      const toast = document.createElement("div");
      toast.setAttribute("role", "status");
      toast.dataset.test = "toast";
      toast.innerHTML = `Added to cart <button type="button">Undo</button>`;
      document.body.append(toast);
    });
  },
};

const viewer = params.has("viewer")
  ? ({ target }: { target: HTMLElement }) => {
      target.insertAdjacentHTML(
        "beforeend",
        `<p class="a11y-caption" data-test="caption">Caption</p>`,
      );
    }
  : undefined;

const fluidbox: Fluidbox = createFluidbox({
  items,
  slides,
  loading: "eager",
  filmstrip: params.has("filmstrip"),
  ...(params.has("zoom")
    ? { controls: ["previous", "next", "close", "zoomIn", "zoomOut", "zoomReset"] as const }
    : {}),
  ...(viewer ? { viewer } : {}),
});

function triggers(container: HTMLElement, prefix: string) {
  for (const [index, item] of items.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.test = `${prefix}${index}`;
    button.textContent = `Open ${item.id}`;
    container.append(button);
    fluidbox.bind(button, index);
  }
}
triggers(document.querySelector("[data-test=triggers]")!, "trigger-");
triggers(document.querySelector("[data-test=quick-triggers]")!, "quick-trigger-");
const quick = document.querySelector<HTMLDialogElement>("[data-test=quick]")!;
document
  .querySelector("[data-test=quick-view]")!
  .addEventListener("click", () => quick.showModal());
document.querySelector("[data-test=quick-close]")!.addEventListener("click", () => quick.close());

Object.assign(window, { a11yFluidbox: fluidbox, a11yItems: items });
document.documentElement.dataset.fixtureReady = "";
