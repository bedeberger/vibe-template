// Unit: the project initializer (scripts/project-init.js) leaves NO occurrence
// of the old name behind. Runs it in a temp copy of every text file it would
// scan and greps the result — a new spot that carries the name (a workflow, a
// doc, a page) is renamed or makes this test red, never silently forgotten.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const init = require('../../scripts/project-init.js');
const OLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name;

const tmps = [];
test.after(() => { for (const t of tmps) fs.rmSync(t, { recursive: true, force: true }); });

function copyTree() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-init-'));
  tmps.push(tmp);
  for (const rel of init.textFiles(ROOT)) {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel));
  }
  return tmp;
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const hits = (root, name) => init.textFiles(root)
  .filter((rel) => rel !== 'CHANGELOG.md' && new RegExp(`(?<!\\w)(?<!\\w-)${name}(?!\\w|-\\w)`).test(read(root, rel)));

test('rename leaves no occurrence of the old slug and sets the title everywhere', () => {
  const tmp = copyTree();
  fs.writeFileSync(path.join(tmp, 'app.db'), 'x');
  const p = init.plan(tmp, 'invoice-hub', { title: 'Invoice Hub' });
  assert.equal(p.oldSlug, OLD);
  init.apply(tmp, p);

  assert.deepEqual(hits(tmp, OLD), [], `alter Slug "${OLD}" noch vorhanden`);
  assert.equal(JSON.parse(read(tmp, 'package.json')).name, 'invoice-hub');
  assert.equal(JSON.parse(read(tmp, 'package.json')).version, '0.1.0');
  for (const l of ['de', 'en']) assert.equal(JSON.parse(read(tmp, `public/js/i18n/${l}.json`)).app.title, 'Invoice Hub');
  assert.match(read(tmp, 'public/index.html'), /<title>Invoice Hub<\/title>/);
  assert.match(read(tmp, 'public/login.html'), /<title>[^<]*Invoice Hub<\/title>/);
  assert.equal(JSON.parse(read(tmp, 'public/manifest.webmanifest')).name, 'Invoice Hub');
  assert.match(read(tmp, 'scripts/prepare-lxc.sh'), /APP_NAME="\$\{APP_NAME:-invoice-hub\}"/);
  assert.match(read(tmp, '.github/workflows/deploy.yml'), /vars\.APP_NAME \|\| 'invoice-hub'/);
  assert.ok(!fs.existsSync(path.join(tmp, 'app.db')), 'lokale DB nicht entfernt');
  assert.doesNotMatch(read(tmp, 'CHANGELOG.md'), /^## \[\d/m);

  // Generic: a renamed project renames again (name read from the tree) —
  // but keeps its own releases, version and data (no second fresh start).
  const pkg = JSON.parse(read(tmp, 'package.json'));
  fs.writeFileSync(path.join(tmp, 'package.json'), `${JSON.stringify({ ...pkg, version: '1.2.0' }, null, 2)}\n`);
  fs.appendFileSync(path.join(tmp, 'CHANGELOG.md'), '\n## [1.2.0] - 2026-01-01\n- own release\n');
  fs.writeFileSync(path.join(tmp, 'app.db'), 'real data');
  const again = init.plan(tmp, 'billing', {});
  assert.equal(again.fresh, false);
  init.apply(tmp, again);
  assert.deepEqual(hits(tmp, 'invoice-hub'), []);
  assert.equal(JSON.parse(read(tmp, 'public/js/i18n/de.json')).app.title, 'billing');
  assert.equal(JSON.parse(read(tmp, 'package.json')).version, '1.2.0');
  assert.match(read(tmp, 'CHANGELOG.md'), /## \[1\.2\.0\]/);
  assert.ok(fs.existsSync(path.join(tmp, 'app.db')), 'zweiter Lauf hat die Projekt-DB gelöscht');
});

test('rename matches whole names only and refuses bad slugs', () => {
  const tmp = copyTree();
  fs.writeFileSync(path.join(tmp, 'docs/x.md'), `${OLD}-extra my-${OLD} \${A:-${OLD}}\n`);
  init.apply(tmp, init.plan(tmp, 'acme', { title: 'Acme' }));
  assert.equal(read(tmp, 'docs/x.md'), `${OLD}-extra my-${OLD} \${A:-acme}\n`);
  assert.throws(() => init.plan(tmp, 'Bad_Slug', {}), /kebab-case/);
  assert.throws(() => init.plan(tmp, 'ok', { title: '<b>' }), /Titel/);
});
