import "@ogdakke/fluidbox/elements";
import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import basic from "./basic.html?raw";
import filmstripMarkup from "./filmstrip.html?raw";
import { filmstrip } from "./filmstrip";
import headlessMarkup from "./headless.html?raw";
import { headless } from "./headless";
import hoverMarkup from "./hover.html?raw";
import { hover } from "./hover";
import mediaMarkup from "./media.html?raw";
import { media } from "./media";
import origins from "./origins.html?raw";
import overlayMarkup from "./overlay.html?raw";
import { overlay } from "./overlay";
import programmaticMarkup from "./programmatic.html?raw";
import { programmatic } from "./programmatic";
import renderersMarkup from "./renderers.html?raw";
import rtlMarkup from "./rtl.html?raw";
import { rtl } from "./rtl";
import { renderers } from "./renderers";
import sheetMarkup from "./sheet.html?raw";
import { sheet } from "./sheet";
import urlMarkup from "./url.html?raw";
import { url } from "./url";
import zoomMarkup from "./zoom.html?raw";
import { zoom } from "./zoom";

const mount =
  (markup: string, setup?: (root: HTMLElement) => void | (() => void)): MountPattern =>
  (root) => {
    root.innerHTML = markup;
    const cleanup = setup?.(root);
    return () => {
      cleanup?.();
      // Removing the galleries tears their viewers down.
      root.replaceChildren();
    };
  };

export const patterns: Record<PatternName, MountPattern> = {
  basic: mount(basic),
  overlay: mount(overlayMarkup, overlay),
  origins: mount(origins),
  renderers: mount(renderersMarkup, renderers),
  programmatic: mount(programmaticMarkup, programmatic),
  zoom: mount(zoomMarkup, zoom),
  filmstrip: mount(filmstripMarkup, filmstrip),
  sheet: mount(sheetMarkup, sheet),
  headless: mount(headlessMarkup, headless),
  rtl: mount(rtlMarkup, rtl),
  url: mount(urlMarkup, url),
  hover: mount(hoverMarkup, hover),
  media: mount(mediaMarkup, media),
};
