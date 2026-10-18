/** @jsxImportSource solid-js */
import { createSignal, For } from "solid-js";
import { render } from "solid-js/web";
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { AppGallery } from "@ogdakke/fluidbox";
import { frameworkCollections } from "../art";
import { originsWithin } from "./origins";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "app-gallery": JSX.HTMLAttributes<AppGallery>;
      "app-filmstrip": JSX.HTMLAttributes<HTMLElement>;
    }
  }
}

const collections = frameworkCollections("solid");

function SolidGallery() {
  let gallery: AppGallery | undefined;
  const [current, setCurrent] = createSignal(0);
  const collection = () => collections[current()]!;
  const bind = useFluidboxGallery(() => collection().source);
  return (
    <article class="framework-panel">
      <header class="framework-panel__head">
        <h3>Solid</h3>
        <button type="button" class="chip" onClick={() => setCurrent((index) => 1 - index)}>
          Switch source <span aria-hidden="true">→ {collections[1 - current()]!.label}</span>
        </button>
      </header>
      <app-gallery
        class="thumb-row"
        aria-label="Solid gallery"
        ref={(node) => {
          gallery = node as AppGallery;
          gallery.origins = originsWithin(() => gallery);
          bind(gallery);
        }}
      >
        <For each={collection().items}>
          {(item, index) => (
            <button
              type="button"
              class="thumb"
              data-origin-id={item.id}
              aria-label={`Open ${item.media.type === "image" ? item.media.alt : item.id}`}
              onClick={() => void gallery?.open({ index: index() })}
            >
              <img src={item.thumbnail?.src} alt="" />
            </button>
          )}
        </For>
        <app-filmstrip />
      </app-gallery>
      <code class="framework-panel__api">useFluidboxGallery(source)</code>
    </article>
  );
}

export function mount(root: HTMLElement): void {
  render(() => <SolidGallery />, root);
}
