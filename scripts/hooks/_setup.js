'use strict';
// Setup state of a checkout, for the hooks: a fresh clone of the template has
// no node_modules and still carries the template's name. SessionStart names
// the missing step once; the Stop hook skips the unit gate while npm install
// is missing (otherwise every turn ends in a red "Cannot find module").

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hasDeps = (root) => fs.existsSync(path.join(root, 'node_modules', '.package-lock.json'));

// Repo name from the origin URL (https or ssh, with or without .git).
function originRepo(root) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const m = r.stdout.trim().match(/([^/:]+?)(?:\.git)?\/?$/);
  return m ? m[1] : null;
}

// Heuristic, deliberately soft: a project renamed by `npm run init` carries its
// repo's name. Different name → probably a clone that was never initialized.
function setupHints(root, repo = originRepo(root)) {
  const hints = [];
  if (!hasDeps(root)) hints.push('[setup] node_modules fehlt — zuerst `npm install` (Hooks + Unit-Gate brauchen es).');
  let name = null;
  try { name = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name; } catch { /* no package.json */ }
  if (repo && name && repo !== name) {
    hints.push(`[setup] package.json heisst "${name}", das Repo "${repo}". Ein frischer Klon des Templates? `
      + 'Dann zuerst `/projekt-init <slug> "<Anzeigename>"` (benennt um, setzt Version + CHANGELOG zurück).');
  }
  return hints;
}

module.exports = { hasDeps, originRepo, setupHints };
