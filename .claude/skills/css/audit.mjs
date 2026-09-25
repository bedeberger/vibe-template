#!/usr/bin/env node
/**
 * CSS-Audit — die MESSUNG hinter dem css-Skill.
 *
 * Kein Urteil, nur Zahlen: was der Browser lädt, wie viel davon Prosa ist,
 * welche Tokens niemand mehr liest, welche Deklarations-Gruppe sich so oft
 * wiederholt, dass sie ein Muster wäre.
 *
 * Aufruf (aus dem Repo-Root):
 *   node .claude/skills/css/audit.mjs            # Übersicht
 *   node .claude/skills/css/audit.mjs --json     # maschinenlesbar
 *   node .claude/skills/css/audit.mjs --cluster 15
 *
 * Absichtlich abhängigkeitsfrei und ausserhalb von `scripts/`: das ist
 * Werkzeug der Arbeitsweise, kein Bestandteil der App (und damit kein
 * npm-Script, das im Rebase kollidiert).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const CSS_DIR = join(ROOT, 'public', 'css');
const CAP_LOC = 600; // loc-limits.test.mjs: CSS > 600 LOC wird geteilt

/**
 * Erklärte Reserve — deklariert, absichtlich (noch) von niemandem gelesen.
 * Dasselbe Idiom wie die ALLOWLIST in file-limits.test.mjs: eine Ausnahme
 * braucht einen Grund, sonst ist sie ein Befund. Die Begründung selbst steht
 * am Token (tokens/colors.css), nicht hier.
 */
// Template-Skala: the design system ships its full token scale (from
// schreibwerkstatt); the example view doesn't read every step yet. Remove an
// entry once something reads the token — or delete the token if the project
// decides it will never need it.
const TOKEN_RESERVE = new Map([
  ['--color-faint', 'Template-Skala'],
  ['--color-text-inverse', 'Template-Skala'],
  ['--color-hover-strong', 'Template-Skala'],
  ['--color-accent-bg', 'Template-Skala'],
  ['--color-accent-text', 'Template-Skala'],
  ['--color-accent-hover', 'Template-Skala'],
  ['--color-on-accent', 'Template-Skala'],
  ['--color-running', 'Template-Skala'],
  ['--color-pending', 'Template-Skala'],
  ['--color-err-light', 'Template-Skala'],
  ['--shadow-inset-top', 'Template-Skala'],
  ['--opacity-muted', 'Template-Skala'],
  ['--opacity-faint', 'Template-Skala'],
  ['--opacity-strong', 'Template-Skala'],
  ['--z-base', 'Template-Skala'],
  ['--z-header', 'Template-Skala'],
  ['--z-overlay', 'Template-Skala'],
  ['--z-modal', 'Template-Skala'],
  ['--z-modal-front', 'Template-Skala'],
  ['--pad-btn-compact', 'Template-Skala'],
  ['--pad-detail', 'Template-Skala'],
  ['--font-size-micro', 'Template-Skala'],
  ['--font-size-xl', 'Template-Skala'],
  ['--font-em-80', 'Template-Skala'],
  ['--font-em-85', 'Template-Skala'],
  ['--font-em-90', 'Template-Skala'],
]);

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const clusterTop = Number(argv[argv.indexOf('--cluster') + 1]) || 10;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

const files = walk(CSS_DIR).sort();

// Kommentare streichen. Liefert der Server CSS einmal ohne Kommentare aus
// (lib/css-asset.js mit `stripComments`), nimmt der Audit DENSELBEN Code — sonst
// gilt der Rückfall unten.
let strip;
try {
  ({ stripComments: strip } = createRequire(import.meta.url)(join(ROOT, 'lib', 'css-asset.js')));
} catch {
  strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ── 1. Umfang: was liegt da, was geht über die Leitung ──────────────────────
let loc = 0;
let commentLines = 0;
let blankLines = 0;
let bytesRaw = 0;
let bytesBare = 0;
const perFolder = new Map();
const tooBig = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const bare = strip(src);
  const lines = src.split('\n');
  loc += lines.length;
  blankLines += lines.filter((l) => !l.trim()).length;
  for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) commentLines += m[0].split('\n').length;
  bytesRaw += Buffer.byteLength(src);
  bytesBare += Buffer.byteLength(bare);

  const rel = relative(CSS_DIR, f);
  const folder = rel.includes(sep) ? rel.split(sep)[0] : '(root)';
  const e = perFolder.get(folder) || { files: 0, loc: 0 };
  e.files += 1;
  e.loc += lines.length;
  perFolder.set(folder, e);

  if (lines.length > CAP_LOC) tooBig.push({ file: rel, loc: lines.length });
}

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const allRaw = Buffer.concat(files.map((f) => readFileSync(f)));
const allBare = Buffer.from(files.map((f) => strip(readFileSync(f, 'utf8'))).join('\n'));

// ── 2. Regelblöcke, Deklarationen, Cluster ─────────────────────────────────
let blocks = 0;
const decls = new Map(); // "prop: value" → n
const clusters = new Map(); // flex/grid-Signatur → n
const bodies = new Map(); // identischer Regelrumpf → [selektoren]

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

for (const f of files) {
  const bare = strip(readFileSync(f, 'utf8'));
  for (const m of bare.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const body = m[2];
    if (!body.trim() || selector.startsWith('@')) continue;
    blocks += 1;

    const pairs = [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(([, p, v]) => [
      p.trim(),
      v.trim().replace(/\s+/g, ' '),
    ]);
    if (!pairs.length) continue;
    const d = Object.fromEntries(pairs);
    for (const [p, v] of pairs) bump(decls, `${p}: ${v}`);

    if (d.display === 'flex' || d.display === 'inline-flex') {
      const sig = [
        d.display,
        d['flex-direction'] || 'row',
        `align-items:${d['align-items'] || '—'}`,
        `justify-content:${d['justify-content'] || '—'}`,
        `gap:${d.gap || '—'}`,
      ].join(' / ');
      bump(clusters, sig);
    }

    const norm = pairs
      .map(([p, v]) => `${p}:${v}`)
      .sort()
      .join(';');
    if (pairs.length >= 3) {
      const list = bodies.get(norm) || [];
      list.push(`${relative(CSS_DIR, f)} › ${selector}`);
      bodies.set(norm, list);
    }
  }
}

// ── 3. Tokens: deklariert, gelesen, verwaist ───────────────────────────────
const isToken = (rel) => rel === 'tokens.css' || rel.startsWith(`tokens${sep}`);
const tokenFiles = files.filter((f) => isToken(relative(CSS_DIR, f)));
const declared = new Map(); // --token → Datei
for (const f of tokenFiles) {
  for (const m of strip(readFileSync(f, 'utf8')).matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    if (!declared.has(m[1])) declared.set(m[1], relative(CSS_DIR, f));
  }
}
// Leser: der ganze Baum — CSS, Markup, JS (ein Token kann per :style gefüttert werden)
const readerRoots = ['public/css', 'public/partials', 'public/js', 'public/index.html', 'lib'];
const readerText = readerRoots
  .map((r) => {
    const p = join(ROOT, r);
    try {
      if (statSync(p).isDirectory()) {
        const collect = (dir) =>
          readdirSync(dir).flatMap((n) => {
            const q = join(dir, n);
            if (q.includes(`${sep}vendor${sep}`)) return [];
            return statSync(q).isDirectory()
              ? collect(q)
              : /\.(css|html|js|mjs)$/.test(n)
                ? [readFileSync(q, 'utf8')]
                : [];
          });
        return collect(p).join('\n');
      }
      return readFileSync(p, 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

// Gelesen wird ein Token auf ZWEI Wegen, und beide zählen: `var(--x)` im CSS
// und als Zeichenkette aus JS (`{ color: '--c-abc-line' }` → getComputedStyle).
// Nur `var()` zu suchen erzeugt Fehlalarme genau bei den Chart-Tokens.
const readsToken = (t) =>
  new RegExp(`var\\(\\s*${t}\\b`).test(readerText) ||
  new RegExp(`['"\`]${t}['"\`]`).test(readerText);
const unread = [...declared.entries()].filter(([t]) => !readsToken(t));
const orphanTokens = unread
  .filter(([t]) => !TOKEN_RESERVE.has(t))
  .map(([t, f]) => ({ token: t, file: f }));
const reserveTokens = unread
  .filter(([t]) => TOKEN_RESERVE.has(t))
  .map(([t, f]) => ({ token: t, file: f, grund: TOKEN_RESERVE.get(t) }));
// Eine Reserve, die inzwischen gelesen wird, ist keine mehr — dann gehört sie
// aus der Liste, sonst deckt sie irgendwann einen echten Befund.
const staleReserve = [...TOKEN_RESERVE.keys()].filter((t) => declared.has(t) && readsToken(t));

// ── 4. Roh-Werte, die an den Tokens vorbeigehen ────────────────────────────
const strayColor = [];
const breakpoints = new Map();
for (const f of files) {
  const rel = relative(CSS_DIR, f);
  const bare = strip(readFileSync(f, 'utf8'));
  if (!isToken(rel)) {
    for (const m of bare.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g)) {
      strayColor.push({ file: rel, value: m[0] });
    }
  }
  for (const q of bare.matchAll(/@(?:media|container)[^{]*/g)) {
    for (const m of q[0].matchAll(/(\d+(?:\.\d+)?)px/g)) {
      const key = `${m[1]}px`;
      const e = breakpoints.get(key) || { hits: 0, files: new Set() };
      e.hits += 1;
      e.files.add(rel);
      breakpoints.set(key, e);
    }
  }
}

const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const dupBodies = [...bodies.entries()]
  .filter(([, list]) => list.length >= 3)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, clusterTop);

const report = {
  gemessen: new Date().toISOString().slice(0, 10),
  umfang: {
    dateien: files.length,
    loc,
    kommentarzeilen: commentLines,
    leerzeilen: blankLines,
    regelzeilen: loc - commentLines - blankLines,
    regelbloecke: blocks,
    kommentaranteil: +(commentLines / loc).toFixed(3),
    jeOrdner: Object.fromEntries([...perFolder].sort((a, b) => b[1].loc - a[1].loc)),
  },
  auslieferung: {
    bytes: bytesRaw,
    bytesOhneKommentar: bytesBare,
    gzip: gz(allRaw),
    gzipOhneKommentar: gz(allBare),
    linksImIndex: (readFileSync(join(ROOT, 'public', 'index.html'), 'utf8').match(
      /rel="(?:stylesheet|preload)"/g,
    ) || []).length,
  },
  tokens: {
    deklariert: declared.size,
    verwaist: orphanTokens,
    reserve: reserveTokens,
    reserveVeraltet: staleReserve,
  },
  rohwerte: {
    strayColor,
    breakpoints: Object.fromEntries(
      [...breakpoints].sort((a, b) => b[1].hits - a[1].hits).map(([k, v]) => [
        k,
        { fundstellen: v.hits, dateien: v.files.size },
      ]),
    ),
  },
  wiederholung: {
    topDeklarationen: top(decls, clusterTop).map(([k, n]) => ({ deklaration: k, n })),
    flexCluster: top(clusters, clusterTop).map(([k, n]) => ({ signatur: k, n })),
    identischeRuempfe: dupBodies.map(([body, list]) => ({
      n: list.length,
      deklarationen: body.split(';').length,
      rumpf: body,
      stellen: list,
    })),
  },
  ueberCap: tooBig.sort((a, b) => b.loc - a.loc),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const pct = (n) => `${(n * 100).toFixed(0)} %`;
const r = report;

console.log(`\nCSS-Audit — ${r.gemessen}\n${'─'.repeat(60)}`);
console.log(
  `Umfang     ${r.umfang.dateien} Dateien · ${r.umfang.loc} LOC · ` +
    `${r.umfang.regelzeilen} Regelzeilen · ${r.umfang.regelbloecke} Blöcke`,
);
console.log(
  `           Kommentaranteil ${pct(r.umfang.kommentaranteil)} ` +
    `(${r.umfang.kommentarzeilen} Zeilen)`,
);
for (const [f, e] of Object.entries(r.umfang.jeOrdner)) {
  console.log(`           ${f.padEnd(12)} ${String(e.files).padStart(3)} Dateien  ${e.loc} LOC`);
}
console.log(
  `\nAuslieferung  ${kb(r.auslieferung.bytesOhneKommentar)} → ` +
    `${kb(r.auslieferung.gzipOhneKommentar)} gzip · ` +
    `${r.auslieferung.linksImIndex} <link> im Index`,
);
console.log(
  `           (auf der Platte ${kb(r.auslieferung.bytes)} / ${kb(r.auslieferung.gzip)} gzip — ` +
    `ohne Minifier gehen die Kommentare mit über die Leitung)`,
);

console.log(
  `\nTokens     ${r.tokens.deklariert} deklariert · ${r.tokens.verwaist.length} verwaist · ` +
    `${r.tokens.reserve.length} erklärte Reserve`,
);
for (const o of r.tokens.verwaist) console.log(`           ✗ ${o.token}  (${o.file})`);
for (const o of r.tokens.reserve) console.log(`           ○ ${o.token}  — ${o.grund}`);
for (const t of r.tokens.reserveVeraltet) {
  console.log(`           ! ${t} wird gelesen — aus TOKEN_RESERVE entfernen`);
}

console.log(`\nRohwerte   ${r.rohwerte.strayColor.length} Farbe(n) ausserhalb tokens/`);
for (const s of r.rohwerte.strayColor.slice(0, 12)) {
  console.log(`           ${s.value.padEnd(10)} ${s.file}`);
}
console.log('           Breakpoint-Literale (Skala: DESIGN.md → Mobile):');
for (const [bp, e] of Object.entries(r.rohwerte.breakpoints)) {
  console.log(`           ${bp.padEnd(8)} ${String(e.fundstellen).padStart(3)}× in ${e.dateien} Dateien`);
}

console.log('\nWiederholung — Kandidaten für Token/Primitive/Muster');
for (const c of r.wiederholung.flexCluster) console.log(`  ${String(c.n).padStart(4)}×  ${c.signatur}`);
console.log('\n  identische Rümpfe (≥3 Deklarationen, ≥3 Fundstellen):');
for (const d of r.wiederholung.identischeRuempfe) {
  console.log(`  ${String(d.n).padStart(4)}×  ${d.rumpf.slice(0, 90)}`);
  console.log(`         ${d.stellen.slice(0, 3).join(' | ')}`);
}

if (r.ueberCap.length) {
  console.log(`\nÜber ${CAP_LOC} LOC (file-limits):`);
  for (const t of r.ueberCap) console.log(`  ${t.loc}  ${t.file}`);
} else {
  console.log(`\nKeine Datei über ${CAP_LOC} LOC.`);
}
console.log('');
