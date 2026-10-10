// PWA wiring: the manifest, the icons it points at, and the service worker's
// precache list. A module missing from that list does not break the app online,
// it breaks it offline - next time the device has no network, which is exactly
// when nobody is watching the console. So the list is checked against the files
// on disk instead of trusted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const read = (rel) => readFileSync(join(appDir, rel), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
const sw = read('sw.js');
const html = read('index.html');

// Everything the running app pulls over the network. Derived by walking app/
// rather than hardcoded, so adding a file to the repo shows up here.
const NOT_SERVED = new Set([
  '_headers',                 // hosting config, the browser never requests it
]);
const NOT_WEB = /\.(txt|md)$/; // font licences ship next to the fonts, unused at runtime
function shippedFiles(dir = '', out = []) {
  for (const entry of readdirSync(join(appDir, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { shippedFiles(rel, out); continue; }
    if (NOT_SERVED.has(rel) || NOT_WEB.test(rel)) continue;
    out.push(rel);
  }
  return out;
}

const shellList = () => {
  const block = /const SHELL = \[([\s\S]*?)\];/.exec(sw);
  assert.ok(block, 'sw.js should declare a SHELL array');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

test('every shipped file is precached, and every precached path exists', () => {
  const listed = new Set(shellList());
  // './' is the directory form of index.html; both are listed on purpose so the
  // worker matches a bare visit and an explicit index.html alike.
  listed.delete('./');

  const missing = shippedFiles().filter(
    // sw.js cannot precache itself: a worker that is mid-update would otherwise
    // overwrite its own script from its own stale cache.
    (f) => f !== 'sw.js' && !listed.has(f),
  );
  assert.deepEqual(missing, [], `not precached, so unavailable offline: ${missing.join(', ')}`);

  const phantom = [...listed].filter((f) => !existsSync(join(appDir, f)));
  assert.deepEqual(phantom, [], `precached but not on disk: ${phantom.join(', ')}`);
});

test('the manifest describes an installable standalone app', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '.');
  assert.equal(manifest.scope, '.');
  // The colours have to match the app itself or the launch screen flashes.
  assert.equal(manifest.theme_color, '#3b6bff');
  assert.equal(manifest.background_color, '#fff8ec');
  assert.match(manifest.name, /多巴胺口算/);

  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'Android install needs a 192px icon');
  assert.ok(sizes.includes('512x512'), 'a 512px icon is required for install');
  // Without a maskable icon Android shrinks the art into a white circle.
  assert.ok(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'a maskable icon is required to avoid Android crop artefacts',
  );
});

test('ios home screen tags are present, since iOS ignores the manifest', () => {
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon-180\.png"/);
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
});

test('every manifest icon exists on disk at its declared type', () => {
  for (const icon of manifest.icons) {
    const p = join(appDir, icon.src);
    assert.ok(existsSync(p), `${icon.src} is missing`);
    // Real PNG magic bytes: a placeholder or an SVG renamed to .png installs on
    // Chromium as a blank square, which is easy to miss in a browser tab.
    const head = readFileSync(p).subarray(0, 8);
    assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${icon.src} is not a PNG`);
  }
});

test('the dev harness URLs bypass the cache', () => {
  // ?pump drives the test tab and ?capture renders video; a cached response
  // would quietly replay an older build for both.
  assert.match(sw, /url\.searchParams\.has\('pump'\)/);
  assert.match(sw, /url\.searchParams\.has\('capture'\)/);
});

test('bumping the cache version is what drops the old cache', () => {
  assert.match(sw, /const CACHE_VERSION = '/);
  assert.match(sw, /caches\.keys\(\)/);
  assert.match(sw, /n !== CACHE/);
});

// The Android project builds from its own generated copy of app/, refreshed by
// `cap copy`. A gradlew run without that step sees unchanged inputs, reports
// success, and hands back the previous release's files - which is how a
// released APK once shipped without three fixes that were already in app/.
// The npm script is the documented way to build it, so it has to sync.
test('the Android build script syncs the web files before grading', () => {
  const pkg = JSON.parse(readFileSync(join(appDir, '..', 'mobile', 'package.json'), 'utf8'));
  for (const name of ['apk', 'build:android']) {
    assert.match(
      pkg.scripts[name],
      /cap sync/,
      `mobile/package.json "${name}" must run cap sync first, or the build reuses the previous release's web files`,
    );
  }
});
