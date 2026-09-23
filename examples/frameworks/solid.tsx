/** @jsxImportSource solid-js */
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { AppGallery } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./site.css";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "app-gallery": JSX.HTMLAttributes<AppGallery>;
    }
  }
}

function App() {
  let gallery: AppGallery | undefined;
  const [currentSource, setCurrentSource] = createSignal(source);
  const bind = useFluidboxGallery(currentSource);
  return (
    <main>
      <h1>Solid gallery</h1>
      <button type="button" onClick={() => setCurrentSource(alternateSource)}>
        Switch source
      </button>
      <app-gallery
        ref={(node) => {
          gallery = node as AppGallery;
          bind(gallery);
        }}
      >
        <button type="button" onClick={() => gallery?.open(0)}>
          Open gallery
        </button>
      </app-gallery>
    </main>
  );
}

render(() => <App />, document.querySelector("#root")!);
