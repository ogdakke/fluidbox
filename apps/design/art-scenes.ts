// Scene catalog shared by the artwork generator and the showcase page.
export type Scene = {
  id: string;
  title: string;
  width: number;
  height: number;
  seed: number;
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; color: string; glow: string };
  /** Ridge colors from the farthest to the nearest layer. */
  layers: string[];
  water?: string;
  stars?: boolean;
};

export const scenes: Scene[] = [
  {
    id: "dune",
    title: "Dune at golden hour",
    width: 1800,
    height: 1200,
    seed: 3,
    sky: ["#f7d9a6", "#f1a76f", "#c4675a"],
    sun: { x: 0.68, y: 0.42, r: 0.07, color: "#fff4d6", glow: "#ffd28a" },
    layers: ["#e2a074", "#cf8460", "#b5664c", "#8c4a3c", "#5e3130"],
  },
  {
    id: "fjord",
    title: "Fjord in the blue hour",
    width: 1200,
    height: 1600,
    seed: 11,
    sky: ["#16233f", "#3a5a86", "#9fb5cf"],
    sun: { x: 0.3, y: 0.24, r: 0.05, color: "#eef3ff", glow: "#a9c2ea" },
    layers: ["#6c84a6", "#4d6589", "#344a6c", "#203350"],
    water: "#1b2b45",
  },
  {
    id: "alpine",
    title: "Alpine ridge at dawn",
    width: 1920,
    height: 1080,
    seed: 7,
    sky: ["#ffd6c4", "#e8a5b5", "#7b6fa3"],
    sun: { x: 0.22, y: 0.5, r: 0.06, color: "#fff1e6", glow: "#ffc2a8" },
    layers: ["#b7a3c6", "#957fae", "#715d91", "#4f4070", "#2f2848"],
  },
  {
    id: "canyon",
    title: "Canyon walls",
    width: 1400,
    height: 1400,
    seed: 19,
    sky: ["#fbe3c0", "#f0b483", "#d8794f"],
    sun: { x: 0.5, y: 0.3, r: 0.08, color: "#fff7e6", glow: "#ffd8a0" },
    layers: ["#d98d5b", "#c06d43", "#9f5134", "#7a3a29", "#4f251d"],
  },
  {
    id: "coast",
    title: "Coastline panorama",
    width: 2400,
    height: 1000,
    seed: 23,
    sky: ["#bfe3ec", "#8cc6d6", "#4d93ad"],
    sun: { x: 0.8, y: 0.32, r: 0.05, color: "#ffffff", glow: "#e3f6fb" },
    layers: ["#7fb0bf", "#5b8fa0", "#3c6e80"],
    water: "#2c6176",
  },
  {
    id: "aurora",
    title: "Aurora over the tundra",
    width: 1100,
    height: 1650,
    seed: 31,
    sky: ["#061019", "#0f3a3f", "#3fa585"],
    sun: { x: 0.72, y: 0.16, r: 0.025, color: "#f4fff9", glow: "#87ffd0" },
    layers: ["#1f4f4c", "#163b3b", "#0f2a2c", "#081a1d"],
    stars: true,
  },
  {
    id: "meadow",
    title: "Meadow hills",
    width: 1600,
    height: 1200,
    seed: 41,
    sky: ["#e8f4d9", "#bfe0b5", "#86c09a"],
    sun: { x: 0.6, y: 0.28, r: 0.06, color: "#ffffff", glow: "#f6ffd8" },
    layers: ["#9ccc8f", "#78b472", "#58985a", "#3d7a46", "#265c34"],
  },
  {
    id: "lagoon",
    title: "Lagoon after sunset",
    width: 1800,
    height: 1200,
    seed: 53,
    sky: ["#2a1b3d", "#a2477a", "#f59a6b"],
    sun: { x: 0.45, y: 0.44, r: 0.06, color: "#ffe9c9", glow: "#ff9b6a" },
    layers: ["#7a3466", "#55244f", "#341838"],
    water: "#2c1a37",
  },
  {
    id: "ridge",
    title: "Night ridge",
    width: 1200,
    height: 1500,
    seed: 61,
    sky: ["#070b18", "#1a2448", "#4b4f86"],
    sun: { x: 0.36, y: 0.2, r: 0.045, color: "#f4f1ff", glow: "#b3b4ff" },
    layers: ["#3b3f70", "#2b2f58", "#1d2142", "#11142c"],
    stars: true,
  },
];
