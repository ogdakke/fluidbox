import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { createComponent, Dynamic } from "solid-js/web";
import { cspItems } from "./csp-items";

const photos = cspItems.slice(0, 2);

/**
 * A Solid Root open on its second photo, built without JSX so the server and
 * the browser run the same code: the server renders its copy, and the browser
 * hydrates it.
 */
export function CspSolid() {
  return createComponent(Fluidbox.Root, {
    items: photos,
    value: photos[1]!.id!,
    get children() {
      return photos.map((photo, index) =>
        createComponent(Fluidbox.Trigger, {
          value: index,
          get children() {
            return createComponent(Dynamic, {
              component: "img",
              src: photo.src,
              alt: photo.alt,
              width: 160,
            });
          },
        }),
      );
    },
  });
}
