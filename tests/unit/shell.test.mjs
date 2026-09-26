// Pure helpers of the app shell (public/js/app/shell.js, DESIGN.md →
// "Command Palette", "Benutzermenü"): the palette filter over the registry and
// the avatar initials. The DOM behaviour (drawer, rail, palette dialog) is
// covered in tests/e2e-app/shell.spec.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { read } = require('../../scripts/hooks/_rules.js');

// Browser ESM under a CommonJS package.json, import-free → load via data: URL.
const shell = await import(`data:text/javascript,${encodeURIComponent(read('public/js/app/shell.js'))}`);

const FEATURES = [
  { id: 'notes', view: 'user', labelKey: 'nav.notes' },
  { id: 'users', view: 'admin', labelKey: 'nav.users' },
  { id: 'settings', view: 'admin', labelKey: 'nav.settings' },
];
const LABELS = { 'nav.notes': 'Notizen', 'nav.users': 'Benutzer', 'nav.settings': 'Einstellungen' };
const label = (f) => LABELS[f.labelKey];

test('paletteMatches: leere Suche liefert alle Features in Registry-Reihenfolge (Kopie)', () => {
  const all = shell.paletteMatches(FEATURES, '  ', label);
  assert.deepEqual(all.map((f) => f.id), ['notes', 'users', 'settings']);
  assert.notEqual(all, FEATURES, 'eine Kopie, nicht die Registry selbst');
});

test('paletteMatches: filtert nach übersetztem Label, case-insensitiv, und nach id', () => {
  assert.deepEqual(shell.paletteMatches(FEATURES, 'EIN', label).map((f) => f.id), ['settings']);
  assert.deepEqual(shell.paletteMatches(FEATURES, 'user', label).map((f) => f.id), ['users']);
  assert.deepEqual(shell.paletteMatches(FEATURES, 'zzz', label), []);
});

test('initialsOf: Name vor E-Mail, max. zwei Buchstaben, Fallback "?"', () => {
  assert.equal(shell.initialsOf({ display_name: 'Ada Lovelace', email: 'x@y.ch' }), 'AL');
  assert.equal(shell.initialsOf({ email: 'david.berger@example.ch' }), 'DB');
  assert.equal(shell.initialsOf({ email: 'admin@example.ch' }), 'AD');
  assert.equal(shell.initialsOf(null), '?');
});

test('THEME_OPTIONS: genau die Modi von theme-boot.js, jede Option mit Icon + labelKey', () => {
  const boot = read('public/js/theme-boot.js');
  const modes = JSON.parse(boot.match(/var MODES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(shell.THEME_OPTIONS.map((o) => o.mode), modes);
  for (const o of shell.THEME_OPTIONS) assert.ok(o.icon && o.labelKey.startsWith('shell.'), o.mode);
});
