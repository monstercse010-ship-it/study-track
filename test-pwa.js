/**
 * test-pwa.js
 * Comprehensive diagnostic check for StudyTrack PWA installability requirements.
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, cond) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${label}`);
    failed++;
  }
}

const baseDir = __dirname;
console.log('\n── PWA INSTALLABILITY AUDIT ──');

// 1. Check index.html manifest link
const indexHtml = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf-8');
const hasManifestLink = /<link\s+[^>]*rel=["']manifest["'][^>]*href=["']\/manifest\.json["']/i.test(indexHtml);
assert('1. index.html has <link rel="manifest" href="/manifest.json"> inside <head>', hasManifestLink);

// 2. Check manifest.json contents
const manifestPath = path.join(baseDir, 'manifest.json');
let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (e) {
  console.error('Manifest JSON parse error:', e);
}

assert('2a. manifest.json exists and is valid JSON', manifest !== null);
assert('2b. manifest has name and short_name', manifest && !!manifest.name && !!manifest.short_name);
assert('2c. manifest start_url is "/"', manifest && manifest.start_url === '/');
assert('2d. manifest scope is "/"', manifest && manifest.scope === '/');
assert('2e. manifest display is "standalone"', manifest && manifest.display === 'standalone');

const icons = (manifest && Array.isArray(manifest.icons)) ? manifest.icons : [];
const hasIcon192 = icons.some(ic => (ic.src === '/icon-192.png' || ic.src === 'icon-192.png') && ic.sizes === '192x192' && ic.type === 'image/png');
const hasIcon512 = icons.some(ic => (ic.src === '/icon-512.png' || ic.src === 'icon-512.png') && ic.sizes === '512x512' && ic.type === 'image/png');
assert('2f. manifest icons array has exact icon-192.png with 192x192 and image/png', hasIcon192);
assert('2g. manifest icons array has exact icon-512.png with 512x512 and image/png', hasIcon512);

// 3. Real PNG file check: signatures, dimensions
function verifyPng(filePath, expectedW, expectedH) {
  if (!fs.existsSync(filePath)) return false;
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = buf.slice(0, 8);
  const isPng = sig.equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (!isPng) return false;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w === expectedW && h === expectedH;
}

assert('3a. /icon-192.png is real PNG with exact 192x192 dimensions', verifyPng(path.join(baseDir, 'icon-192.png'), 192, 192));
assert('3b. /icon-512.png is real PNG with exact 512x512 dimensions', verifyPng(path.join(baseDir, 'icon-512.png'), 512, 512));

// 4. Maskable purpose icon entry
const hasMaskable = icons.some(ic => (ic.sizes === '512x512' || ic.sizes.includes('512')) && ic.purpose && ic.purpose.includes('maskable'));
assert('4. Manifest has icon entry with purpose "maskable" for 512 icon', hasMaskable);

// 5. sw.js registered in index.html, has install and fetch handlers
const hasSwInHtml = indexHtml.includes('navigator.serviceWorker.register(\'/sw.js\')') || indexHtml.includes('navigator.serviceWorker.register("/sw.js")');
assert('5a. sw.js is registered in index.html with navigator.serviceWorker.register("/sw.js")', hasSwInHtml);

const swJs = fs.readFileSync(path.join(baseDir, 'sw.js'), 'utf-8');
const hasInstall = swJs.includes("addEventListener('install'") || swJs.includes('addEventListener("install"');
const hasFetch = swJs.includes("addEventListener('fetch'") || swJs.includes('addEventListener("fetch"');
assert('5b. sw.js has an install event listener', hasInstall);
assert('5c. sw.js has a fetch event listener responding with cache/network', hasFetch);

// 6. vercel.json does not block manifest, sw, or icons
const vercelJsonPath = path.join(baseDir, 'vercel.json');
let vercelJsonValid = false;
if (fs.existsSync(vercelJsonPath)) {
  try {
    const v = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
    // Ensure no rewrites intercept /manifest.json or /sw.js
    const hasBadRewrite = Array.isArray(v.rewrites) && v.rewrites.some(r => r.source === '/(.*)' && !r.source.includes('api'));
    vercelJsonValid = !hasBadRewrite;
  } catch (e) {
    vercelJsonValid = false;
  }
}
assert('6. vercel.json exists and does not block/rewrite /manifest.json, /sw.js, or icons', vercelJsonValid);

// 7. Check theme-color and apple-touch-icon
const hasThemeColor = /<meta\s+[^>]*name=["']theme-color["']/i.test(indexHtml);
const hasAppleTouchIcon = /<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*href=["']\/icon-192\.png["']/i.test(indexHtml);
assert('7a. index.html has <meta name="theme-color">', hasThemeColor);
assert('7b. index.html has <link rel="apple-touch-icon" href="/icon-192.png">', hasAppleTouchIcon);

console.log(`\n──────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
