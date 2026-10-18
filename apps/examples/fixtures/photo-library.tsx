import React from "react";
import { createRoot } from "react-dom/client";
import { mountSite } from "../src/site";
import { PhotoLibrary } from "../src/demos/photo-library";

mountSite("fixtures", { fixture: "Photo library · 10,000 items in a TanStack Virtual grid" });

createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <PhotoLibrary />
  </React.StrictMode>,
);
