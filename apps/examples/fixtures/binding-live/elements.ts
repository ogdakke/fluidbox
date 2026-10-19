import "@ogdakke/fluidbox/elements";
import type { FluidboxViewerRenderer } from "@ogdakke/fluidbox";
import { album, countText, coverAlt, customViewerText, type MountLive } from "./shared";

export const mount: MountLive = async (root) => {
  const [first, ...rest] = album;
  const content = (item: (typeof album)[number]) =>
    `<template slot="content"><img src="${item.src}" alt="${item.alt}" width="${item.width}" height="${item.height}" /></template>`;
  root.innerHTML = `
    <fluidbox-gallery class="pattern-album">
      <fluidbox-item item-id="${first!.id}">
        <button slot="trigger" type="button" class="pattern-thumb" data-test="trigger">
          <img src="${first!.src}" alt="${coverAlt}" />
          <span class="pattern-overlay" data-test="count" data-fluidbox-thumbnail-overlay="travel"
            ><span class="live-layer" data-test="layer" data-fluidbox-frame-layer></span
            >${countText}</span
          >
        </button>
        ${content(first!)}
      </fluidbox-item>
      ${rest.map((item) => `<fluidbox-item item-id="${item.id}">${content(item)}</fluidbox-item>`).join("")}
      <fluidbox-filmstrip></fluidbox-filmstrip>
    </fluidbox-gallery>`;
  const gallery = root.querySelector("fluidbox-gallery")!;
  await gallery.whenReady();

  const viewer: FluidboxViewerRenderer = ({ target }) => {
    const text = document.createElement("p");
    text.className = "live-viewer";
    text.dataset.test = "custom-viewer";
    text.textContent = customViewerText;
    target.append(text);
    // The layer is yours: take out what you put in.
    return () => text.remove();
  };

  return {
    setLabels: (labels) => {
      gallery.labels = labels;
    },
    setViewer: (on) => {
      gallery.viewer = on ? viewer : undefined;
    },
  };
};
