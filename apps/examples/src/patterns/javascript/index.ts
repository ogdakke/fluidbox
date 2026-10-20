import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import { mountBasic } from "./basic";
import { mountFilmstrip } from "./filmstrip";
import { mountRtl } from "./rtl";
import { mountUrl } from "./url";
import { mountHeadless } from "./headless";
import { mountOrigins } from "./origins";
import { mountOverlay } from "./overlay";
import { mountProgrammatic } from "./programmatic";
import { mountRenderers } from "./renderers";
import { mountSheet } from "./sheet";
import { mountZoom } from "./zoom";

export const patterns: Record<PatternName, MountPattern> = {
  basic: mountBasic,
  overlay: mountOverlay,
  origins: mountOrigins,
  renderers: mountRenderers,
  programmatic: mountProgrammatic,
  zoom: mountZoom,
  filmstrip: mountFilmstrip,
  rtl: mountRtl,
  url: mountUrl,
  sheet: mountSheet,
  headless: mountHeadless,
};
