#!/usr/bin/env node
// Generates public/og.png: 1200x630, Void ground, red frame.
// No image/font dependencies — same tiny zlib PNG encoder as
// scripts/generate-icons.mjs, extended to draw a stroked rectangle instead
// of a filled one. Dependency-free pixel text at this resolution is not
// legible enough to ship, so the title is carried by the page's own <title>
// and OG meta tags, not baked into the image (see README for the tradeoff).
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

const WIDTH = 1200;
const HEIGHT = 630;
const VOID = [0x05, 0x05, 0x05];
const RED = [0xcd, 0x00, 0x00];
const FRAME = 14; // border thickness in px

function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createOgImage() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(HEIGHT * (WIDTH * 3 + 1));
  let offset = 0;
  for (let y = 0; y < HEIGHT; y++) {
    raw[offset++] = 0; // filter type: none
    const onFrameRow = y < FRAME || y >= HEIGHT - FRAME;
    for (let x = 0; x < WIDTH; x++) {
      const onFrameCol = x < FRAME || x >= WIDTH - FRAME;
      const [r, g, b] = onFrameRow || onFrameCol ? RED : VOID;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const compressed = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/og.png', createOgImage());
console.log('OG image generated: public/og.png (1200x630)');
