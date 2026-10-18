import { mountSite } from "../src/site";
import { createApp, h, shallowRef } from "vue";
import { FluidboxGallery } from "@ogdakke/fluidbox/vue";
import type { FluidboxGalleryElement } from "@ogdakke/fluidbox";
import { alternateSource, source } from "./source";
import "./frameworks.css";

mountSite("fixtures", { fixture: "Vue binding · indexed gallery with source replacement" });

createApp({
  setup() {
    const currentSource = shallowRef(source);
    return () =>
      h("main", [
        h("h1", "Vue gallery"),
        h(
          "button",
          { type: "button", onClick: () => (currentSource.value = alternateSource) },
          "Switch source",
        ),
        h(FluidboxGallery, { source: currentSource.value }, () =>
          h(
            "button",
            {
              type: "button",
              onClick: () =>
                document
                  .querySelector<FluidboxGalleryElement>("fluidbox-gallery")
                  ?.open({ index: 0 }),
            },
            "Open gallery",
          ),
        ),
      ]);
  },
}).mount("#root");
