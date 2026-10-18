import React from "react";
import { createRoot } from "react-dom/client";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { artSrc, scenes } from "../art";
import { PhotoLibrary, type LibraryImage } from "../demos/photo-library";
import { mount as mountCards } from "../demos/react";

mountChrome("react");
const cardsRoot = document.querySelector<HTMLElement>("#react-root")!;
mountCards(cardsRoot);
cardsRoot.removeAttribute("aria-busy");

const images: LibraryImage[] = scenes.map((scene) => ({
  src: artSrc(scene),
  width: scene.width,
  height: scene.height,
  shape: scene.title,
}));
createRoot(document.querySelector("#library-root")!).render(
  <React.StrictMode>
    <PhotoLibrary images={images} embedded />
  </React.StrictMode>,
);
