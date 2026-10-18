// Generates the layered landscape SVGs in public/art. Run with `bun run art`.
// Output is deterministic, so regenerating only changes files when this script changes.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scenes, type Scene } from "@ogdakke/fluidbox-design/art-scenes";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midpoint displacement keeps ridges natural without a noise dependency. */
function ridge(next: () => number, segments: number, roughness: number): number[] {
  const points = Array.from<number>({ length: segments + 1 }).fill(0);
  points[0] = next() - 0.5;
  points[segments] = next() - 0.5;
  let step = segments;
  let amplitude = 1;
  while (step > 1) {
    const half = step / 2;
    for (let index = half; index < segments; index += step) {
      points[index] =
        (points[index - half]! + points[index + half]!) / 2 + (next() - 0.5) * amplitude;
    }
    step = half;
    amplitude *= roughness;
  }
  return points;
}

const round = (value: number) => Math.round(value * 10) / 10;

function render(scene: Scene): string {
  const { width: w, height: h } = scene;
  const next = random(scene.seed);
  const horizon = scene.water ? 0.62 : 0.78;
  const parts: string[] = [];
  parts.push(
    `<defs>`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${scene.sky[0]}"/><stop offset="0.55" stop-color="${scene.sky[1]}"/><stop offset="1" stop-color="${scene.sky[2]}"/>`,
    `</linearGradient>`,
    `<radialGradient id="glow"><stop offset="0" stop-color="${scene.sun.glow}" stop-opacity="0.75"/><stop offset="1" stop-color="${scene.sun.glow}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[2]}" stop-opacity="0"/><stop offset="1" stop-color="${scene.sky[2]}" stop-opacity="0.55"/></linearGradient>`,
  );
  if (scene.water) {
    parts.push(
      `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[2]}"/><stop offset="1" stop-color="${scene.water}"/></linearGradient>`,
    );
  }
  parts.push(`</defs>`, `<rect width="${w}" height="${h}" fill="url(#sky)"/>`);

  if (scene.stars) {
    const stars: string[] = [];
    for (let index = 0; index < 160; index++) {
      const x = round(next() * w);
      const y = round(next() * h * 0.55);
      const r = round(0.6 + next() * 1.8);
      stars.push(`<circle cx="${x}" cy="${y}" r="${r}" opacity="${round(0.3 + next() * 0.7)}"/>`);
    }
    parts.push(`<g fill="#ffffff">${stars.join("")}</g>`);
    // Aurora ribbons
    for (let band = 0; band < 3; band++) {
      const y0 = h * (0.18 + band * 0.08);
      const amp = h * 0.05;
      const d = `M0 ${round(y0)} C ${round(w * 0.3)} ${round(y0 - amp * 2)}, ${round(w * 0.6)} ${round(y0 + amp * 2)}, ${w} ${round(y0 - amp)}`;
      parts.push(
        `<path d="${d}" fill="none" stroke="${scene.sun.glow}" stroke-width="${round(h * 0.035)}" stroke-linecap="round" opacity="${0.16 - band * 0.04}"/>`,
      );
    }
  }

  const sunX = scene.sun.x * w;
  const sunY = scene.sun.y * h;
  const sunR = scene.sun.r * Math.max(w, h);
  parts.push(
    `<circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR * 4)}" fill="url(#glow)"/>`,
    `<circle cx="${round(sunX)}" cy="${round(sunY)}" r="${round(sunR)}" fill="${scene.sun.color}"/>`,
  );

  const count = scene.layers.length;
  scene.layers.forEach((color, layer) => {
    const depth = layer / Math.max(1, count - 1);
    const base = h * (horizon - 0.32 + depth * 0.3);
    const amplitude = h * (0.3 - depth * 0.15);
    const points = ridge(next, 128, 0.58 + depth * 0.04);
    const step = w / (points.length - 1);
    const path = points
      .map(
        (value, index) =>
          `${index ? "L" : "M"}${round(index * step)} ${round(base + value * amplitude)}`,
      )
      .join(" ");
    const bottom = scene.water ? h * horizon : h;
    parts.push(`<path d="${path} L${w} ${round(bottom)} L0 ${round(bottom)} Z" fill="${color}"/>`);
    if (layer < count - 1) {
      parts.push(
        `<rect y="${round(base - amplitude)}" width="${w}" height="${round(bottom - base + amplitude)}" fill="url(#haze)" opacity="${round(0.5 - depth * 0.4)}"/>`,
      );
    }
  });

  if (scene.water) {
    const top = h * horizon;
    parts.push(
      `<rect y="${round(top)}" width="${w}" height="${round(h - top)}" fill="url(#water)"/>`,
    );
    // Reflection of the sun as broken shimmer lines.
    const lines: string[] = [];
    for (let index = 0; index < 28; index++) {
      const y = top + (h - top) * (index / 28) + next() * 6;
      const spread = sunR * (0.8 + index * 0.12);
      const x = sunX + (next() - 0.5) * spread * 0.6;
      const length = spread * (0.4 + next() * 0.9);
      lines.push(
        `<rect x="${round(x - length / 2)}" y="${round(y)}" width="${round(length)}" height="${round(2 + next() * 3)}" rx="2" opacity="${round(0.55 - index * 0.016)}"/>`,
      );
    }
    parts.push(`<g fill="${scene.sun.glow}">${lines.join("")}</g>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${scene.title}">${parts.join("")}</svg>\n`;
}

if (import.meta.main) {
  const directory = join(import.meta.dirname, "..", "public", "art");
  mkdirSync(directory, { recursive: true });
  for (const scene of scenes) writeFileSync(join(directory, `${scene.id}.svg`), render(scene));
  console.log(`Wrote ${scenes.length} scenes to ${directory}`);
}
