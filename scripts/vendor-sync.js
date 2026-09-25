'use strict';
// Vendored browser libraries: the self-hosted paradigm. Every third-party file
// the browser loads is COMMITTED under public/vendor/ with its version in the
// file name and its licence under public/vendor/LICENSES/ — served from our own
// origin, never from a CDN, never copied at boot. The CSP stays `'self'`, the
// deploy ships exactly the bytes that were reviewed and tested, and a
// production box needs no node_modules for the frontend.
//
// This script is the ONE way a vendored file changes: bump the package in
// devDependencies, `npm install`, then `npm run vendor:sync`. It copies the new
// build, deletes the old version, and rewrites the references in public/.
// tests/unit/vendor-integrity.test.mjs gates drift (package version ≠ vendored
// version, missing licence, dangling /vendor/ reference).
//
//   npm run vendor:sync            # write
//   npm run vendor:sync -- --check # exit 1 if anything would change

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'public', 'vendor');
const LICENSE_DIR = path.join(VENDOR_DIR, 'LICENSES');

// { pkg, file (inside the package), name (file-name stem), ext, license }.
// `license`: path inside the package, or null when the package ships none (the
// committed LICENSES/<name>-LICENSE.txt is then kept as is).
const LIBS = [
  { pkg: 'alpinejs', file: 'dist/module.esm.min.js', name: 'alpine', ext: '.esm.min.js', license: null },
];

function pkgVersion(pkg) {
  return require(path.join(ROOT, 'node_modules', pkg, 'package.json')).version;
}

function targetName(lib, version = pkgVersion(lib.pkg)) {
  return `${lib.name}-${version}${lib.ext}`;
}

// Existing vendored files of this lib (any version).
function vendoredFiles(lib) {
  const re = new RegExp(`^${lib.name}-\\d+\\.\\d+\\.\\d+[^/]*${lib.ext.replace(/\./g, '\\.')}$`);
  return fs.existsSync(VENDOR_DIR) ? fs.readdirSync(VENDOR_DIR).filter((f) => re.test(f)) : [];
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p !== VENDOR_DIR) walk(p, out); } else if (/\.(js|html|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

function sync({ check = false } = {}) {
  const changes = [];
  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  for (const lib of LIBS) {
    const want = targetName(lib);
    const src = path.join(ROOT, 'node_modules', lib.pkg, lib.file);
    const dst = path.join(VENDOR_DIR, want);
    if (!fs.existsSync(dst) || !fs.readFileSync(dst).equals(fs.readFileSync(src))) {
      changes.push(`write ${want}`);
      if (!check) fs.copyFileSync(src, dst);
    }
    for (const old of vendoredFiles(lib).filter((f) => f !== want)) {
      changes.push(`remove ${old}`);
      if (!check) fs.rmSync(path.join(VENDOR_DIR, old));
      // Point every reference in public/ and the test harnesses at the new file.
      for (const file of [...walk(path.join(ROOT, 'public')), ...walk(path.join(ROOT, 'tests', 'fixtures'))]) {
        const s = fs.readFileSync(file, 'utf8');
        if (s.includes(`/vendor/${old}`)) {
          changes.push(`rewrite ${path.relative(ROOT, file)}`);
          if (!check) fs.writeFileSync(file, s.split(`/vendor/${old}`).join(`/vendor/${want}`));
        }
      }
    }
    if (lib.license) {
      const lic = path.join(LICENSE_DIR, `${lib.name}-LICENSE.txt`);
      const licSrc = path.join(ROOT, 'node_modules', lib.pkg, lib.license);
      if (!fs.existsSync(lic) || !fs.readFileSync(lic).equals(fs.readFileSync(licSrc))) {
        changes.push(`write LICENSES/${lib.name}-LICENSE.txt`);
        if (!check) fs.copyFileSync(licSrc, lic);
      }
    }
  }
  return changes;
}

module.exports = { LIBS, VENDOR_DIR, LICENSE_DIR, pkgVersion, targetName, vendoredFiles, sync };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const changes = sync({ check });
  if (!changes.length) console.log('Vendor-Dateien aktuell.');
  else console.log(changes.map((c) => `${check ? '✗' : '✓'} ${c}`).join('\n'));
  if (check && changes.length) process.exit(1);
}
