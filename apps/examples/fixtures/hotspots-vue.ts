import { mountSite } from "../src/site";
import { createApp, h, shallowRef } from "vue";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms, withLamp, type RoomItem } from "./hotspot-items";

mountSite("fixtures", { fixture: "Vue hotspots · Fluidbox.Hotspot pins inside Media" });

const parts = shallowRef(rooms[0]!.parts);
window.addLamp = () => (parts.value = withLamp(parts.value));

createApp({
  render: () =>
    h(Fluidbox.Root, { items: rooms }, () => [
      ...rooms.map((item) =>
        h(Fluidbox.Trigger, { key: item.id, value: item.id, "data-item": item.id }, () =>
          h("img", { alt: "", src: item.thumbnail!.src }),
        ),
      ),
      h(Fluidbox.Slides, null, {
        room: ({ item }: { item: RoomItem }) =>
          // A render of its own, new on every render, as an inline one is.
          h(Fluidbox.Media, { render: () => {} }, () => [
            h(Fluidbox.Image, { item: item.image }),
            ...parts.value.map((part) =>
              h(
                Fluidbox.Hotspot,
                {
                  key: part.id,
                  x: part.x,
                  y: part.y,
                  // The second as a template's bare `scale-with-zoom` passes it.
                  ...(part.id === "books" ? { scaleWithZoom: "" as unknown as boolean } : {}),
                  class: "hotspot-pin",
                  "data-pin": part.name,
                  "aria-label": part.name,
                },
                () => h("span", { "aria-hidden": "true" }, "+"),
              ),
            ),
          ]),
      }),
    ]),
}).mount("#root");
