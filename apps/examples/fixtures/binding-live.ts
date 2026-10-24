import { mountSite } from "../src/site";
import "../src/pages/pages.css";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import "./binding-live.css";
import type { LiveFramework, MountLive } from "./binding-live/shared";

mountSite("fixtures", {
  fixture: "Binding live options · labels and a viewer part changed while open, a frame layer",
});

const fixtures: Record<LiveFramework, () => Promise<{ mount: MountLive }>> = {
  elements: () => import("./binding-live/elements"),
  javascript: () => import("./binding-live/javascript"),
  react: () => import("./binding-live/react"),
  solid: () => import("./binding-live/solid"),
  vue: () => import("./binding-live/vue"),
  angular: () => import("./binding-live/angular"),
};

const framework = (new URLSearchParams(location.search).get("framework") ??
  "javascript") as LiveFramework;
const load = fixtures[framework];
if (!load) throw new Error(`Unknown framework "${framework}".`);
const root = document.querySelector<HTMLElement>("#live")!;
root.dataset.framework = framework;
void (async () => {
  const { mount } = await load();
  window.__live = await mount(root);
  document.documentElement.dataset.liveReady = "";
})();
