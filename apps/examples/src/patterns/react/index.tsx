import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import { Basic } from "./basic";
import { Filmstrip } from "./filmstrip";
import { Headless } from "./headless";
import { Origins } from "./origins";
import { Overlay } from "./overlay";
import { Programmatic } from "./programmatic";
import { Renderers } from "./renderers";
import { Rtl } from "./rtl";
import { Sheet } from "./sheet";
import { Zoom } from "./zoom";

const mount =
  (Pattern: ComponentType): MountPattern =>
  (root) => {
    const reactRoot = createRoot(root);
    reactRoot.render(
      <StrictMode>
        <Pattern />
      </StrictMode>,
    );
    return () => reactRoot.unmount();
  };

export const patterns: Record<PatternName, MountPattern> = {
  basic: mount(Basic),
  overlay: mount(Overlay),
  origins: mount(Origins),
  renderers: mount(Renderers),
  programmatic: mount(Programmatic),
  zoom: mount(Zoom),
  filmstrip: mount(Filmstrip),
  sheet: mount(Sheet),
  headless: mount(Headless),
  rtl: mount(Rtl),
};
