import { mountSite } from "../src/site";
import { createComponent, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms, type RoomItem } from "./hotspot-items";

mountSite("fixtures", { fixture: "Solid hotspots · Fluidbox.Hotspot pins inside Media" });

// Written without JSX, so the page needs no Solid compile step of its own.
const plus = () => {
  const span = document.createElement("span");
  span.setAttribute("aria-hidden", "true");
  span.textContent = "+";
  return span;
};

const slide = ({ item }: { item: RoomItem }): JSX.Element =>
  createComponent(Fluidbox.Media, {
    get children() {
      return [
        createComponent(Fluidbox.Image, { item: item.image }),
        ...item.parts.map((part, index) =>
          createComponent(Fluidbox.Hotspot, {
            x: part.x,
            y: part.y,
            scaleWithZoom: index > 0,
            class: "hotspot-pin",
            "data-pin": part.name,
            "aria-label": part.name,
            get children() {
              return plus();
            },
          }),
        ),
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
