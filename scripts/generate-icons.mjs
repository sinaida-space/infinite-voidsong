#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

function createPNG(size, voidColor = 0x050505, redColor = 0xcd0000) {
  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdr]));
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdr,
    Buffer.alloc(4),
  ]);
  ihdrChunk.writeUInt32BE(ihdrCrc, 17);

  // IDAT chunk
  const voidR = (voidColor >> 16) & 0xff;
  const voidG = (voidColor >> 8) & 0xff;
  const voidB = voidColor & 0xff;
  const redR = (redColor >> 16) & 0xff;
  const redG = (redColor >> 8) & 0xff;
  const redB = redColor & 0xff;

  const squareStart = Math.floor(size * 0.25);
  const squareEnd = Math.floor(size * 0.75);

  const rawData = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter type
    for (let x = 0; x < width; x++) {
      if (x >= squareStart && x < squareEnd && y >= squareStart && y < squareEnd) {
        rawData[offset++] = redR;
        rawData[offset++] = redG;
        rawData[offset++] = redB;
      } else {
        rawData[offset++] = voidR;
        rawData[offset++] = voidG;
        rawData[offset++] = voidB;
      }
    }
  }

  const compressed = deflateSync(rawData);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    compressed,
    Buffer.alloc(4),
  ]);
  idatChunk.writeUInt32BE(compressed.length, 0);
  idatChunk.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    Buffer.alloc(4),
  ]);
  iendChunk.writeUInt32BE(iendCrc, 4);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

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

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/192.png', createPNG(192));
writeFileSync('public/icons/512.png', createPNG(512));
console.log('Icons generated: public/icons/192.png, public/icons/512.png');
