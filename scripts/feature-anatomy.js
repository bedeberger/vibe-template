'use strict';
// The anatomy of a frontend feature — ONE definition, used by the unit gate
// (tests/unit/feature-registry.test.mjs) and by the generator
// (scripts/feature-new.js, which must produce exactly this). Documented in
// DESIGN.md → "Feature-Anatomie".
//
// For a registry entry { id: 'notes', view: 'user', card: 'notesCard', partial: 'notes' }:
//   public/js/cards/notes-card.js        Alpine.data('notesCard') + registerNotesCard()
//   public/js/app/register-cards.js      imports + calls registerNotesCard
//   public/js/notes/                     domain module(s) (notes-methods.js …)
//   public/partials/notes.html           root element x-data="notesCard"
//   public/css/entities/notes.css        feature CSS (deviations only)
//   tests/fixtures/notes-harness.html    mountFeature('notes')
//   tests/e2e/notes-*.spec.js            harness spec(s)
//
// Why a gate: every missing piece fails SILENTLY — an unregistered card renders
// nothing (no error), a missing partial leaves an empty host, a feature without
// a harness spec has only the smoke's "it renders" as safety net.

const fs = require('fs');
const path = require('path');

// The two views of the app (docs/auth.md): every feature belongs to exactly one.
const VIEWS = ['user', 'admin'];

// kebab-case: segments of [a-z0-9] joined by single hyphens, starting with a
// letter — no 'foo--bar', no trailing 'foo-' (hash route, file stem, camelCase key).
const ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const pascal = (id) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

function paths(f) {
  return {
    card: `public/js/cards/${f.id}-card.js`,
    domain: `public/js/${f.id}`,
    partial: `public/partials/${f.partial}.html`,
    css: `public/css/entities/${f.id}.css`,
    harness: `tests/fixtures/${f.id}-harness.html`,
    specPrefix: `tests/e2e/${f.id}-`,
    register: `register${pascal(f.id)}Card`,
  };
}

function check(root, features) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const v = [];
  const registerCards = exists('public/js/app/register-cards.js') ? read('public/js/app/register-cards.js') : '';
  const ids = new Set();
  const cards = new Set();

  for (const f of features) {
    const where = `Feature "${f.id}"`;
    for (const k of ['id', 'icon', 'labelKey', 'card', 'partial']) {
      if (typeof f[k] !== 'string' || !f[k]) v.push(`${where}: Feld "${k}" fehlt`);
    }
    if (!VIEWS.includes(f.view)) v.push(`${where}: Feld "view" muss ${VIEWS.join(' | ')} sein (welche Sicht zeigt es)`);
    if (!ID_RE.test(f.id || '')) v.push(`${where}: id muss kebab-case sein (Hash-Route, Dateistamm)`);
    if (ids.has(f.id)) v.push(`${where}: doppelte id`);
    if (cards.has(f.card)) v.push(`${where}: Karte "${f.card}" doppelt vergeben`);
    ids.add(f.id); cards.add(f.card);
    const p = paths(f);

    if (!exists(p.card)) v.push(`${where}: ${p.card} fehlt`);
    else {
      const src = read(p.card);
      if (!src.includes(`Alpine.data('${f.card}'`)) v.push(`${where}: ${p.card} registriert Alpine.data('${f.card}') nicht`);
      if (!new RegExp(`export function ${p.register}\\b`).test(src)) v.push(`${where}: ${p.card} exportiert ${p.register}() nicht`);
      if (!/setupCardLifecycle\(/.test(src)) v.push(`${where}: ${p.card} nutzt setupCardLifecycle nicht (laden/refresh/reset)`);
    }
    if (!new RegExp(`import \\{ ${p.register} \\} from '\\.\\./cards/${f.id}-card\\.js'`).test(registerCards)
      || !new RegExp(`\\b${p.register}\\(Alpine\\)`).test(registerCards)) {
      v.push(`${where}: public/js/app/register-cards.js importiert/ruft ${p.register} nicht — die Karte rendert sonst STUMM nichts`);
    }
    if (!exists(p.domain) || !fs.statSync(path.join(root, p.domain)).isDirectory()) v.push(`${where}: Fachmodul-Ordner ${p.domain}/ fehlt`);
    if (!exists(p.partial)) v.push(`${where}: ${p.partial} fehlt`);
    else {
      const first = read(p.partial).replace(/<!--[\s\S]*?-->/g, '').match(/<[a-z][^>]*>/i);
      if (!first || !first[0].includes(`x-data="${f.card}"`)) {
        v.push(`${where}: das erste Element von ${p.partial} muss x-data="${f.card}" tragen (die Feature-Karte ist die Wurzel)`);
      }
    }
    if (!exists(p.css)) v.push(`${where}: ${p.css} fehlt`);
    if (!exists(p.harness)) v.push(`${where}: ${p.harness} fehlt`);
    else if (!read(p.harness).includes(`mountFeature('${f.id}')`)) v.push(`${where}: ${p.harness} ruft mountFeature('${f.id}') nicht`);
    const e2eDir = path.join(root, 'tests/e2e');
    const specs = fs.existsSync(e2eDir) ? fs.readdirSync(e2eDir).filter((n) => n.startsWith(`${f.id}-`) && n.endsWith('.spec.js')) : [];
    if (!specs.length) v.push(`${where}: kein Harness-Spec ${p.specPrefix}*.spec.js`);
  }
  return v;
}

module.exports = { paths, check, pascal, VIEWS, ID_RE };
