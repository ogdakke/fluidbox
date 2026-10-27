import { mountSite } from "../src/site";
import { For, createComponent, createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms, withLamp, type RoomItem } from "./hotspot-items";

mountSite("fixtures", { fixture: "Solid hotspots · Fluidbox.Hotspot pins inside Media" });

// Written without JSX, so the page needs no Solid compile step of its own.
const plus = () => {
  const span = document.createElement("span");
  span.setAttribute("aria-hidden", "true");
  span.textContent = "+";
  return span;
};

const [parts, setParts] = createSignal(rooms[0]!.parts);
window.addLamp = () => setParts(withLamp);

const slide = ({ item }: { item: RoomItem }): JSX.Element =>
  createComponent(Fluidbox.Media, {
    get children() {
      return [
        createComponent(Fluidbox.Image, { item: item.image }),
        // An image of the page's own: the photo the viewer drew is still the one measured.
        Object.assign(document.createElement("img"), {
          className: "hotspot-badge",
          alt: "",
          src: item.thumbnail!.src,
        }),
        createComponent(For, {
          get each() {
            return parts();
          },
          children: (part: RoomItem["parts"][number]) =>
            createComponent(Fluidbox.Hotspot, {
              x: part.x,
              y: part.y,
              scaleWithZoom: part.id === "books",
              class: "hotspot-pin",
              "data-pin": part.name,
              "aria-label": part.name,
              get children() {
                return plus();
              },
            }),
        }),
      ];
    },
  });

render(
  () =>
    createComponent(Fluidbox.Root, {
      items: rooms,
      get children() {
        return [
          ...rooms.map((item) =>
            createComponent(Fluidbox.Trigger, {
              value: item.id,
              "data-item": item.id,
              get children() {
                const image = document.createElement("img");
                image.alt = "";
                image.src = item.thumbnail!.src;
                return image;
              },
            }),
          ),
          createComponent(Fluidbox.Slides, { room: slide }),
        ];
      },
    }),
  document.querySelector("#root")!,
);
