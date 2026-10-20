import { createApp, type Component } from "vue";
import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import Basic from "./Basic.vue";
import Filmstrip from "./Filmstrip.vue";
import Headless from "./Headless.vue";
import Origins from "./Origins.vue";
import Overlay from "./Overlay.vue";
import Programmatic from "./Programmatic.vue";
import Renderers from "./Renderers.vue";
import Rtl from "./Rtl.vue";
import Url from "./Url.vue";
import Sheet from "./Sheet.vue";
import Zoom from "./Zoom.vue";

const mount =
  (component: Component): MountPattern =>
  (root) => {
    const app = createApp(component);
    app.mount(root);
    return () => app.unmount();
  };

export const patterns: Record<PatternName, MountPattern> = {
  basic: mount(Basic),
  overlay: mount(Overlay),
  origins: mount(Origins),
  renderers: mount(Renderers),
  programmatic: mount(Programmatic),
  zoom: mount(Zoom),
  filmstrip: mount(Filmstrip),
  rtl: mount(Rtl),
  url: mount(Url),
  sheet: mount(Sheet),
  headless: mount(Headless),
};
