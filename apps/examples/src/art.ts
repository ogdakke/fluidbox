import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { scenes, type Scene } from "@ogdakke/fluidbox-design/art-scenes";

export { scenes };
export type { Scene };

export const artSrc = (scene: Scene) => `/art/${scene.id}.svg`;

export function artItem(scene: Scene, id = scene.id): FluidboxImageItem {
  const src = artSrc(scene);
  return {
    id,
    type: "img",
    src,
    alt: scene.title,
    width: scene.width,
    height: scene.height,
  };
}

export const sceneById = (id: string) => scenes.find((scene) => scene.id === id)!;
