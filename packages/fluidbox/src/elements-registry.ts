import type {
  FluidboxItem,
  FluidboxItemTypes,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** What a markup reader knows of a `<fluidbox-item>` besides its content. */
export interface FluidboxMarkupContext {
  /** The item's id, the first of its `value`. */
  readonly id: string;
  /** The content's `aria-label` or `title`, else its trigger's name, else the id. */
  readonly title: string;
  /** From the trigger's `<img>`. */
  readonly thumbnail?: FluidboxThumbnail;
  /** The item's `placeholder` attribute. */
  readonly placeholder?: string;
  /** The item's `caption` attribute. */
  readonly caption?: string;
}

/**
 * Read a `<template slot="content">` root as an item, or return null to leave
 * it to the next reader, and last to the built-in reading.
 */
export type FluidboxMarkupReader = (
  content: Element,
  context: FluidboxMarkupContext,
) => FluidboxItem | null | undefined;

interface Registry {
  readonly slides: Map<string, FluidboxSlideRenderer<any>>;
  readonly markup: Map<string, FluidboxMarkupReader>;
  readonly listeners: Set<(kind: "slide" | "markup") => void>;
}

// One registry per page, however many copies of the entries a bundler makes.
const key = Symbol.for("@ogdakke/fluidbox/elements");
const registry = (): Registry =>
  ((globalThis as { [key]?: Registry })[key] ??= {
    slides: new Map(),
    markup: new Map(),
    listeners: new Set(),
  });

const changed = (kind: "slide" | "markup") => {
  for (const listener of registry().listeners) listener(kind);
};

/**
 * Give every `<fluidbox-gallery>` on the page a slide for items of `type`. A
 * gallery's own `slides` property and its `<template data-fluidbox-slide>`
 * come first. Registering a type again replaces its slide.
 */
export function defineSlide<K extends keyof FluidboxItemTypes>(
  type: K,
  renderer: FluidboxSlideRenderer<FluidboxItemTypes[K]>,
): void;
export function defineSlide(type: string, renderer: FluidboxSlideRenderer<any>): void;
export function defineSlide(type: string, renderer: FluidboxSlideRenderer<any>) {
  registry().slides.set(type, renderer);
  changed("slide");
}

/**
 * Read `<template slot="content">` roots that match `selector` as items of
 * your own, as the add-on entries read `<model-viewer>`. Readers run in the
 * order they were registered, before the built-in reading of `<img>`,
 * `<video>` and `<iframe>`. Registering a selector again replaces its reader.
 */
export function defineMarkup(selector: string, read: FluidboxMarkupReader): void {
  registry().markup.set(selector, read);
  changed("markup");
}

/** @internal The registered slide for `type`. */
export const registeredSlide = (type: string) => registry().slides.get(type);

/** @internal The first registered reading of `content`, if any reader takes it. */
export function readMarkup(content: Element, context: FluidboxMarkupContext) {
  for (const [selector, read] of registry().markup) {
    if (!content.matches(selector)) continue;
    const item = read(content, context);
    if (item) return item;
  }
  return null;
}

/** @internal Hear of slides and readers registered from now on. */
export function onDefine(listener: (kind: "slide" | "markup") => void): () => void {
  registry().listeners.add(listener);
  return () => {
    registry().listeners.delete(listener);
  };
}
