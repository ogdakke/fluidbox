import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

// An item's width and height give the viewer its frame before the image
// loads. When they disagree with the file, the photo letterboxes inside the
// frame and the closing flight lands on a thumbnail of another shape.

const root = import.meta.dirname;
const publicDir = join(root, "public");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".spec.ts") ? [path] : [];
  });
}

/** The pixel size of a WebP, PNG or JPEG file, from its header. */
function imageSize(bytes: Buffer): [number, number] | null {
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (chunk === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    return null;
  }
  if (bytes.readUInt32BE(0) === 0x89504e47) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let at = 2; at < bytes.length - 9; ) {
      const marker = bytes[at + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  return null;
}

const declared =
  /src: "(\/[^"?#]+\.(?:webp|png|jpe?g))[^"]*",[^{}]*?\bwidth: (\d+),\s*height: (\d+)/g;

test("every example image item declares its file's aspect ratio", () => {
  const checked: string[] = [];
  const wrong: string[] = [];
  for (const file of sources(root)) {
    for (const [, src, width, height] of readFileSync(file, "utf8").matchAll(declared)) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(join(publicDir, src!));
      } catch {
        continue;
      }
      const size = imageSize(bytes);
      if (!size) continue;
      const where = `${relative(root, file)} ${src}`;
      checked.push(where);
      const actual = size[0] / size[1];
      const claimed = Number(width) / Number(height);
      if (Math.abs(actual - claimed) / actual > 0.01) {
        wrong.push(`${where}: declares ${width}×${height}, the file is ${size[0]}×${size[1]}`);
      }
    }
  }
  expect(checked.length).toBeGreaterThan(10);
  expect(wrong).toEqual([]);
});
