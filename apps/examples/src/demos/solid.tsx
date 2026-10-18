/** @jsxImportSource solid-js */
import { createSignal, For } from "solid-js";
import { render } from "solid-js/web";
import { useFluidboxGallery } from "@ogdakke/fluidbox/solid";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";
import {
  artSrc,
  formatCount,
  frameworkCollections,
  indexedArt,
  windowSize,
  windowStart,
} from "../art";
import { originsWithin } from "./origins";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "fluidbox-gallery": JSX.HTMLAttributes<FluidboxGalleryElement>;
      "fluidbox-filmstrip": JSX.HTMLAttributes<HTMLElement>;
    }
  }
}

const collections = frameworkCollections("solid");

function SolidGallery() {
  let gallery: FluidboxGalleryElement | undefined;
  const [current, setCurrent] = createSignal(0);
  const collection = () => collections[current()]!;
  const bind = useFluidboxGallery(() => collection().source);
  return (
    <article class="framework-panel">
      <header class="framework-panel__head">
        <h3>Solid</h3>
        <button
          type="button"
          class="fb-button fb-button--small"
          onClick={() => setCurrent((index) => 1 - index)}
        >
          Switch source <span aria-hidden="true">→ {collections[1 - current()]!.label}</span>
        </button>
      </header>
      <fluidbox-gallery
        class="thumb-row"
        aria-label="Solid gallery"
        ref={(node) => {
          gallery = node as FluidboxGalleryElement;
          gallery.origins = originsWithin(() => gallery);
          bind(gallery);
        }}
      >
        <For each={collection().items}>
          {(item, index) => (
            <button
              type="button"
              class="fb-thumb"
              data-origin-id={item.id}
              aria-label={`Open ${item.media.type === "image" ? item.media.alt : item.id}`}
              onClick={() => void gallery?.open({ index: index() })}
            >
              <img src={item.thumbnail?.src} alt="" />
            </button>
          )}
        </For>
        <fluidbox-filmstrip />
      </fluidbox-gallery>
      <code class="framework-panel__api">useFluidboxGallery(source)</code>
    </article>
  );
}

function SolidIndexed() {
  let gallery: FluidboxGalleryElement | undefined;
  const { source, sceneAt, count } = indexedArt(100_000);
  const [start, setStart] = createSignal(0);
  const [requested, setRequested] = createSignal("50000");
  const bind = useFluidboxGallery(() => source);
  const indices = () =>
    Array.from({ length: Math.min(windowSize, count - start()) }, (_, offset) => start() + offset);
  return (
    <div>
      <form
        class="jump"
        onSubmit={(event) => {
          event.preventDefault();
          const index = Math.max(0, Math.min(count - 1, Number(requested()) - 1));
          // Solid renders synchronously, so the new window is mounted before open() asks for it.
          setStart(windowStart(index, count));
          void gallery?.open({ index });
        }}
      >
        <label class="fb-label" for="solid-jump">
          Open item
        </label>
        <input
          id="solid-jump"
          class="fb-input"
          type="number"
          min="1"
          max={count}
          value={requested()}
          onInput={(event) => setRequested(event.currentTarget.value)}
        />
        <button type="submit" class="fb-button fb-button--primary">
          Open
        </button>
        <output class="jump__window">
          Showing {formatCount(start() + 1)}–{formatCount(start() + indices().length)} of{" "}
          {formatCount(count)}
        </output>
      </form>
      <fluidbox-gallery
        class="virtual-grid"
        aria-label="Solid indexed gallery"
        ref={(node) => {
          gallery = node as FluidboxGalleryElement;
          gallery.origins = originsWithin(() => gallery);
          bind(gallery);
        }}
      >
        <For each={indices()}>
          {(index) => (
            <button
              type="button"
              class="virtual-card"
              data-origin-id={String(index)}
              aria-label={`Open gallery item ${index + 1}`}
              onClick={() => void gallery?.open({ index })}
            >
              <img src={artSrc(sceneAt(index))} alt="" data-fluidbox-origin />
              <span>#{formatCount(index + 1)}</span>
            </button>
          )}
        </For>
        <fluidbox-filmstrip />
      </fluidbox-gallery>
    </div>
  );
}

export function mount(root: HTMLElement): void {
  render(() => <SolidGallery />, root);
}

export function mountIndexed(root: HTMLElement): void {
  render(() => <SolidIndexed />, root);
}
