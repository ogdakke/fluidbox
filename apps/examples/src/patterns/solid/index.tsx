/** @jsxImportSource solid-js */
import type { Component } from "solid-js";
import { render } from "solid-js/web";
import type { MountPattern } from "../page";
import type { PatternName } from "../shared";
import { Basic } from "./basic";
import { Filmstrip } from "./filmstrip";
import { Rtl } from "./rtl";
import { Url } from "./url";
import { Headless } from "./headless";
import { Hover } from "./hover";
import { Media } from "./media";
import { Origins } from "./origins";
import { Overlay } from "./overlay";
import { Programmatic } from "./programmatic";
import { Renderers } from "./renderers";
import { Sheet } from "./sheet";
import { Zoom } from "./zoom";

const mount =
  (Pattern: Component): MountPattern =>
  (root) =>
    render(() => <Pattern />, root);

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
  hover: mount(Hover),
  media: mount(Media),
};
