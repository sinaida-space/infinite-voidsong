// Builds every icon from one drawing: concentric red rings on Void whose centres
// drift toward a vanishing point, the tunnel seen from the front.
//
//   public/favicon.svg          scalable, for modern browsers
//   public/favicon.ico          16, 32 and 48 px (PNG inside ICO), for everything else
//   public/apple-touch-icon.png 180 px, solid ground (iOS ignores transparency)
//   public/icons/192.png, 512.png, maskable-512.png   web app manifest
//
// Run:  node scripts/make-favicons.mjs   (uses the sharp dev dependency)
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => resolve(ROOT, 'public', p);

const VOID = '#050505';
const RED = '#cd0000';

// Rings: [radius, stroke width, centre offset]. Centres slide up and right as
// the rings shrink, so the tunnel curves away from the viewer.
const RINGS = [
  [27, 3.2, 0],
  [19.5, 2.8, 1.6],
  [12.5, 2.4, 3.2],
  [6.5, 2.0, 4.8],
];

/** SVG of the mark. `pad` shrinks the drawing inside the tile (maskable icons need a safe zone). */
function svg({ size = 64, pad = 0, ground = true, rounded = true } = {}) {
  const k = 1 - pad * 2;
  const rings = RINGS.map(([r, w, o]) =>
    `<circle cx="${32 + o}" cy="${32 - o * 0.6}" r="${r}" stroke-width="${w}"/>`).join('');
  const bg = ground ? `<rect width="64" height="64" fill="${VOID}"${rounded ? ' rx="12"' : ''}/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  ${bg}
  <g transform="translate(${32 * (1 - k)} ${32 * (1 - k)}) scale(${k})" fill="none" stroke="${RED}">${rings}</g>
</svg>`;
}

const png = (markup, px) => sharp(Buffer.from(markup), { density: 384 }).resize(px, px).png().toBuffer();

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dir = images.map(({ px, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(px >= 256 ? 0 : px, 0);
    e.writeUInt8(px >= 256 ? 0 : px, 1);
    e.writeUInt16LE(1, 4);   // colour planes
    e.writeUInt16LE(32, 6);  // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)]);
}

await writeFile(pub('favicon.svg'), svg({ rounded: true }) + '\n');

// Small sizes read better with the rings a touch larger, so no padding here.
const icoImages = [];
for (const px of [16, 32, 48]) icoImages.push({ px, data: await png(svg({ rounded: false }), px) });
await writeFile(pub('favicon.ico'), ico(icoImages));

await writeFile(pub('apple-touch-icon.png'), await png(svg({ rounded: false, pad: 0.06 }), 180));
await writeFile(pub('icons/192.png'), await png(svg({ rounded: true }), 192));
await writeFile(pub('icons/512.png'), await png(svg({ rounded: true }), 512));
// Maskable: the platform crops to its own shape, so keep the drawing inside the central 80 %.
await writeFile(pub('icons/maskable-512.png'), await png(svg({ rounded: false, pad: 0.14 }), 512));
console.log('icons written');
