import { arraySource } from "@ogdakke/fluidbox";
import type { LightboxItem, LightboxSource } from "@ogdakke/fluidbox";
import { scenes, type Scene } from "./art-scenes";

export { scenes };
export type { Scene };

export const artSrc = (scene: Scene) => `/art/${scene.id}.svg`;

export function artItem(scene: Scene, id = scene.id): LightboxItem {
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
  readonly items: readonly LightboxItem[];
  readonly source: LightboxSource<LightboxItem>;
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
