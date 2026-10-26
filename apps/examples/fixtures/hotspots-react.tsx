import { mountSite } from "../src/site";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms } from "./hotspot-items";

mountSite("fixtures", { fixture: "React hotspots · Fluidbox.Hotspot pins inside Media" });

function App() {
  return (
    <Fluidbox.Root items={rooms}>
      {rooms.map((item) => (
        <Fluidbox.Trigger key={item.id} value={item.id} data-item={item.id}>
          <img alt="" src={item.thumbnail!.src} />
        </Fluidbox.Trigger>
      ))}
      <Fluidbox.Slides
        room={({ item }) => (
          <Fluidbox.Media>
            <Fluidbox.Image item={item.image} />
            {item.parts.map((part, index) => (
              <Fluidbox.Hotspot
                key={part.id}
                x={part.x}
                y={part.y}
                scaleWithZoom={index > 0}
                className="hotspot-pin"
                data-pin={part.name}
                aria-label={part.name}
              >
                <span aria-hidden="true">+</span>
              </Fluidbox.Hotspot>
            ))}
          </Fluidbox.Media>
        )}
      />
    </Fluidbox.Root>
  );
}

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
