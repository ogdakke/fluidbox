import "@angular/compiler";
import { provideZonelessChangeDetection, reflectComponentType, type Type } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import { Basic } from "./basic";
import { Filmstrip } from "./filmstrip";
import { Rtl } from "./rtl";
import { Url } from "./url";
import { Headless } from "./headless";
import { Origins } from "./origins";
import { Overlay } from "./overlay";
import { Programmatic } from "./programmatic";
import { Renderers } from "./renderers";
import { Sheet } from "./sheet";
import { Zoom } from "./zoom";

/** Bootstrap a standalone component into a host element made inside the pattern root. */
const mount =
  (component: Type<unknown>): MountPattern =>
  (root) => {
    const host = document.createElement(reflectComponentType(component)!.selector);
    root.append(host);
    const app = bootstrapApplication(component, {
      providers: [provideZonelessChangeDetection()],
    });
    return () => void app.then((ref) => ref.destroy());
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
