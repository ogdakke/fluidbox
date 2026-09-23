import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FluidboxGallery } from "@ogdakke/fluidbox/react";
import type { AppGallery } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./site.css";

function App() {
  const gallery = useRef<AppGallery | null>(null);
  const [currentSource, setCurrentSource] = useState(source);
  return (
    <main>
      <h1>React gallery</h1>
      <button type="button" onClick={() => setCurrentSource(alternateSource)}>
        Switch source
      </button>
      <FluidboxGallery source={currentSource} ref={gallery}>
        <button type="button" onClick={() => gallery.current?.open(0)}>
          Open gallery
        </button>
      </FluidboxGallery>
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
