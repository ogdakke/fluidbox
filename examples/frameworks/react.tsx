import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Lightbox } from "@ogdakke/fluidbox/react";
import { alternateRuntimeSource, runtimeSource } from "./source";
import "./site.css";

function App() {
  const [currentSource, setCurrentSource] = useState(runtimeSource);
  return (
    <Lightbox.Root source={currentSource}>
      <main>
        <h1>React gallery</h1>
        <button type="button" onClick={() => setCurrentSource(alternateRuntimeSource)}>
          Switch source
        </button>
        <Lightbox.Item id="0">
          <Lightbox.Trigger>
            <span>Open gallery</span>
          </Lightbox.Trigger>
        </Lightbox.Item>
        <Lightbox.Portal>
          <Lightbox.Previous />
          <Lightbox.Next />
          <Lightbox.Close />
        </Lightbox.Portal>
      </main>
    </Lightbox.Root>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
