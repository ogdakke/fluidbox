// Builds public/map/preview.svg from OpenStreetMap tiles so the static card matches the live embed.
// Run once with `bun run scripts/fetch-map.ts`; respects the OSM tile policy (a handful of tiles, cached in git).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mapView } from "../src/map-view";

const { lat, lon, zoom, width, height } = mapView;
const size = 256;
const scale = size * 2 ** zoom;
const cx = ((lon + 180) / 360) * scale;
const latRad = (lat * Math.PI) / 180;
const cy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
const left = cx - width / 2;
const top = cy - height / 2;

const images: string[] = [];
for (let tx = Math.floor(left / size); tx <= Math.floor((left + width) / size); tx++) {
  for (let ty = Math.floor(top / size); ty <= Math.floor((top + height) / size); ty++) {
    const response = await fetch(`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`, {
      headers: { "User-Agent": "fluidbox-examples/0.1 (static demo preview)" },
    });
    if (!response.ok) throw new Error(`Tile ${tx}/${ty}: ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    images.push(
      `<image x="${Math.round(tx * size - left)}" y="${Math.round(ty * size - top)}" width="${size}" height="${size}" href="data:image/png;base64,${data}"/>`,
    );
  }
}

const directory = join(import.meta.dirname, "..", "public", "map");
mkdirSync(directory, { recursive: true });
writeFileSync(
  join(directory, "preview.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${images.join("")}</svg>\n`,
);
console.log(`Wrote ${images.length} tiles`);
