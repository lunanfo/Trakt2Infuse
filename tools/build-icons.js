#!/usr/bin/env node
/**
 * Builds extension/icons/infuse-mark.png from extension/icons/infuse.png.
 *
 * The source artwork is a square PNG with a solid white plate. For the in-page
 * buttons we want just the orange mark, so this tool:
 *   1. decodes the source PNG (RGB, non-interlaced),
 *   2. keys the white plate out into an alpha channel,
 *   3. crops to the artwork and pads it back to a centred square,
 *   4. box-downscales and writes a small RGBA PNG.
 *
 * The userscript build embeds the resulting mark as a base64 data URL.
 *
 * Usage: npm run build:icons
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'extension/icons/infuse.png');
const TARGET = path.join(ROOT, 'extension/icons/infuse-mark.png');
const SIZE = 96;
// Pixels brighter than this are treated as the white plate.
const WHITE_FLOOR = 250;
const WHITE_CEIL = 214;

// --- minimal PNG codec -------------------------------------------------------
function decodePng(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let width, height, colorType;
  const idat = [];

  while (off < buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('unsupported bit depth');
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + length;
  }

  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : null;
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let p = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      const v = line[x];
      let value;
      switch (filter) {
        case 0: value = v; break;
        case 1: value = v + a; break;
        case 2: value = v + b; break;
        case 3: value = v + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a);
          const pb = Math.abs(pp - b);
          const pc = Math.abs(pp - c);
          value = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unsupported filter ${filter}`);
      }
      cur[x] = value & 0xff;
    }
  }

  return { width, height, channels, pixels: out };
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- white plate keying ------------------------------------------------------
function keyOutWhitePlate({ width, height, channels, pixels }) {
  const rgba = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * channels];
    const g = pixels[i * channels + 1];
    const b = pixels[i * channels + 2];
    const whiteness = Math.min(r, g, b);

    let alpha = (WHITE_FLOOR - whiteness) / (WHITE_FLOOR - WHITE_CEIL);
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha < 0.12) alpha = 0;

    const o = i * 4;
    if (alpha > 0) {
      // un-premultiply against the white plate so edges keep their colour
      const scale = 1 / alpha;
      rgba[o] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) * scale)));
      rgba[o + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) * scale)));
      rgba[o + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) * scale)));
      rgba[o + 3] = Math.round(alpha * 255);

      const x = i % width;
      const y = (i / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) throw new Error('no artwork found after keying the white plate');
  return { rgba, width, height, box: { minX, minY, maxX, maxY } };
}

/**
 * Crop to the artwork, pad back to a centred square and box-downscale.
 */
function renderMark({ rgba, width, box }, size) {
  const artW = box.maxX - box.minX + 1;
  const artH = box.maxY - box.minY + 1;
  const margin = Math.round(Math.max(artW, artH) * 0.02);
  const side = Math.max(artW, artH) + margin * 2;
  const originX = box.minX - Math.round((side - artW) / 2);
  const originY = box.minY - Math.round((side - artH) / 2);

  const out = Buffer.alloc(size * size * 4);
  const scale = side / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      let samples = 0;

      const x0 = Math.floor(x * scale);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scale));
      const y0 = Math.floor(y * scale);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scale));

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const px = originX + sx;
          const py = originY + sy;
          samples++;
          if (px < 0 || py < 0 || px >= width || py >= width) continue;
          const i = (py * width + px) * 4;
          const a = rgba[i + 3] / 255;
          sr += rgba[i] * a;
          sg += rgba[i + 1] * a;
          sb += rgba[i + 2] * a;
          sa += a;
        }
      }

      const o = (y * size + x) * 4;
      out[o] = sa ? Math.round(sr / sa) : 0;
      out[o + 1] = sa ? Math.round(sg / sa) : 0;
      out[o + 2] = sa ? Math.round(sb / sa) : 0;
      out[o + 3] = Math.round((sa / samples) * 255);
    }
  }

  return out;
}

function buildMark({ force = false } = {}) {
  if (!force && fs.existsSync(TARGET)) return TARGET;
  const keyed = keyOutWhitePlate(decodePng(SOURCE));
  const rgba = renderMark(keyed, SIZE);
  fs.writeFileSync(TARGET, encodePng(SIZE, SIZE, rgba));
  const bytes = fs.statSync(TARGET).size;
  console.log(`wrote ${path.relative(ROOT, TARGET)} (${SIZE}x${SIZE}, ${bytes} bytes)`);
  return TARGET;
}

module.exports = { buildMark, TARGET };

if (require.main === module) {
  buildMark({ force: process.argv.includes('--force') });
}
