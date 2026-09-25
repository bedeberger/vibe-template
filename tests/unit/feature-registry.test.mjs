// Gate for "Feature-Registry ist SSoT" (CLAUDE.md → Harte Regeln):
// public/js/app/features.js is the single source for navigation.
//   1. every entry has id / icon / labelKey / view, ids are unique;
//   2. every entry's view is mounted in public/index.html
//      (`x-show="… activeFeature === '<id>'"`) — a registry entry without a
//      view is a dead nav button;
//   3. the nav is rendered FROM the registry (`x-for="… in features"`) and
//      `.nav-item` appears nowhere else — no hand-maintained parallel list.
// Icon and labelKey existence are gated by icons-sprite / i18n-keys-defined.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripHtmlComments } = require('../../scripts/hooks/_rules.js');

// Browser ESM under a CommonJS package.json, without imports → data: URL.
const { FEATURES } = await import(`data:text/javascript,${encodeURIComponent(read('public/js/app/features.js'))}`);
const index = stripHtmlComments(read('public/index.html'));

test('Registry: Pflichtfelder + eindeutige ids', () => {
  assert.ok(Array.isArray(FEATURES) && FEATURES.length > 0, 'FEATURES leer?');
  for (const f of FEATURES) {
    for (const k of ['id', 'icon', 'labelKey', 'view']) {
      assert.ok(typeof f[k] === 'string' && f[k], `Feature ${JSON.stringify(f)}: Feld "${k}" fehlt`);
    }
  }
  const ids = FEATURES.map((f) => f.id);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], 'doppelte Feature-ids');
});

test('Registry: jede View ist in index.html montiert', () => {
  const missing = FEATURES.filter((f) => !new RegExp(`activeFeature\\s*===\\s*'${f.id}'`).test(index)).map((f) => f.id);
  assert.deepEqual(missing, [], `Features ohne View-Section in index.html (x-show="… activeFeature === '<id>'"): ${missing.join(', ')}`);
});

test('Navigation kommt aus der Registry, keine Parallel-Liste', () => {
  assert.match(index, /<template\b[^>]*x-for="\s*\w+\s+in\s+features\s*"/, 'Nav in index.html rendert nicht per x-for aus features');
  const navItems = walk('public', ['.html', '.js']).map(toRel)
    .flatMap((f) => [...read(f).matchAll(/(?<![\w-])nav-item(?![\w-])/g)].map(() => f));
  assert.deepEqual(navItems, ['public/index.html'],
    `.nav-item darf genau einmal vorkommen (im x-for-Template der Registry-Nav), gefunden in: ${navItems.join(', ')}`);
});
