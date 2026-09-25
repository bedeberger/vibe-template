// Gate for "Feature-Registry ist SSoT" + the feature anatomy (CLAUDE.md →
// Harte Regeln; DESIGN.md → "Feature anatomy"):
//   1. every registry entry is a complete feature: card (registered in the card
//      inventory, with lifecycle), domain module, partial rooted in the card,
//      entity CSS, fixture harness + harness spec (scripts/feature-anatomy.js);
//   2. index.html renders the nav AND the feature hosts FROM the registry
//      (x-for over features) — no hand-written per-feature section;
//   3. `.nav-item` appears nowhere else — no parallel nav list.
// Icon and labelKey existence are gated by icons-sprite / i18n-keys-defined.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, walk, toRel, read, stripHtmlComments } = require('../../scripts/hooks/_rules.js');
const anatomy = require('../../scripts/feature-anatomy.js');

// Browser ESM under a CommonJS package.json, without imports → data: URL.
const { FEATURES } = await import(`data:text/javascript,${encodeURIComponent(read('public/js/app/features.js'))}`);
const index = stripHtmlComments(read('public/index.html'));

test('Registry: jedes Feature ist vollständig (Anatomie)', () => {
  assert.ok(Array.isArray(FEATURES) && FEATURES.length > 0, 'FEATURES leer?');
  const v = anatomy.check(ROOT, FEATURES);
  assert.deepEqual(v, [], 'Feature-Anatomie unvollständig (DESIGN.md → Feature anatomy; '
    + `neues Feature: npm run feature:new):\n  ${v.join('\n  ')}`);
});

test('Anatomie-Gate greift (Selbsttest mit einem erfundenen Feature)', () => {
  const v = anatomy.check(ROOT, [{ id: 'zzz-ghost', icon: 'x', labelKey: 'nav.x', card: 'zzzGhostCard', partial: 'zzz-ghost' }]);
  for (const part of ['cards/zzz-ghost-card.js', 'register-cards.js', 'public/js/zzz-ghost/', 'partials/zzz-ghost.html',
    'entities/zzz-ghost.css', 'zzz-ghost-harness.html', 'Harness-Spec']) {
    assert.ok(v.some((x) => x.includes(part)), `Selbsttest: fehlende Meldung für ${part}`);
  }
});

test('index.html: Nav und Feature-Hosts kommen aus der Registry', () => {
  assert.match(index, /<template\b[^>]*x-for="\s*\w+\s+in\s+features\s*"/, 'Nav/Hosts in index.html nicht per x-for aus features');
  assert.match(index, /:data-feature="\s*\w+\.id\s*"/, 'kein registry-getriebener Feature-Host (<section :data-feature="f.id">)');
  assert.doesNotMatch(index, /\sdata-feature="[a-z]/, 'handgeschriebener Feature-Host in index.html — Hosts kommen aus der Registry');
});

test('Navigation kommt aus der Registry, keine Parallel-Liste', () => {
  const navItems = walk('public', ['.html', '.js']).map(toRel)
    .flatMap((f) => [...read(f).matchAll(/(?<![\w-])nav-item(?![\w-])/g)].map(() => f));
  assert.deepEqual(navItems, ['public/index.html'],
    `.nav-item darf genau einmal vorkommen (im x-for-Template der Registry-Nav), gefunden in: ${navItems.join(', ')}`);
});
