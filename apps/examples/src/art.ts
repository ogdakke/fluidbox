import { arraySource } from "@ogdakke/fluidbox";
import type { FluidboxItem, FluidboxSource } from "@ogdakke/fluidbox";
import { scenes, type Scene } from "@ogdakke/fluidbox-design/art-scenes";

export { scenes };
export type { Scene };

export const artSrc = (scene: Scene) => `/art/${scene.id}.svg`;

export function artItem(scene: Scene, id = scene.id): FluidboxItem {
  const src = artSrc(scene);
  return {
    id,
    media: { type: "image", src, alt: scene.title, width: scene.width, height: scene.height },
    thumbnail: { src, width: scene.width, height: scene.height },
  };
}

export const sceneById = (id: string) => scenes.find((scene) => scene.id === id)!;

/** Small in-memory galleries used by the Solid, Vue, and Angular panels. */
export type ArtCollection = {
  readonly label: string;
  readonly items: readonly FluidboxItem[];
  readonly source: FluidboxSource<FluidboxItem>;
};

function collection(label: string, prefix: string, ids: string[]): ArtCollection {
  const items = ids.map((id) => artItem(sceneById(id), `${prefix}-${id}`));
  return { label, items, source: arraySource(items) };
}

/** Two small collections per framework panel, so "Switch source" visibly changes the gallery. */
export function frameworkCollections(prefix: string): [ArtCollection, ArtCollection] {
  return [
    collection("Mountains", prefix, ["alpine", "fjord", "meadow"]),
    collection("Night", prefix, ["lagoon", "aurora"]),
  ];
}

/** A large indexed collection that cycles through the scenes. Hosts mount a small window of it. */
export function indexedArt(count: number) {
  const sceneAt = (index: number) => scenes[(index * 7) % scenes.length]!;
  const source: FluidboxSource<FluidboxItem> = {
    count,
    getItem(index) {
      const scene = sceneAt(index);
      const src = artSrc(scene);
      return {
        id: String(index),
        media: {
          type: "image",
          src,
          alt: `${scene.title}, item ${index + 1}`,
          width: scene.width,
          height: scene.height,
        },
        thumbnail: { src, width: scene.width, height: scene.height },
        caption: `${scene.title} · #${(index + 1).toLocaleString("en-US")}`,
      };
    },
    getIndex(id) {
      const index = Number(id);
      return Number.isInteger(index) && index >= 0 && index < count ? index : null;
    },
  };
  return { source, sceneAt, count };
}

export const windowSize = 12;

/** First index of the 12-card window that contains `index`. */
export function windowStart(index: number, count: number): number {
  return Math.max(0, Math.min(count - windowSize, index - (index % windowSize)));
}

export const formatCount = (value: number) => value.toLocaleString("en-US");
