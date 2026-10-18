import React from "react";
import { createRoot } from "react-dom/client";
import type { FluidboxItem } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { artItem, sceneById } from "../art";
import { mapEmbedUrl, mapView } from "../map-view";

const productItems: FluidboxItem[] = [
  {
    id: "react-runner",
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

const mapItems: FluidboxItem[] = [
  {
    id: "react-map",
    media: {
      type: "iframe",
      src: mapEmbedUrl(),
      title: mapView.title,
      width: mapView.width,
      height: mapView.height,
    },
    thumbnail: { src: "/map/preview.svg", width: mapView.width, height: mapView.height },
  },
];

const albumItems = ["dune", "canyon", "coast", "meadow"].map((id) =>
  artItem(sceneById(id), `react-album-${id}`),
);
const previewItems = ["aurora", "ridge", "fjord", "lagoon", "alpine"].map((id) =>
  artItem(sceneById(id), `react-preview-${id}`),
);

function ViewerControls({ gallery = false }: { gallery?: boolean }) {
  return (
    <Fluidbox.Portal>
      {gallery && <Fluidbox.Previous />}
      {gallery && <Fluidbox.Next />}
      <Fluidbox.Close />
      {gallery && <Fluidbox.Filmstrip />}
    </Fluidbox.Portal>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <article className="react-card">
      {children}
      <div className="react-card__text">
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
    </article>
  );
}

function ProductCard() {
  return (
    <Fluidbox.Root items={productItems}>
      <Card
        title="Image inside a card"
        note="Only the photo flies. The badge rides along on the transition layer."
      >
        <Fluidbox.Trigger item={productItems[0]} asChild>
          <button type="button" className="product" aria-label="View the Coral Runner shoe">
            <span className="product__image" data-fluidbox-origin>
              <img src="/runner.svg" alt="" width="1000" height="700" />
              <Fluidbox.ThumbnailOverlay behavior="travel" className="product__layer">
                <span className="product__badge">New color</span>
              </Fluidbox.ThumbnailOverlay>
            </span>
            <span className="product__details">
              <span>
                <strong>Coral Runner</strong>
                <small>Everyday running shoe</small>
              </span>
              <span className="product__price">$124</span>
            </span>
          </button>
        </Fluidbox.Trigger>
      </Card>
      <ViewerControls />
    </Fluidbox.Root>
  );
}

function MapCard() {
  return (
    <Fluidbox.Root items={mapItems}>
      <Card
        title="Preview to live iframe"
        note="A static tile snapshot opens the real OpenStreetMap embed."
      >
        <Fluidbox.Trigger item={mapItems[0]} asChild>
          <button type="button" className="map" aria-label="Open the store map">
            <span className="map__preview" data-fluidbox-origin>
              <img src="/map/preview.svg" alt="" width="1000" height="700" />
              <span className="map__pin" aria-hidden="true" />
            </span>
            <span className="map__pill">Open map ↗</span>
            <span className="map__credit">© OpenStreetMap contributors</span>
          </button>
        </Fluidbox.Trigger>
      </Card>
      <ViewerControls />
    </Fluidbox.Root>
  );
}

function AlbumCard() {
  return (
    <Fluidbox.Root items={albumItems}>
      <Card title="Text as the origin" note="No image at all. Every slide closes back to the card.">
        <Fluidbox.Trigger items={albumItems} item={albumItems[0]} asChild>
          <button type="button" className="album">
            <span className="album__count">{String(albumItems.length).padStart(2, "0")}</span>
            <span className="album__title">Open the collection</span>
            <span className="album__hint">Warm landscapes · browse all ↗</span>
          </button>
        </Fluidbox.Trigger>
      </Card>
      <ViewerControls gallery />
    </Fluidbox.Root>
  );
}

function PreviewCard() {
  return (
    <Fluidbox.Root items={previewItems}>
      <Card
        title="One preview, many slides"
        note="The cover follows the slide you're on, and the count fades as it opens."
      >
        <Fluidbox.Trigger items={previewItems} item={previewItems[0]} asChild>
          {({ item }) => (
            <button type="button" className="cover" aria-label="Open the preview gallery">
              <span className="cover__preview" data-fluidbox-origin>
                <img src={item?.thumbnail?.src} alt="" />
                <Fluidbox.ThumbnailOverlay className="cover__count">
                  +{previewItems.length - 1}
                </Fluidbox.ThumbnailOverlay>
              </span>
            </button>
          )}
        </Fluidbox.Trigger>
      </Card>
      <ViewerControls gallery />
    </Fluidbox.Root>
  );
}

export function mount(root: HTMLElement): void {
  createRoot(root).render(
    <React.StrictMode>
      <ProductCard />
      <MapCard />
      <AlbumCard />
      <PreviewCard />
    </React.StrictMode>,
  );
}
