// Unit: the self-hosted paradigm. Everything the browser loads comes from our
// own origin — third-party code is committed under public/vendor/ (versioned
// file name + licence, scripts/vendor-sync.js), fonts under public/fonts/, icons
// in public/icons.svg. No CDN, no boot-time copy from node_modules.
//
// Catches: a bumped devDependency whose vendored build was not re-synced (the
// browser would keep running the old version while tests claim the new one), a
// vendored file without licence, a /vendor/ reference to a file that isn't
// there, and any external URL sneaking into markup/CSS/JS.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vendor = require('../../scripts/vendor-sync.js');
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PUBLIC = path.join(ROOT, 'public');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p !== vendor.VENDOR_DIR) walk(p, out); } else out.push(p);
  }
  return out;
}
const sources = [...walk(PUBLIC), ...walk(path.join(ROOT, 'tests', 'fixtures'))]
  .filter((f) => /\.(js|mjs|html|css|webmanifest)$/.test(f));

test('vendored builds match the installed package versions (npm run vendor:sync)', () => {
  assert.deepEqual(vendor.sync({ check: true }), [], 'Vendor-Drift — „npm run vendor:sync" laufen lassen und committen.');
});

test('every vendored lib has exactly one versioned file and a licence', () => {
  for (const lib of vendor.LIBS) {
    assert.deepEqual(vendor.vendoredFiles(lib), [vendor.targetName(lib)], `${lib.name}: genau eine versionierte Datei erwartet`);
    assert.ok(fs.existsSync(path.join(vendor.LICENSE_DIR, `${lib.name}-LICENSE.txt`)), `${lib.name}: Lizenz fehlt in public/vendor/LICENSES/`);
  }
});

test('every /vendor/ reference in public/ points at an existing file', () => {
  for (const file of sources) {
    for (const [, ref] of fs.readFileSync(file, 'utf8').matchAll(/\/vendor\/([\w.@-]+)/g)) {
      assert.ok(fs.existsSync(path.join(vendor.VENDOR_DIR, ref)), `${path.relative(ROOT, file)} → /vendor/${ref} existiert nicht`);
    }
  }
});

test('no external URLs are loaded from markup, CSS or JS', () => {
  // src/href/url()/@import/import/fetch with an absolute http(s) or protocol-relative URL.
  const re = /(?:\b(?:src|href|action)\s*=\s*["']|url\(\s*["']?|@import\s+["']|\bimport\s*(?:[^'"]*from\s*)?["']|\bfetch\(\s*["'])(?:https?:)?\/\//gi;
  const hits = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) hits.push(`${path.relative(ROOT, file)}: ${text.slice(m.index, m.index + 60)}`);
  }
  assert.deepEqual(hits, [], 'Externe Ressource gefunden — self-hosten (public/vendor/, public/fonts/, public/icons.svg).');
});
