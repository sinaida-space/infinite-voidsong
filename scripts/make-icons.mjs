// Infinite Voidsong — placeholder app icons
//
// The committed 192/512 PNGs had a corrupt IHDR (invalid color type byte),
// which Chrome's manifest processor rejects with a console warning
// ("Download error or resource isn't a valid image"). Regenerates both as
// a solid Void square with a centred red square, matching docs/PLAN.md's
// description of the placeholder. Run once; the outputs are committed, this
// script is not part of the build.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = resolve(import.meta.dirname, '..', 'public/icons');
const VOID = { r: 0x05, g: 0x05, b: 0x05, alpha: 1 };
const RED = '#cd0000';

async function makeIcon(size) {
  const mark = Math.round(size * 0.5);
  const offset = Math.round((size - mark) / 2);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect x="${offset}" y="${offset}" width="${mark}" height="${mark}" fill="${RED}" />
    </svg>`,
  );

  const outPath = resolve(OUT_DIR, `${size}.png`);
  await sharp({ create: { width: size, height: size, channels: 4, background: VOID } })
    .composite([{ input: svg }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await mkdir(OUT_DIR, { recursive: true });
await makeIcon(192);
await makeIcon(512);
