// Guard for the action icon library (DESIGN.md → "Action icon library").
// Binding frontend invariant: action buttons use sprite icons
// (<svg class="icon"><use href="/icons.svg#…"/></svg>), never classic Unicode
// glyphs as the icon (×, ✕, ↑, ↓, ‹ …). Red as soon as a feature introduces a
// glyph button, an `.icon-btn` without a sprite icon, or a plain text button
// in a `.card-actions` header cluster.
//
// NOT checked on purpose: labelled primary form actions outside `.card-actions`
// (Save/Cancel in a form footer) — they keep their label. Inside `.card-actions`
// a deliberately labelled button says so with `data-label-ok`; `.tabs-btn`
// mode toggles are their own label pattern.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { walk, toRel, read, stripHtmlComments, lineOf } = require('../../scripts/hooks/_rules.js');

const FORBIDDEN_GLYPHS = new Set(['×', '✕', '✖', '⨯', '↑', '↓', '←', '→', '«', '»', '‹', '›', '⤢', '⛶', '▾', '▴', '▸', '◂', '＋', '−', '✓', '✔', '⋯', '…']);
const FORBIDDEN_ENTITIES = /&(?:times|larr|rarr|uarr|darr|laquo|raquo|lsaquo|rsaquo|hellip|check);|&#x(?:2715|d7|2191|2193|2190|2192|2713|22ef);|&#(?:215|10005|8592|8593|8594|8595);/i;

const SOURCES = walk('public', ['.html']).map(toRel).map((f) => [f, stripHtmlComments(read(f))]);

// <button>/<a> elements (they don't nest) with attrs + inner markup.
function controls(html) {
  return [...html.matchAll(/<(button|a)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1>/g)]
    .map((m) => ({ tag: m[1], attrs: m[2], inner: m[3], index: m.index }));
}

const visibleText = (inner) => inner.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
const hasClass = (attrs, c) => new RegExp(`\\bclass="[^"]*(?<![\\w-])${c}(?![\\w-])`).test(attrs);
const hasSpriteIcon = (inner) => /<svg\b[^>]*\bclass="[^"]*\bicon\b/.test(inner) && /<use\b/.test(inner);

// Balanced <div class="… card-actions …"> regions → [start, end).
function cardActionsRegions(src) {
  const regions = [];
  for (const m of src.matchAll(/<div\b[^>]*\bclass="[^"]*(?<![\w-])card-actions(?![\w-])[^"]*"[^>]*>/g)) {
    const tagRe = /<(\/?)div\b[^>]*>/g;
    tagRe.lastIndex = m.index;
    let depth = 0;
    let end = src.length;
    let t;
    while ((t = tagRe.exec(src)) !== null) {
      depth += t[1] === '/' ? -1 : 1;
      if (depth === 0) { end = tagRe.lastIndex; break; }
    }
    regions.push([m.index, end]);
  }
  return regions;
}

test('Buttons: keine Unicode-Glyphen als Icon-Inhalt', () => {
  const offenders = [];
  for (const [file, html] of SOURCES) {
    for (const c of controls(html)) {
      if (c.tag === 'a' && !hasClass(c.attrs, 'icon-btn')) continue;
      const txt = visibleText(c.inner);
      if (FORBIDDEN_ENTITIES.test(c.inner) || (txt && [...txt].every((ch) => FORBIDDEN_GLYPHS.has(ch)))) {
        offenders.push(`${file}:${lineOf(html, c.index)}: Glyph-Icon "${txt}" → <svg class="icon"><use href="/icons.svg#…"/></svg>`);
      }
    }
  }
  assert.deepEqual(offenders, [], `Klassische Glyph-Buttons (DESIGN.md → Action icon library):\n  ${offenders.join('\n  ')}`);
});

test('jeder .icon-btn enthaelt ein Sprite-Icon (<svg class="icon"><use…>)', () => {
  const offenders = [];
  let seen = 0;
  for (const [file, html] of SOURCES) {
    for (const c of controls(html)) {
      if (!hasClass(c.attrs, 'icon-btn')) continue;
      seen++;
      if (!hasSpriteIcon(c.inner)) offenders.push(`${file}:${lineOf(html, c.index)}: .icon-btn ohne <svg class="icon"><use…>`);
    }
  }
  assert.ok(seen >= 3, `nur ${seen} .icon-btn gefunden — Scan kaputt?`);
  assert.deepEqual(offenders, [], `.icon-btn ohne Sprite-Icon:\n  ${offenders.join('\n  ')}`);
});

test('keine klassischen Text-Buttons in .card-actions (Icon oder data-label-ok)', () => {
  const offenders = [];
  for (const [file, html] of SOURCES) {
    const regions = cardActionsRegions(html);
    for (const c of controls(html)) {
      if (c.tag !== 'button' || !regions.some(([a, b]) => c.index >= a && c.index < b)) continue;
      if (hasClass(c.attrs, 'tabs-btn')) continue;
      if (!/<svg\b/.test(c.inner) && !/(^|\s)data-label-ok(\s|=|$)/.test(c.attrs)) {
        offenders.push(`${file}:${lineOf(html, c.index)}: Text-Button in .card-actions → Icon-Button oder data-label-ok`);
      }
    }
  }
  assert.deepEqual(offenders, [], `Klassische Text-Buttons in einer Action-Leiste:\n  ${offenders.join('\n  ')}`);
});
