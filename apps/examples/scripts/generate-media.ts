// Builds the shop fixture's rich media in public/products from the wood-framed print:
// a 36-frame 360° spin of it turning on a stand, a GLB model of it for <model-viewer>, the
// model's poster, each with a 160px thumbnail.
// Run with `bun run scripts/generate-media.ts` after `bun run scripts/generate-products.ts`.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { artwork, defs, grain, scene } from "./generate-products";

const side = 800;
const frames = 36;
// The framed print, in the spin's 800px square: 3:4 with a 22px wood band, 30px deep.
const print = { width: 360, height: 480 };
const band = 22;
const depth = 30;

const studio = `<rect width="${side}" height="${side}" fill="url(#p-studio)"/>`;

/** The framed print turned `angle` degrees about its upright axis, seen from the front. */
function turned(angle: number) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const outer = { width: print.width + band * 2, height: print.height + band * 2 };
  const y = (side - outer.height) / 2 - 20;
  const face = Math.abs(cos) * outer.width;
  const edge = Math.abs(sin) * depth;
  const left = side / 2 - (face + edge) / 2;
  // The edge shows on the side the print turns away from.
  const edgeX = sin > 0 ? left + face : left;
  const faceX = sin > 0 ? left : left + edge;
  const front =
    cos > 0
      ? `<rect width="${outer.width}" height="${outer.height}" fill="url(#p-wood)"/>${grain(0, 0, outer.width, outer.height, band)}${artwork(band, band, print.width, print.height)}<rect x="${band}" y="${band}" width="${print.width}" height="${print.height}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="3"/>`
      : `<rect width="${outer.width}" height="${outer.height}" fill="#8f7558"/><rect x="${band}" y="${band}" width="${print.width}" height="${print.height}" fill="#b49a7a"/>`;
  const shade = (0.25 * (1 - Math.abs(cos))).toFixed(3);
  return `${studio}
<ellipse cx="${side / 2}" cy="${y + outer.height + 46}" rx="${(face + edge) / 2 + 30}" ry="16" fill="#1d1a16" fill-opacity="0.16"/>
<rect x="${edgeX}" y="${y}" width="${edge}" height="${outer.height}" fill="#7d5c38"/>
<g transform="translate(${faceX} ${y}) scale(${(face / outer.width).toFixed(4)} 1)">${front}<rect width="${outer.width}" height="${outer.height}" fill="#000" fill-opacity="${shade}"/></g>`;
}

const page = (body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}" role="img" aria-label="${label}">${defs}${body}</svg>\n`;

/** A GLB of a box: its front textured with `image`, the other faces plain wood. */
function boxModel(image: Buffer, width: number, height: number, deep: number) {
  const [w, h, d] = [width / 2, height / 2, deep / 2];
  // Each face: four corners counterclockwise from outside, and its normal.
  const faces: [corners: number[][], normal: number[]][] = [
    [
      [
        [-w, -h, d],
        [w, -h, d],
        [w, h, d],
        [-w, h, d],
      ],
      [0, 0, 1],
    ],
    [
      [
        [w, -h, -d],
        [-w, -h, -d],
        [-w, h, -d],
        [w, h, -d],
      ],
      [0, 0, -1],
    ],
    [
      [
        [w, -h, d],
        [w, -h, -d],
        [w, h, -d],
        [w, h, d],
      ],
      [1, 0, 0],
    ],
    [
      [
        [-w, -h, -d],
        [-w, -h, d],
        [-w, h, d],
        [-w, h, -d],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [-w, h, d],
        [w, h, d],
        [w, h, -d],
        [-w, h, -d],
      ],
      [0, 1, 0],
    ],
    [
      [
        [-w, -h, -d],
        [w, -h, -d],
        [w, -h, d],
        [-w, -h, d],
      ],
      [0, -1, 0],
    ],
  ];
  const chunks: Buffer[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  let offset = 0;
  const push = (data: Buffer, target?: number) => {
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength, target });
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.byteLength % 4)) % 4)]);
    chunks.push(padded);
    offset += padded.byteLength;
    return bufferViews.length - 1;
  };
  const floats = (values: number[], size: 2 | 3, bounds = false) => {
    const view = push(Buffer.from(new Float32Array(values).buffer), 34962);
    const count = values.length / size;
    const range = (pick: (a: number, b: number) => number) =>
      Array.from({ length: size }, (_, axis) =>
        values.filter((_, index) => index % size === axis).reduce(pick),
      );
    accessors.push({
      bufferView: view,
      componentType: 5126,
      count,
      type: size === 3 ? "VEC3" : "VEC2",
      ...(bounds ? { min: range(Math.min), max: range(Math.max) } : {}),
    });
    return accessors.length - 1;
  };
  const indices = (values: number[]) => {
    const view = push(Buffer.from(new Uint16Array(values).buffer), 34963);
    accessors.push({ bufferView: view, componentType: 5123, count: values.length, type: "SCALAR" });
    return accessors.length - 1;
  };
  const primitive = (list: typeof faces, uv: boolean, material: number) => {
    const positions = list.flatMap(([corners]) => corners.flat());
    const normals = list.flatMap(([, normal]) => [normal, normal, normal, normal].flat());
    const triangles = list.flatMap((_, face) =>
      [0, 1, 2, 0, 2, 3].map((corner) => face * 4 + corner),
    );
    return {
      attributes: {
        POSITION: floats(positions, 3, true),
        NORMAL: floats(normals, 3),
        ...(uv ? { TEXCOORD_0: floats([0, 1, 1, 1, 1, 0, 0, 0], 2) } : {}),
      },
      indices: indices(triangles),
      material,
    };
  };
  const primitives = [primitive(faces.slice(0, 1), true, 0), primitive(faces.slice(1), false, 1)];
  const imageView = push(image);
  const binary = Buffer.concat(chunks);
  const json = {
    asset: { version: "2.0", generator: "fluidbox examples" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Framed print" }],
    meshes: [{ primitives }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.7,
        },
      },
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.55, 0.4, 0.25, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987 }],
    images: [{ bufferView: imageView, mimeType: "image/jpeg" }],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews,
    accessors,
  };
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([text, Buffer.alloc((4 - (text.byteLength % 4)) % 4, 0x20)]);
  const header = (length: number, type: number) => {
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32LE(length, 0);
    bytes.writeUInt32LE(type, 4);
    return bytes;
  };
  const total = 12 + 8 + jsonChunk.byteLength + 8 + binary.byteLength;
  const top = Buffer.alloc(12);
  top.write("glTF", 0);
  top.writeUInt32LE(2, 4);
  top.writeUInt32LE(total, 8);
  return Buffer.concat([
    top,
    header(jsonChunk.byteLength, 0x4e4f534a),
    jsonChunk,
    header(binary.byteLength, 0x004e4942),
    binary,
  ]);
}

if (import.meta.main) {
  const products = join(import.meta.dirname, "..", "public", "products");
  const spin = join(products, "spin");
  rmSync(spin, { recursive: true, force: true });
  mkdirSync(spin, { recursive: true });
  for (let frame = 0; frame < frames; frame++) {
    const angle = (frame * 360) / frames;
    const svg = sharp(Buffer.from(page(turned(angle), `The framed print turned ${angle}°`)));
    const name = join(spin, `${scene}-${String(frame).padStart(2, "0")}`);
    await svg.clone().webp({ quality: 72 }).toFile(`${name}.webp`);
    if (frame === 0)
      await svg.clone().resize(160).webp({ quality: 80 }).toFile(`${name}-thumb.webp`);
  }
  // The model's poster is the print turned a little, as the model first shows it.
  const posterSvg = sharp(Buffer.from(page(turned(-30), "The framed print in 3D")));
  await posterSvg
    .clone()
    .webp({ quality: 80 })
    .toFile(join(products, `${scene}-model.webp`));
  await posterSvg
    .clone()
    .resize(160)
    .webp({ quality: 80 })
    .toFile(join(products, `${scene}-model-thumb.webp`));
  // The model's front: the framed print, flat, as its texture.
  const outer = { width: print.width + band * 2, height: print.height + band * 2 };
  const face = `<svg xmlns="http://www.w3.org/2000/svg" width="${outer.width}" height="${outer.height}" viewBox="0 0 ${outer.width} ${outer.height}">${defs}<rect width="${outer.width}" height="${outer.height}" fill="url(#p-wood)"/>${grain(0, 0, outer.width, outer.height, band)}${artwork(band, band, print.width, print.height)}</svg>`;
  const texture = await sharp(Buffer.from(face))
    .resize(512, 683, { fit: "fill" })
    .jpeg({ quality: 78 })
    .toBuffer();
  const metres = 0.001;
  writeFileSync(
    join(products, `${scene}-model.glb`),
    boxModel(texture, outer.width * metres, outer.height * metres, depth * metres),
  );
  console.log(`Wrote ${frames} spin frames, a model and its poster to ${products}`);
}
