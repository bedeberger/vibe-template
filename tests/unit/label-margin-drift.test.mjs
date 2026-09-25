// Tripwire for the centre-line invariant: a control in a row with
// `align-items: center` must not carry a ONE-SIDED vertical margin. Flex
// centres the OUTER box — a margin only at the bottom tips the visible box by
// half the margin against the neighbours' centre line (6px → 3px off: visibly
// "not centred", but not recognisable as a margin by eye).
//
// Main entry point is the global `label` rule: it applies to EVERY label, also
// to toggle labels in filter bars and inline fields. With a bottom margin all
// those rows tip at once. Vertical spacing therefore comes only from the
// container's `gap`; a label used as a block heading sets its spacing locally
// in its own class.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripCssComments } = require('../../scripts/hooks/_rules.js');

// Flat rule blocks { selector, body } (at-rule wrappers don't change the invariant).
function ruleBlocks(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    if (selector && !selector.startsWith('@')) out.push({ selector, body: m[2] });
  }
  return out;
}

const declValue = (body, prop) => {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

const CSS = walk('public/css', ['.css']).map(toRel).map((f) => [f, stripCssComments(read(f))]);

test('globale label-Regel setzt keine vertikale Margin', () => {
  const offenders = [];
  let globalLabelRules = 0;
  for (const [file, css] of CSS) {
    for (const { selector, body } of ruleBlocks(css)) {
      if (!selector.split(',').some((s) => s.trim() === 'label')) continue;
      globalLabelRules++;
      for (const prop of ['margin-bottom', 'margin-top', 'margin-block-start', 'margin-block-end', 'margin-block', 'margin']) {
        const v = declValue(body, prop);
        if (v && !/^0(\D|$)/.test(v)) offenders.push(`${file}: label { ${prop}: ${v} }`);
      }
    }
  }
  assert.ok(globalLabelRules > 0, 'keine globale label-Regel gefunden — Scan kaputt?');
  assert.deepEqual(offenders, [],
    'Die globale `label`-Regel darf keine vertikale Margin setzen — sie kippt jedes Toggle-/Inline-Label '
    + 'in einer `align-items: center`-Zeile. Abstand gehoert ins `gap` des Containers; Block-Ueberschriften '
    + `setzen ihn lokal in ihrer eigenen Klasse:\n  ${offenders.join('\n  ')}`);
});

// Members of centred rows (filter bar, inline field).
const ROW_MEMBERS = ['.filter-toggle', '.filter-count', '.filter-search-input', '.form-inline-field'];

test('Glieder zentrierter Leisten tragen keine einseitige vertikale Margin', () => {
  const offenders = [];
  for (const [file, css] of CSS) {
    for (const { selector, body } of ruleBlocks(css)) {
      const hit = selector.split(',').map((s) => s.trim())
        .some((s) => ROW_MEMBERS.includes(s.split(/[\s>+~]+/).pop().replace(/:.*$/, '')));
      if (!hit) continue;
      const mt = declValue(body, 'margin-top');
      const mb = declValue(body, 'margin-bottom');
      const num = (v) => (v == null ? 0 : parseFloat(v) || (/var\(/.test(v) ? 1 : 0));
      if ((mt == null) !== (mb == null) ? (num(mt) || num(mb)) : (mt != null && mt !== mb)) {
        offenders.push(`${file}: ${selector} { margin-top: ${mt}; margin-bottom: ${mb} }`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `Einseitige vertikale Margin an einem Glied einer zentrierten Leiste:\n  ${offenders.join('\n  ')}`);
});
