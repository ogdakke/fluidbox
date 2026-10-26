import { mountSite } from "../src/site";
import { createApp, h } from "vue";
import { Fluidbox } from "@ogdakke/fluidbox/vue";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms, type RoomItem } from "./hotspot-items";

mountSite("fixtures", { fixture: "Vue hotspots · Fluidbox.Hotspot pins inside Media" });

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
          h(Fluidbox.Media, null, () => [
            h(Fluidbox.Image, { item: item.image }),
            ...item.parts.map((part, index) =>
              h(
                Fluidbox.Hotspot,
                {
                  key: part.id,
                  x: part.x,
                  y: part.y,
                  // The second as a template's bare `scale-with-zoom` passes it.
                  ...(index ? { scaleWithZoom: "" as unknown as boolean } : {}),
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
