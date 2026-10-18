import React from "react";
import { createRoot } from "react-dom/client";
import type { LightboxItem } from "@ogdakke/fluidbox";
import { Lightbox } from "@ogdakke/fluidbox/react";
import { artItem, sceneById } from "../art";

const productItems: LightboxItem[] = [
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

const mapItems: LightboxItem[] = [
  {
    id: "react-map",
    media: {
      type: "iframe",
      src: "/map-panel.html",
      title: "Interactive map of the sample store area",
      width: 1000,
      height: 700,
    },
  },
];

const albumItems = ["dune", "canyon", "coast", "meadow"].map((id) =>
  artItem(sceneById(id), `react-album-${id}`),
);
const previewItems = ["aurora", "ridge", "fjord", "lagoon", "alpine"].map((id) =>
  artItem(sceneById(id), `react-preview-${id}`),
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
    <Lightbox.Root items={productItems}>
      <Card title="Image inside a card" note="Only the photo flies. Price and badge stay put.">
        <Lightbox.Trigger item={productItems[0]} asChild>
          <button type="button" className="product" aria-label="View the Coral Runner shoe">
            <span className="product__image" data-lightbox-origin>
              <img src="/runner.svg" alt="" width="1000" height="700" />
            </span>
            <span className="product__badge">New color</span>
            <span className="product__details">
              <span>
                <strong>Coral Runner</strong>
                <small>Everyday running shoe</small>
              </span>
              <span className="product__price">$124</span>
            </span>
          </button>
        </Lightbox.Trigger>
      </Card>
      <ViewerControls />
    </Lightbox.Root>
  );
}

function MapCard() {
  return (
    <Lightbox.Root items={mapItems}>
      <Card title="Preview to live iframe" note="A static picture opens an interactive page.">
        <Lightbox.Trigger item={mapItems[0]} asChild>
          <button type="button" className="map" aria-label="Open the store map">
            <span className="map__preview" data-lightbox-origin>
              <img src="/map-preview.svg" alt="" width="1000" height="700" />
            </span>
            <span className="map__pill">Open map ↗</span>
          </button>
        </Lightbox.Trigger>
      </Card>
      <ViewerControls />
    </Lightbox.Root>
  );
}

function AlbumCard() {
  return (
    <Lightbox.Root items={albumItems}>
      <Card title="Text as the origin" note="No image at all. Every slide closes back to the card.">
        <Lightbox.Trigger items={albumItems} item={albumItems[0]} asChild>
          <button type="button" className="album">
            <span className="album__count">{String(albumItems.length).padStart(2, "0")}</span>
            <span className="album__title">Open the collection</span>
            <span className="album__hint">Warm landscapes · browse all ↗</span>
          </button>
        </Lightbox.Trigger>
      </Card>
      <ViewerControls filmstrip />
    </Lightbox.Root>
  );
}

function PreviewCard() {
  return (
    <Lightbox.Root items={previewItems}>
      <Card
        title="One preview, many slides"
        note="The cover follows the slide you're on, and the count fades as it opens."
      >
        <Lightbox.Trigger items={previewItems} item={previewItems[0]} asChild>
          {({ item }) => (
            <button type="button" className="cover" aria-label="Open the preview gallery">
              <span className="cover__preview" data-lightbox-origin>
                <img src={item?.thumbnail?.src} alt="" />
                <Lightbox.ThumbnailOverlay className="cover__count">
                  +{previewItems.length - 1}
                </Lightbox.ThumbnailOverlay>
              </span>
            </button>
          )}
        </Lightbox.Trigger>
      </Card>
      <ViewerControls filmstrip />
    </Lightbox.Root>
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
