// Infinite Voidsong — 404 artwork preprocessor
//
// Reads every PNG in 404_images/, resizes it to 720px wide, and reduces it
// to a two-tone ordered (Bayer 4x4) dither in Void / brand red. Writes the
// result to public/404/<name>.png plus a manifest.json the 404 page reads
// at runtime to pick one at random. Build-time only — `sharp` is a
// devDependency, never shipped to the browser.
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { extname, basename, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_DIR = resolve(ROOT, '404_images');
const OUT_DIR = resolve(ROOT, 'public/404');
const TARGET_WIDTH = 720;

// Two tones the page is built in.
const VOID = { r: 0x05, g: 0x05, b: 0x05 };
const CHALK = { r: 0xcd, g: 0x00, b: 0x00 }; // brand red, same palette as the sinaida.eu image dither

// 4x4 ordered (Bayer) dither matrix, values 0-15.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Ordered-dithers raw RGB pixel data in place into a two-tone Void/Chalk buffer. */
function ditherToTwoTone(data, width, height, channels) {
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = luminance(r, g, b) / 255;
      const threshold = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16;
      const tone = l > threshold ? CHALK : VOID;
      const o = (y * width + x) * 3;
      out[o] = tone.r;
      out[o + 1] = tone.g;
      out[o + 2] = tone.b;
    }
  }
  return out;
}

async function ditherOne(filePath, name) {
  const resized = sharp(filePath)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .removeAlpha();
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const dithered = ditherToTwoTone(data, width, height, channels);

  const outPath = resolve(OUT_DIR, `${name}.png`);
  await sharp(dithered, { raw: { width, height, channels: 3 } })
    .png({ palette: true, colors: 2, compressionLevel: 9 })
    .toFile(outPath);

  return { name: `${name}.png`, width, height };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SRC_DIR)).filter((f) => extname(f).toLowerCase() === '.png');
  if (files.length === 0) {
    throw new Error(`No source PNGs found in ${SRC_DIR}`);
  }

  const manifest = [];
  for (const file of files) {
    const name = basename(file, extname(file));
    const entry = await ditherOne(resolve(SRC_DIR, file), name);
    manifest.push(entry.name);
    console.log(`dithered ${entry.name} (${entry.width}x${entry.height})`);
  }

  manifest.sort();
  await writeFile(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`wrote manifest.json with ${manifest.length} entries`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
