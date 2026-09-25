// Tripwire for the format of icon-only action buttons (DESIGN.md → "Action
// icon library", reference: the note card's .card-actions in
// public/partials/notes-view.html).
//
// An icon-only button (visible content = only an `<svg class="icon">`, no text,
// no x-text) has no visible name — tooltip + accessible name are mandatory,
// otherwise it is mute for screen readers and hover users. So the clusters
// don't drift apart per card (sometimes with tooltip, sometimes without; SVG
// sometimes exposed), every icon-only `.icon-btn` / `.btn-card-close` /
// `.btn-close` / `.job-toast-close` anywhere in public/**/*.html carries:
//   1. `type="button"` (on <button>) — no accidental form submit
//   2. `aria-label` / `:aria-label` — name for screen readers
//   3. `data-tip` / `:data-tip` — hover tooltip (not `title`, see DESIGN.md);
//      exempt: `.btn-close` / `.job-toast-close`, whose host (dialog, toast)
//      already names the close action visually
//   4. inner `<svg … aria-hidden="true">` — the icon itself stays unexposed

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripHtmlComments, lineOf } = require('../../scripts/hooks/_rules.js');

const FAMILY = ['icon-btn', 'btn-card-close', 'btn-close', 'job-toast-close'];
const TIP_EXEMPT = ['btn-close', 'job-toast-close'];

function scan(html, file) {
  const violations = [];
  let found = 0;
  for (const m of html.matchAll(/<(button|a)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1>/g)) {
    const [, tag, attrs, body] = m;
    const cls = ((attrs.match(/(?:^|\s)class="([^"]*)"/) || [])[1] || '').split(/\s+/);
    const family = FAMILY.filter((c) => cls.includes(c));
    if (!family.length) continue;
    if (!/<svg\b[^>]*class="[^"]*\bicon\b/.test(body)) continue;
    if (body.replace(/<[^>]+>/g, '').replace(/\s+/g, '') !== '' || /x-text\s*=/.test(body)) continue;
    found++;
    const probs = [];
    if (tag === 'button' && !/(^|\s)type="button"/.test(attrs)) probs.push('type="button" fehlt');
    if (!/(^|\s):?aria-label\s*=/.test(attrs)) probs.push('aria-label fehlt');
    if (!family.every((c) => TIP_EXEMPT.includes(c)) && !/(^|\s):?data-tip\s*=/.test(attrs)) probs.push('data-tip fehlt');
    if (/(^|\s):?title\s*=/.test(attrs)) probs.push('title statt data-tip');
    if (!/<svg\b[^>]*\baria-hidden="true"/.test(body)) probs.push('svg aria-hidden="true" fehlt');
    if (probs.length) violations.push(`${file}:${lineOf(html, m.index)}: ${probs.join(', ')}`);
  }
  return { found, violations };
}

const results = walk('public', ['.html']).map(toRel).map((f) => scan(stripHtmlComments(read(f)), f));

test('Icon-only-Action-Buttons: type=button + aria-label + data-tip + aria-hidden svg', () => {
  const violations = results.flatMap((r) => r.violations);
  assert.deepEqual(violations, [],
    `Icon-only-Button weicht vom Action-Icon-Format ab:\n  ${violations.join('\n  ')}`);
});

test('Scanner findet Icon-only-Buttons (kein vacuous pass)', () => {
  const total = results.reduce((n, r) => n + r.found, 0);
  assert.ok(total >= 4, `nur ${total} Icon-only-Buttons gefunden — Scanner vermutlich defekt.`);
  const bad = scan('<button class="icon-btn"><svg class="icon"><use href="/icons.svg#x"/></svg></button>', 't');
  assert.equal(bad.found, 1);
  assert.match(bad.violations[0], /type="button" fehlt, aria-label fehlt, data-tip fehlt, svg aria-hidden/);
});
