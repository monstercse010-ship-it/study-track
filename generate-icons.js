/**
 * StudyTrack – generate-icons.js
 * Generates true 32-bit RGBA PNG icons for PWA and browsers.
 * 
 * Generates:
 * - /icon-192.png (192x192)
 * - /icon-512.png (512x512)
 * - /icons/icon-192.png
 * - /icons/icon-512.png
 * - /favicon.png
 */

'use strict';

const fs = require('fs');
const path = require('path');
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

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Builds a valid 32-bit RGBA PNG image of size x size.
 * Designed with 80% safe-zone to comply with both "any" and "maskable" PWA requirements.
 */
function createStudyTrackPNG(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.40; // 80% diameter safe zone
  const ringWidth = size * 0.052;
  const innerR = outerR - ringWidth;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 4);
    raw[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep theme-matching background (#0c0818)
      let r = 0x0c, g = 0x08, b = 0x18, a = 0xff;

      // Soft ambient radial glow behind central icon
      if (dist < size * 0.46) {
        const glowFactor = 1 - (dist / (size * 0.46));
        r = Math.min(255, Math.round(r + 32 * glowFactor));
        g = Math.min(255, Math.round(g + 16 * glowFactor));
        b = Math.min(255, Math.round(b + 58 * glowFactor));
      }

      // Outer dual-glow ring (Blue on left, Red on right, Violet top & bottom)
      if (dist >= innerR && dist <= outerR) {
        const angle = Math.atan2(dy, dx); // -PI to PI
        const t = (Math.cos(angle) + 1) / 2; // 0 (left blue) -> 1 (right red)
        r = Math.round(30 * (1 - t) + 255 * t);
        g = Math.round(111 * (1 - t) + 36 * t);
        b = Math.round(255 * (1 - t) + 66 * t);
      }

      // Inner clock dial & hands
      if (dist < innerR) {
        r = 0x14; g = 0x0e; b = 0x28; // dial face

        // Hour tick marks at 12, 3, 6, 9
        const isTick = (
          (Math.abs(dx) < size * 0.015 && dy < -innerR * 0.65 && dy > -innerR * 0.9) ||
          (Math.abs(dx) < size * 0.015 && dy > innerR * 0.65 && dy < innerR * 0.9) ||
          (Math.abs(dy) < size * 0.015 && dx > innerR * 0.65 && dx < innerR * 0.9) ||
          (Math.abs(dy) < size * 0.015 && dx < -innerR * 0.65 && dx > -innerR * 0.9)
        );

        if (isTick) {
          r = 0x93; g = 0x33; b = 0xea; // purple tick
        }

        // Center pivot
        if (dist < size * 0.038) {
          r = 0xff; g = 0xff; b = 0xff;
        }

        // Hour hand pointing to ~1:45
        const handAngle1 = -Math.PI / 3.8;
        const proj1 = dx * Math.cos(handAngle1) + dy * Math.sin(handAngle1);
        const perp1 = Math.abs(-dx * Math.sin(handAngle1) + dy * Math.cos(handAngle1));
        if (proj1 > 0 && proj1 < innerR * 0.54 && perp1 < size * 0.02) {
          r = 0xf3; g = 0xe8; b = 0xff; // crisp lavender
        }

        // Minute hand pointing straight up
        const handAngle2 = -Math.PI / 2;
        const proj2 = dx * Math.cos(handAngle2) + dy * Math.sin(handAngle2);
        const perp2 = Math.abs(-dx * Math.sin(handAngle2) + dy * Math.cos(handAngle2));
        if (proj2 > 0 && proj2 < innerR * 0.74 && perp2 < size * 0.016) {
          r = 0xff; g = 0x24; b = 0x42; // vibrant red
        }
      }

      raw[px]     = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const baseDir = __dirname;
const iconsDir = path.join(baseDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating PWA icons...');
const buf192 = createStudyTrackPNG(192);
const buf512 = createStudyTrackPNG(512);

// Write root icons
fs.writeFileSync(path.join(baseDir, 'icon-192.png'), buf192);
fs.writeFileSync(path.join(baseDir, 'icon-512.png'), buf512);
fs.writeFileSync(path.join(baseDir, 'favicon.png'), buf192);

// Write icons/ folder copies
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), buf192);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), buf512);

console.log('✅ Generated:');
console.log('  - icon-192.png (192x192, RGBA)');
console.log('  - icon-512.png (512x512, RGBA)');
console.log('  - icons/icon-192.png (192x192, RGBA)');
console.log('  - icons/icon-512.png (512x512, RGBA)');
console.log('  - favicon.png (192x192, RGBA)');
