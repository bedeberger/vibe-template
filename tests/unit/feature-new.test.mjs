// Unit: the feature generator (scripts/feature-new.js) produces EXACTLY the
// anatomy the gate demands. Runs it in a temp copy of the relevant tree and
// checks the result with the same module the gate uses
// (scripts/feature-anatomy.js) — generator and gate can't drift apart.

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gen = require('../../scripts/feature-new.js');
const anatomy = require('../../scripts/feature-anatomy.js');

const tmps = [];
test.after(() => { for (const t of tmps) fs.rmSync(t, { recursive: true, force: true }); });

function copyTree() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-featnew-'));
  tmps.push(tmp);
  for (const rel of ['public', 'tests/fixtures', 'tests/e2e', 'DESIGN.md']) {
    fs.cpSync(path.join(ROOT, rel), path.join(tmp, rel), {
      recursive: true,
      filter: (src) => !/[\\/](?:vendor|fonts)[\\/]/.test(src),
    });
  }
  return tmp;
}
const features = (root) => {
  const src = fs.readFileSync(path.join(root, 'public/js/app/features.js'), 'utf8');
  return new Function(`${src.replace(/export /g, '')}; return FEATURES;`)();
};

test('generated feature satisfies the anatomy gate and is wired everywhere', () => {
  const tmp = copyTree();
  gen.apply(tmp, gen.plan(tmp, 'demo-board', { labelDe: 'Pinnwand', labelEn: 'Board' }));
  const feats = features(tmp);
  assert.ok(feats.some((f) => f.id === 'demo-board' && f.card === 'demoBoardCard' && f.labelKey === 'nav.demoBoard'));
  assert.deepEqual(anatomy.check(tmp, feats), []);

  const read = (rel) => fs.readFileSync(path.join(tmp, rel), 'utf8');
  for (const l of ['de', 'en']) {
    const j = JSON.parse(read(`public/js/i18n/${l}.json`));
    assert.ok(j.nav.demoBoard && j.demoBoard.title && j.demoBoard.empty, `i18n ${l} unvollständig`);
  }
  const link = '/css/entities/demo-board.css';
  assert.ok(read('public/index.html').includes(link));
  for (const h of fs.readdirSync(path.join(tmp, 'tests/fixtures')).filter((n) => n.endsWith('-harness.html'))) {
    assert.ok(read(`tests/fixtures/${h}`).includes(link), `${h} ohne den neuen <link>`);
  }
  assert.match(read('DESIGN.md'), /\| `css\/entities\/demo-board\.css` \|/);
});

test('generator refuses duplicates, bad ids and unknown icons', () => {
  const tmp = copyTree();
  assert.throws(() => gen.plan(tmp, 'notes', {}), /existiert bereits/);
  assert.throws(() => gen.plan(tmp, 'Bad_Id', {}), /kebab-case/);
  assert.throws(() => gen.plan(tmp, 'ok-id', { icon: 'no-such-icon' }), /Sprite/);
});
