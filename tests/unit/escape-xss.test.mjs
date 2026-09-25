// XSS regression for the escape invariant (CLAUDE.md → Harte Regeln: "x-html
// nur mit vorab-escaptem Content"). There is no runtime sanitizer — the whole
// defence is (a) escHtml() being correct and (b) every x-html sink being fed
// through it. This test pins both:
//   1. escHtml (browser, public/js/utils.js) and its server mirror
//      (lib/escape.js) neutralise the classic payloads and agree byte for byte;
//   2. every `x-html="…"` in public/**/*.html binds a NAMED getter/method whose
//      body calls escHtml() — an inline expression (`x-html="note.body"`) or a
//      getter that forgot to escape is red. Add a new sink = add a getter that
//      escapes first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripHtmlComments, stripJsComments, lineOf } = require('../../scripts/hooks/_rules.js');
const server = require('../../lib/escape.js');

// public/js is browser ESM under a CommonJS package.json — load the source via
// a data: URL (utils.js has no imports) instead of a plain import.
const browser = await import(`data:text/javascript,${encodeURIComponent(read('public/js/utils.js'))}`);

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '"><svg onload=alert(1)>',
  "'\"><body onload=alert(1)>",
  '<a href="javascript:alert(1)">x</a>',
];

for (const [name, escHtml] of [['browser', browser.escHtml], ['server', server.escHtml]]) {
  test(`escHtml (${name}): Payloads enthalten kein ungeschuetztes < > " '`, () => {
    for (const p of PAYLOADS) {
      const out = escHtml(p);
      assert.ok(!/[<>"']/.test(out), `payload "${p}" → "${out}"`);
    }
    assert.equal(escHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test(`escHtml (${name}): & zuerst (kein Double-Encode), null/undefined → ''`, () => {
    assert.equal(escHtml('a & b'), 'a &amp; b');
    assert.equal(escHtml('<&>'), '&lt;&amp;&gt;');
    assert.equal(escHtml(null), '');
    assert.equal(escHtml(undefined), '');
    assert.equal(escHtml(0), '0');
  });
}

test('escHtml: Browser- und Server-Variante sind identisch', () => {
  for (const p of [...PAYLOADS, 'plain', '&amp;', "it's", 42]) {
    assert.equal(browser.escHtml(p), server.escHtml(p), `Drift bei ${JSON.stringify(p)}`);
  }
});

// Body of `get name() { … }` / `name(…) { … }` in a JS source (balanced braces).
function memberBody(src, name) {
  const re = new RegExp(`(?:^|[\\s,{])(?:get\\s+)?(?:async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  return null;
}

test('jede x-html-Sink bindet einen Getter, der escHtml() aufruft', () => {
  const js = walk('public/js', ['.js', '.mjs']).map(toRel).map((f) => [f, stripJsComments(read(f))]);
  const sinks = [];
  const violations = [];
  for (const f of walk('public', ['.html']).map(toRel)) {
    const html = stripHtmlComments(read(f));
    for (const m of html.matchAll(/(?<![\w-])x-html\s*=\s*"([^"]*)"/g)) {
      const where = `${f}:${lineOf(html, m.index)}`;
      sinks.push(where);
      const id = m[1].trim().match(/^([A-Za-z_$][\w$]*)(?:\(\s*\))?$/);
      if (!id) { violations.push(`${where}: x-html="${m[1]}" — nur einen benannten Getter binden, keinen Ausdruck`); continue; }
      const bodies = js.map(([, src]) => memberBody(src, id[1])).filter(Boolean);
      if (!bodies.length) violations.push(`${where}: Getter/Methode "${id[1]}" in public/js nicht gefunden`);
      else if (!bodies.every((b) => /\bescHtml\(/.test(b))) violations.push(`${where}: "${id[1]}" ruft escHtml() nicht auf`);
    }
  }
  assert.ok(sinks.length > 0, 'keine x-html-Sink gefunden — Scan kaputt? (die Notiz-Karte hat eine)');
  assert.deepEqual(violations, [], `x-html ohne vorab-escapten Content:\n  ${violations.join('\n  ')}`);
});
