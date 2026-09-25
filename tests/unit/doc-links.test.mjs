// Drift guard for the documentation graph: every relative Markdown link in the
// repo's docs (CLAUDE.md at any depth, DESIGN.md, README.md, CHANGELOG.md,
// docs/**, .claude/**) points to a file that exists, and every `#anchor` into
// a Markdown file matches one of its headings (GitHub slug rules). The docs
// are the map an agent navigates by — a dead link after a move or rename
// sends it to a file that no longer exists, silently.
//
// .claude/** files link repo-root-relative (Claude Code convention).
// Skipped: external URLs (http/https/mailto), links inside fenced code blocks
// and inline code (examples, e.g. the DESIGN.md doc template).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ROOT, walk, toRel, read } = require('../../scripts/hooks/_rules.js');

const DOCS = walk(ROOT, ['.md']).map(toRel).filter((f) => !f.startsWith('tests/fixtures/'));

// GitHub heading slug: lowercase, drop punctuation (keep letters/digits/space/-/_), spaces → '-'.
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');

const stripCode = (md) => md.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');

const anchorsCache = new Map();
function anchorsOf(rel) {
  if (!anchorsCache.has(rel)) {
    const md = read(rel).replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
    const seen = new Map();
    const set = new Set();
    for (const m of md.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      const base = slug(m[1]);
      const n = seen.get(base) || 0;
      set.add(n ? `${base}-${n}` : base);
      seen.set(base, n + 1);
    }
    for (const m of md.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) set.add(m[1]);
    anchorsCache.set(rel, set);
  }
  return anchorsCache.get(rel);
}

function brokenLinks(file) {
  const out = [];
  const md = stripCode(read(file));
  for (const m of md.matchAll(/\[(?:[^\]\n]|\][^(\n])*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const target = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue; // http:, mailto:, …
    const [pathPart, anchor] = target.split('#');
    const decoded = decodeURIComponent(pathPart);
    // .claude/** (commands, skills) link repo-root-relative — Claude Code resolves them from the project dir.
    const base = file.startsWith('.claude/') ? ROOT : dirname(join(ROOT, file));
    const abs = decoded ? join(base, decoded) : join(ROOT, file);
    const rel = relative(ROOT, abs).split('\\').join('/');
    if (decoded && !existsSync(abs)) { out.push(`${file}: → ${target} (Datei fehlt)`); continue; }
    if (anchor && rel.endsWith('.md') && statSync(abs).isFile() && !anchorsOf(rel).has(anchor.toLowerCase())) {
      out.push(`${file}: → ${target} (Anker fehlt in ${rel})`);
    }
  }
  return out;
}

test('Doku-Links zeigen auf existierende Dateien + Anker', () => {
  assert.ok(DOCS.includes('CLAUDE.md') && DOCS.includes('DESIGN.md'), 'CLAUDE.md/DESIGN.md nicht gefunden — Scan kaputt?');
  const broken = DOCS.flatMap(brokenLinks);
  assert.deepEqual(broken, [], `Tote Links in der Doku (Ziel verschoben/umbenannt?):\n  ${broken.join('\n  ')}`);
});

test('Slug-Regeln wie GitHub (kein vacuous pass)', () => {
  assert.equal(slug('Tabs / mode toggle'), 'tabs--mode-toggle');
  assert.equal(slug('Card (`.card`)'), 'card-card');
  assert.equal(slug('Doc template (Pflicht für neue Sections)'), 'doc-template-pflicht-für-neue-sections');
});
