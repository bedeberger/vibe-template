// Gate for "Styles nur in public/css/" (CLAUDE.md → Harte Regeln): no inline
// `style="…"` attribute and no `<style>` block — neither in markup
// (public/**/*.html, public/**/*.svg) nor in browser-JS template strings, and
// no imperative inline styling from JS (`el.style.color = …`, cssText,
// setAttribute('style')).
//
// The ONE allowed exception: an Alpine OBJECT-form binding that only sets
// custom properties — `:style="{ '--progress': pct + '%' }"` — and its JS
// twin `el.style.setProperty('--x', …)`. The value is runtime data, the
// styling stays in CSS. String/array forms and real properties are banned.
//
// The detection lives in scripts/hooks/_rules.js and is shared with the
// style-guard.js PreToolUse hook, which BLOCKS the same thing at edit time.
// public/vendor/** is third-party and excluded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, markupStyleViolations, jsStyleViolations } = require('../../scripts/hooks/_rules.js');

const fmt = (file, hits) => hits.map((h) => `${file}:${h.line}: ${h.msg}`);

test('kein Inline-Style / <style> in public/**/*.html + *.svg', () => {
  const files = walk('public', ['.html', '.svg']).map(toRel);
  assert.ok(files.some((f) => f.endsWith('index.html')), 'index.html nicht gefunden — Scan kaputt?');
  const violations = files.flatMap((f) => fmt(f, markupStyleViolations(read(f))));
  assert.equal(violations.length, 0,
    'Inline-Styles gefunden — CSS gehoert in ein Modul unter public/css/ (Laufzeitwerte nur als '
    + `:style="{ '--x': … }"):\n  ${violations.join('\n  ')}`);
});

test('kein Inline-Style in Browser-JS (Template-Strings + el.style)', () => {
  const files = walk('public/js', ['.js', '.mjs']).map(toRel);
  assert.ok(files.length > 3, 'kaum JS gefunden — Scan kaputt?');
  const violations = files.flatMap((f) => fmt(f, jsStyleViolations(read(f))));
  assert.equal(violations.length, 0,
    'Inline-Styles aus JS — Klasse toggeln oder el.style.setProperty(\'--x\', …) + CSS-Regel:\n  '
    + violations.join('\n  '));
});

test('Scanner: Verbote greifen, Custom-Prop-Objekt-Form bleibt erlaubt', () => {
  const bad = [
    '<div style="color:red"></div>',
    "<div style='x'></div>",
    '<style>.a{}</style>',
    '<div :style="\'color: red\'"></div>',
    '<div :style="{ color: c }"></div>',
    '<div x-bind:style="{ \'--x\': 1, width: w }"></div>',
  ];
  for (const s of bad) assert.equal(markupStyleViolations(s).length, 1, `nicht erkannt: ${s}`);
  const good = [
    '<div :style="{ \'--progress\': pct + \'%\' }"></div>',
    '<div x-bind:style="{ \'--a\': open ? 1 : 0, \'--b\': n }"></div>',
    '<div data-style="x"></div>',
    '<!-- style="documented" -->',
  ];
  for (const s of good) assert.equal(markupStyleViolations(s).length, 0, `faelschlich erkannt: ${s}`);
  assert.equal(jsStyleViolations("el.style.color = 'red';").length, 1);
  assert.equal(jsStyleViolations('el.style.cssText = s;').length, 1);
  assert.equal(jsStyleViolations("el.setAttribute('style', s);").length, 1);
  assert.equal(jsStyleViolations("el.style.setProperty('color', c);").length, 1);
  assert.equal(jsStyleViolations("el.style.setProperty('--x', c);").length, 0);
  assert.equal(jsStyleViolations("const h = `<b style=\"x\">`;").length, 1);
  assert.equal(jsStyleViolations("// el.style.color = 'red'").length, 0);
});
