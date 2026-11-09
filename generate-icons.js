/**
 * generate-icons.js  –  Run once with Node.js to create the PWA icons.
 * Usage:  node generate-icons.js
 * Requires: nothing (uses built-in Canvas via node-canvas OR writes raw SVG fallbacks)
 *
 * Since we cannot guarantee node-canvas is installed, this script writes
 * minimal valid PNG files using a pure-JS PNG encoder (no deps).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Tiny pure-JS PNG encoder ────────────────────────────
// Creates a solid-color PNG with a centred emoji-like glyph.
// We use zlib from Node's stdlib for the DEFLATE step.
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = (v & 1) ? 0xEDB88320 ^ (v >>> 1) : (v >>> 1);
      t[i] = v;
    }
    return t;
  })());
  for (const byte of buf) c = table[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = u32be(data.length);
  const crc = u32be(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Build a minimal RGBA PNG of `size × size` pixels.
 * `drawFn(x, y)` returns [r, g, b, a] for each pixel.
 */
function buildPNG(size, drawFn) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 2;   // colour type = truecolour (RGB)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines (filter byte 0 = None, then RGB triples)
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y);
      const off = y * (1 + size * 3) + 1 + x * 3;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG sig
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Draw the StudyTrack icon: purple circle + white clock face */
function studytrackIcon(size) {
  const cx = size / 2, cy = size / 2, r = size / 2;

  // Accent purple #6C63FF
  const bg  = [0x6C, 0x63, 0xFF];
  // Dark purple for clock details
  const dk  = [0x4B, 0x44, 0xCC];
  const wht = [0xFF, 0xFF, 0xFF];

  return buildPNG(size, (x, y) => {
    const dx = x - cx + 0.5;
    const dy = y - cy + 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Outside circle → transparent (white bg for now, PNG has no alpha in RGB mode)
    if (dist > r - 1) return [0xFF, 0xFF, 0xFF];

    // Clock circle (inner white circle, 60% radius)
    const cr = r * 0.60;
    if (dist < cr) {
      // Clock face white
      // Hour hand: 12 o'clock area (thin vertical line)
      const angle = Math.atan2(dx, -dy); // 0 = 12 o'clock
      const absA  = Math.abs(angle);
      const handLen = cr * 0.5;
      if (dist < handLen && absA < 0.1) return dk;

      // Minute hand: pointing to 3 o'clock (right)
      const angle2 = Math.atan2(-dy, dx); // 0 = 3 o'clock
      const absA2  = Math.abs(angle2);
      if (dist < cr * 0.7 && absA2 < 0.1) return dk;

      // Centre dot
      if (dist < r * 0.06) return dk;

      return wht;
    }

    // Ring between clock and outer
    return bg;
  });
}

for (const size of [192, 512]) {
  const png  = studytrackIcon(size);
  const dest = path.join(__dirname, 'icons', `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`Created ${dest} (${png.length} bytes)`);
}

console.log('Icons generated successfully.');
