import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { LightboxItem } from "@ogdakke/fluidbox";
import { Lightbox } from "@ogdakke/fluidbox/react";
import { alternateRuntimeSource, runtimeSource } from "./source";
import "./react-examples.css";

const productItems: LightboxItem[] = [
  {
    id: "runner",
    media: {
      type: "image",
      src: "/runner.svg",
      alt: "Illustrated coral running shoe",
      width: 1000,
      height: 700,
    },
    thumbnail: { src: "/runner.svg", width: 1000, height: 700 },
  },
];

const mapItems: LightboxItem[] = [
  {
    id: "store-map",
    media: {
      type: "iframe",
      src: "/map-panel.html",
      title: "Interactive map of the sample store area",
      width: 1000,
      height: 700,
    },
  },
];

const albumItems: LightboxItem[] = ["/first.svg", "/second.svg", "/first.svg", "/second.svg"].map(
  (src, index) => ({
    id: `album-${index + 1}`,
    media: {
      type: "image",
      src,
      alt: `Album image ${index + 1}`,
      width: 600,
      height: 400,
    },
    thumbnail: { src, width: 600, height: 400 },
  }),
);

function ViewerControls({ filmstrip = false }: { filmstrip?: boolean }) {
  return (
    <Lightbox.Portal>
      <Lightbox.Previous />
      <Lightbox.Next />
      <Lightbox.Close />
      {filmstrip && <Lightbox.Filmstrip />}
    </Lightbox.Portal>
  );
}

function IndexedSource() {
  const [currentSource, setCurrentSource] = useState(runtimeSource);
  return (
    <Lightbox.Root source={currentSource}>
      <section className="example" aria-labelledby="indexed-title">
        <div className="example__heading">
          <div>
            <p className="eyebrow">Indexed source</p>
            <h2 id="indexed-title">One opener, changing slides</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setCurrentSource(alternateRuntimeSource)}
          >
            Switch source
          </button>
        </div>
        <Lightbox.Item id="0">
          <Lightbox.Trigger>
            <span>Open gallery</span>
          </Lightbox.Trigger>
        </Lightbox.Item>
        <ViewerControls />
      </section>
    </Lightbox.Root>
  );
}

function ProductCard() {
  return (
    <Lightbox.Root items={productItems}>
      <section className="example" aria-labelledby="product-title">
        <div className="example__heading">
          <div>
            <p className="eyebrow">Product card</p>
            <h2 id="product-title">An image inside a richer origin</h2>
          </div>
          <p>The product image opens the viewer. The details stay on the card.</p>
        </div>
        <Lightbox.Trigger item={productItems[0]} asChild>
          <button type="button" className="product-card" aria-label="View the Coral Runner shoe">
            <span className="product-card__image" data-lightbox-origin>
              <img src="/runner.svg" alt="" width="1000" height="700" />
            </span>
            <span className="product-card__details">
              <span>
                <strong>Coral Runner</strong>
                <small>Everyday running shoe</small>
              </span>
              <span className="product-card__price">$124</span>
            </span>
            <span className="product-card__badge">New color</span>
          </button>
        </Lightbox.Trigger>
        <ViewerControls />
      </section>
    </Lightbox.Root>
  );
}

function MapCard() {
  return (
    <Lightbox.Root items={mapItems}>
      <section className="example" aria-labelledby="map-title">
        <div className="example__heading">
          <div>
            <p className="eyebrow">Map preview</p>
            <h2 id="map-title">A static card opens a live iframe</h2>
          </div>
          <p>The preview and the interactive map are different elements.</p>
        </div>
        <Lightbox.Trigger item={mapItems[0]} asChild>
          <button type="button" className="map-card" aria-label="Open the store map">
            <span className="map-card__preview" data-lightbox-origin>
              <img src="/map-preview.svg" alt="" width="1000" height="700" />
            </span>
            <span className="map-card__caption">
              <strong>Find the studio</strong>
              <small>Open the interactive map</small>
            </span>
          </button>
        </Lightbox.Trigger>
        <ViewerControls />
      </section>
    </Lightbox.Root>
  );
}

function AlbumCard() {
  return (
    <Lightbox.Root items={albumItems}>
      <section className="example" aria-labelledby="album-title">
        <div className="example__heading">
          <div>
            <p className="eyebrow">Album opener</p>
            <h2 id="album-title">One text card, four slides</h2>
          </div>
          <p>The text card is the close target even after you move to another slide.</p>
        </div>
        <Lightbox.Trigger items={albumItems} item={albumItems[0]} asChild>
          <button type="button" className="album-card">
            <span className="album-card__count">04</span>
            <span className="album-card__title">Open the collection</span>
            <span className="album-card__hint">Browse all images ↗</span>
          </button>
        </Lightbox.Trigger>
        <ViewerControls filmstrip />
      </section>
    </Lightbox.Root>
  );
}

function GalleryCard() {
  return (
    <Lightbox.Root items={albumItems}>
      <section className="example" aria-labelledby="gallery-card-title">
        <div className="example__heading">
          <div>
            <p className="eyebrow">Shared gallery origin</p>
            <h2 id="gallery-card-title">One preview for every slide</h2>
          </div>
          <p>The card follows the selected slide and is the close target for all four.</p>
        </div>
        <Lightbox.Trigger items={albumItems} item={albumItems[0]} asChild>
          {({ item }) => (
            <button type="button" className="gallery-card" aria-label="Open the preview gallery">
              <span className="gallery-card__preview" data-lightbox-origin>
                <img src={item?.media.type === "image" ? item.media.src : ""} alt="" />
                <Lightbox.ThumbnailOverlay className="gallery-card__count">
                  +3
                </Lightbox.ThumbnailOverlay>
              </span>
              <span className="gallery-card__caption">Browse the collection</span>
            </button>
          )}
        </Lightbox.Trigger>
        <ViewerControls filmstrip />
      </section>
    </Lightbox.Root>
  );
}

function App() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">React examples</p>
        <h1>React gallery</h1>
        <p>
          A button, product image, map preview, text card, and shared gallery preview can open the
          viewer.
        </p>
      </header>
      <div className="examples">
        <IndexedSource />
        <ProductCard />
        <MapCard />
        <AlbumCard />
        <GalleryCard />
      </div>
    </main>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
