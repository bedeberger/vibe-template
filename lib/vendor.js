'use strict';
// No build step: third-party browser libs are copied verbatim from
// node_modules into public/vendor/ at boot, then served as static files. This
// keeps the frontend dependency-pinned without a bundler. public/vendor/ is
// git-ignored — it is regenerated, not committed.

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const VENDOR_DIR = path.join(__dirname, '..', 'public', 'vendor');

// [ source in node_modules, destination filename ]. We ship the ESM build so
// app.js can `import Alpine` and control start order (no auto-start).
const ASSETS = [['alpinejs/dist/module.esm.min.js', 'alpine.esm.js']];

function ensureVendor() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  for (const [src, dest] of ASSETS) {
    const from = require.resolve(src);
    const to = path.join(VENDOR_DIR, dest);
    const stale = !fs.existsSync(to) || fs.statSync(from).mtimeMs > fs.statSync(to).mtimeMs;
    if (stale) {
      fs.copyFileSync(from, to);
      logger.info(`Vendor-Asset kopiert: ${dest}`);
    }
  }
}

module.exports = { ensureVendor };
