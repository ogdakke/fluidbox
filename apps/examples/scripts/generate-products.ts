// Builds the shop fixture's product photos in public/products from one of the art scenes:
// the print on its own, in a room, a detail, on canvas and in three frames.
// Each is drawn as SVG, then saved as a 1600px WebP, as product photos are raster, with a
// 160px thumbnail and a ThumbHash of it in fixtures/shop-photos.json for the placeholders.
// Run with `bun run scripts/generate-products.ts` after `bun run art`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";

export const size = 1600;
export const scene = "fjord";
const art = readFileSync(join(import.meta.dirname, "..", "public", "art", `${scene}.svg`), "utf8");
const [, artWidth, artHeight] = art.match(/viewBox="0 0 (\d+) (\d+)"/)!.map(Number);
// The scene's own markup, without its root element, to nest at any size.
const artBody = art.slice(art.indexOf(">") + 1, art.lastIndexOf("</svg>"));

/** The artwork in a box; `view` crops it. */
export function artwork(x: number, y: number, width: number, height: number, view?: string) {
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${view ?? `0 0 ${artWidth} ${artHeight}`}" preserveAspectRatio="xMidYMid slice">${artBody}</svg>`;
}

export const defs = `<defs>
<radialGradient id="p-studio" cx="0.5" cy="0.38" r="0.75"><stop offset="0" stop-color="#f7f6f3"/><stop offset="1" stop-color="#e4e2dd"/></radialGradient>
<filter id="p-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#1d1a16" flood-opacity="0.26"/></filter>
<filter id="p-contact" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1d1a16" flood-opacity="0.35"/></filter>
<linearGradient id="p-curl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e9e8e4"/><stop offset="1" stop-color="#c9c7c1"/></linearGradient>
<linearGradient id="p-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8b88c"/><stop offset="0.5" stop-color="#c49a68"/><stop offset="1" stop-color="#a97e4f"/></linearGradient>
<linearGradient id="p-black" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a2d"/><stop offset="1" stop-color="#121213"/></linearGradient>
<linearGradient id="p-white" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6e5e1"/></linearGradient>
<linearGradient id="p-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#18263d"/><stop offset="1" stop-color="#0c1422"/></linearGradient>
<linearGradient id="p-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece7df"/><stop offset="1" stop-color="#ddd5c9"/></linearGradient>
<linearGradient id="p-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b99c7b"/><stop offset="1" stop-color="#9c7f5f"/></linearGradient>
</defs>`;

const page = (body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">${defs}${body}</svg>\n`;

const studio = `<rect width="${size}" height="${size}" fill="url(#p-studio)"/>`;

// A 3:4 print centred in the square.
const print = { x: 380, y: 230, width: 840, height: 1120 };

/** Wood grain: thin lines along each side of a frame. */
export function grain(x: number, y: number, width: number, height: number, band: number) {
  const lines: string[] = [];
  for (let index = 1; index < 6; index++) {
    const inset = (band / 6) * index;
    lines.push(
      `<rect x="${x + inset}" y="${y + inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="#8a6640" stroke-opacity="${0.08 + (index % 2) * 0.06}" stroke-width="2"/>`,
    );
  }
  return lines.join("");
}

function framed(fill: string, band: number, edge: string, extra = "") {
  const { x, y, width, height } = print;
  const outer = { x: x - band, y: y - band, width: width + band * 2, height: height + band * 2 };
  return `${studio}<g filter="url(#p-shadow)"><rect x="${outer.x}" y="${outer.y}" width="${outer.width}" height="${outer.height}" fill="${fill}"/></g>${extra}
<rect x="${outer.x + 1}" y="${outer.y + 1}" width="${outer.width - 2}" height="${outer.height - 2}" fill="none" stroke="${edge}" stroke-width="2"/>
${artwork(x, y, width, height)}
<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="4"/>`;
}

const shots: Record<string, [label: string, body: string]> = {
  print: [
    "The art print, unframed, with a curled corner",
    (() => {
      const { x, y, width, height } = print;
      const right = x + width;
      const bottom = y + height;
      const curl = 150;
      return `${studio}<g filter="url(#p-shadow)"><path d="M${x} ${y}H${right}V${bottom - curl}L${right - curl} ${bottom}H${x}Z" fill="#fbfbf9"/></g>
<svg x="${x + 34}" y="${y + 34}" width="${width - 68}" height="${height - 68}" viewBox="0 0 ${artWidth} ${artHeight}" preserveAspectRatio="xMidYMid slice"><defs><clipPath id="p-corner"><path d="M0 0H${artWidth}V${artHeight - 130}L${artWidth - 130} ${artHeight}H0Z"/></clipPath></defs><g clip-path="url(#p-corner)">${artBody}</g></svg>
<g filter="url(#p-contact)"><path d="M${right} ${bottom - curl}L${right - curl} ${bottom}Q${right - curl * 0.7} ${bottom - curl * 0.55} ${right - curl * 0.18} ${bottom - curl * 0.95}Z" fill="url(#p-curl)"/></g>`;
    })(),
  ],
  room: [
    "The wood-framed print above a sideboard",
    (() => {
      const frame = { x: 545, y: 210, width: 510, height: 680 };
      const band = 30;
      const sideboard = `<rect x="330" y="1030" width="940" height="200" fill="#5e4a3a"/><rect x="330" y="1030" width="940" height="14" fill="#4a392c"/>
<rect x="345" y="1060" width="450" height="150" fill="none" stroke="#4a392c" stroke-width="3"/><rect x="805" y="1060" width="450" height="150" fill="none" stroke="#4a392c" stroke-width="3"/>
<rect x="360" y="1230" width="16" height="70" fill="#3d2f24"/><rect x="1224" y="1230" width="16" height="70" fill="#3d2f24"/>`;
      const vase = `<path d="M1070 1030c-26-40-22-92 6-122h48c28 30 32 82 6 122z" fill="#cfc6b8"/>
<path d="M1100 910c-10-90 18-150 60-190M1100 910c6-70-30-130-70-160M1100 910c22-60 70-90 110-96" fill="none" stroke="#5f7356" stroke-width="7" stroke-linecap="round"/>
<ellipse cx="1160" cy="716" rx="26" ry="12" fill="#6d8463" transform="rotate(-40 1160 716)"/><ellipse cx="1030" cy="748" rx="26" ry="12" fill="#6d8463" transform="rotate(35 1030 748)"/><ellipse cx="1210" cy="814" rx="24" ry="11" fill="#6d8463" transform="rotate(-8 1210 814)"/>`;
      const books = `<rect x="430" y="968" width="200" height="22" fill="#2f3f55"/><rect x="442" y="946" width="180" height="22" fill="#b4573a"/><rect x="436" y="990" width="196" height="40" fill="#d9cfbf"/>`;
      return `<rect width="${size}" height="1300" fill="url(#p-wall)"/><rect y="1300" width="${size}" height="300" fill="url(#p-floor)"/>
<g stroke="#8a6e51" stroke-opacity="0.35" stroke-width="2">${[1350, 1410, 1480, 1560].map((y) => `<line x1="0" y1="${y}" x2="${size}" y2="${y}"/>`).join("")}</g>
<rect y="1290" width="${size}" height="14" fill="#f4f0ea"/>
<g filter="url(#p-shadow)"><rect x="${frame.x - band}" y="${frame.y - band}" width="${frame.width + band * 2}" height="${frame.height + band * 2}" fill="url(#p-wood)"/></g>
${grain(frame.x - band, frame.y - band, frame.width + band * 2, frame.height + band * 2, band)}
${artwork(frame.x, frame.y, frame.width, frame.height)}
<rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="3"/>
<g filter="url(#p-shadow)">${sideboard}</g>${books}${vase}`;
    })(),
  ],
  detail: [
    "A detail of the print: the low sun over the water",
    `${artwork(0, 0, size, size, "120 260 720 720")}<rect width="${size}" height="${size}" fill="none" stroke="#000" stroke-opacity="0.06" stroke-width="40"/>`,
  ],
  canvas: [
    "The print on gallery canvas, showing its wrapped edge",
    (() => {
      const { x, y, width, height } = print;
      const depth = 46;
      return `${studio}<g filter="url(#p-shadow)"><path d="M${x} ${y}H${x + width}L${x + width + depth} ${y + depth * 0.6}V${y + height + depth * 0.4}L${x + width} ${y + height}H${x}Z" fill="#203048"/></g>
<path d="M${x + width} ${y}L${x + width + depth} ${y + depth * 0.6}V${y + height + depth * 0.4}L${x + width} ${y + height}Z" fill="url(#p-edge)"/>
${artwork(x, y, width, height)}
<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" fill-opacity="0.04"/>`;
    })(),
  ],
  black: ["The print in a black frame", framed("url(#p-black)", 40, "#000")],
  wood: [
    "The print in a wood frame",
    framed(
      "url(#p-wood)",
      44,
      "#8a6640",
      grain(print.x - 44, print.y - 44, print.width + 88, print.height + 88, 44),
    ),
  ],
  white: ["The print in a white frame", framed("url(#p-white)", 44, "#cfcdc7")],
};

if (import.meta.main) {
  const directory = join(import.meta.dirname, "..", "public", "products");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const [name, [label, body]] of Object.entries(shots)) {
    const svg = sharp(Buffer.from(page(body, label)));
    const base = join(directory, `${scene}-${name}`);
    await svg.clone().webp({ quality: 84 }).toFile(`${base}.webp`);
    await svg.clone().resize(160).webp({ quality: 80 }).toFile(`${base}-thumb.webp`);
    // ThumbHash takes at most 100px a side.
    const { data, info } = await svg
      .clone()
      .resize(100, 100)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    hashes[name] = Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");
  }
  writeFileSync(
    join(import.meta.dirname, "..", "fixtures", "shop-photos.json"),
    `${JSON.stringify(hashes, null, 2)}\n`,
  );
  console.log(`Wrote ${Object.keys(shots).length} product photos to ${directory}`);
}
