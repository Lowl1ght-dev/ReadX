import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "build", "icon.svg");
const outDir = path.join(root, "build");
const svg = fs.readFileSync(svgPath);

function pngToIco(pngBuffer) {
  const header = 6 + 16;
  const buf = Buffer.alloc(header + pngBuffer.length);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);
  buf[6] = 0;
  buf[7] = 0;
  buf[8] = 0;
  buf[9] = 0;
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(pngBuffer.length, 14);
  buf.writeUInt32LE(header, 18);
  pngBuffer.copy(buf, header);
  return buf;
}

const png512 = await sharp(svg, { density: 288 }).resize(512, 512).png().toBuffer();
const png256 = await sharp(png512).resize(256, 256).png().toBuffer();

fs.writeFileSync(path.join(outDir, "icon.png"), png512);
fs.writeFileSync(path.join(outDir, "icon.ico"), pngToIco(png256));
fs.writeFileSync(path.join(root, "public", "icon.png"), png256);

console.log("Generated build/icon.png, build/icon.ico, public/icon.png");
