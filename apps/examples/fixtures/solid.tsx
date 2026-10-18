/** @jsxImportSource solid-js */
import { mountSite } from "../src/site";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./frameworks.css";

mountSite("fixtures", { fixture: "Solid binding · indexed gallery with source replacement" });

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "fluidbox-gallery": JSX.HTMLAttributes<FluidboxGalleryElement>;
    }
  }
}

function App() {
  let gallery: FluidboxGalleryElement | undefined;
  const [currentSource, setCurrentSource] = createSignal(source);
  const bind = useFluidboxGallery(currentSource);
  return (
    <main>
      <h1>Solid gallery</h1>
      <button type="button" onClick={() => setCurrentSource(alternateSource)}>
        Switch source
      </button>
      <fluidbox-gallery
        ref={(node) => {
          gallery = node as FluidboxGalleryElement;
          bind(gallery);
        }}
      >
        <button type="button" onClick={() => gallery?.open({ index: 0 })}>
          Open gallery
        </button>
      </fluidbox-gallery>
    </main>
  );
}

render(() => <App />, document.querySelector("#root")!);
