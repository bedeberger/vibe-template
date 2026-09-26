#!/usr/bin/env node
'use strict';
// Stop-Hook: konsolidierte "Definition of Done"- und Mobile-Prüfung beim
// Sitzungsende (Stop). EINE Erkennung, EINE Meldung, KEINE Prüfung doppelt.
// Die Kriterien und die Trigger-Tabelle stehen in CLAUDE.md → "Definition of
// Done" und ausführbar EINMAL in scripts/hooks/_dod.js; dieser Hook ist nur die
// Verdrahtung (git-status ∩ Transcript) und die Meldung.
//
// Erkennung (genau einmal): welche App-Dateien wurden in DIESER Session
// geschrieben (Schnittmenge Transcript ∩ git-status)? "Geschrieben" heisst
// Edit/Write/MultiEdit/NotebookEdit ODER ein Bash-Kommando mit Schreib-Merkmal
// (sed -i, Heredoc, tee, Umleitung) — der Weg, der hier lange stumm vorbeiging.
//
// Marker PRO ANLIEGEN (nicht pro Session): jedes einzelne offene Kriterium
// (unit/integration/smoke/seed/docs/mobile) wird höchstens EINMAL pro Session
// angemahnt — nie dasselbe zweimal, aber ein erst später dazugekommenes
// Kriterium erscheint noch. Blockiert nie hart: fehlt git oder das Transcript
// oder ist das JSON kaputt, sauber mit Code 0 raus, und der Hinweis ist eine
// Erinnerung, kein Verbot.
//
// Node statt bash+jq: läuft auch auf Windows, und das Transcript führt dort
// `C:\…\public\js\x.js` — die Trigger-Muster erwarten `/` (dod.normalize).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dod = require('./_dod');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function bail() {
  process.exit(0);
}

const raw = readStdin();
let input = {};
try {
  input = JSON.parse(raw) || {};
} catch {
  bail();
}

const session = input.session_id || 'nosession';
// `CLAUDE_PROJECT_DIR` ist der dokumentierte Weg, aber die Variable wird von der
// Shell expandiert — und welche Shell einen Hook startet, ist je Plattform eine
// andere. Der Rückfall auf die eigene Lage im Baum macht das Skript unabhängig
// davon, ob die Expansion überhaupt stattgefunden hat.
const dir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');

let dirabs;
try {
  dirabs = fs.realpathSync(dir);
} catch {
  dirabs = path.resolve(dir);
}

// ── Änderungssatz aus git ───────────────────────────────────────────────────

let changed;
try {
  changed = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: dirabs,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\n')
    .map((line) => line.slice(3))
    .map((line) => line.replace(/^.* -> /, '')) // Rename: nur das Ziel zählt
    .map((line) => dod.normalize(line.trim().replace(/^"|"$/g, '')))
    .filter(Boolean);
} catch {
  bail(); // kein git → nichts zu sagen
}

if (!changed.length) bail();

// ── Nur ECHTE Anpassungen DIESER Session ────────────────────────────────────
// Bereits vor Session-Beginn offene Arbeitskopie-Änderungen (z. B. eine rein
// diagnostische Session auf offenem Working Tree) lösen den Hook damit NICHT
// aus — im Baum liegt womöglich fremde Arbeit.

const transcript = input.transcript_path;
if (!transcript || !fs.existsSync(transcript)) bail();

let edited;
try {
  edited = dod.editedPaths(fs.readFileSync(transcript, 'utf8'), dod.normalize(dirabs));
} catch {
  bail();
}
if (!edited.size) bail();

const touched = changed.filter((f) => edited.has(f));
if (!touched.length) bail();

// ── Trigger ─────────────────────────────────────────────────────────────────

const triggers = new Set();
for (const f of touched) for (const k of dod.classify(f)) triggers.add(k);

// Nichts App-relevantes geändert? → raus (reine Doku-/Test-/Config-Änderung).
if (!triggers.size) bail();

const dodOffen = dod.missingCriteria(touched);
const migrationChanged = touched.some((f) => dod.MIGRATION.test(f));

// ── Marker pro Anliegen ─────────────────────────────────────────────────────
// Nur NEUE (in dieser Session noch nicht angemahnte) Kriterien sammeln. Ein
// bereits gemeldetes Kriterium bleibt still.

const markerBase = path.join(os.tmpdir(), `claude-stopcheck-${String(session).replace(/[^\w.-]/g, '_')}`);
const pendingMarkers = [];
const dodMissing = [];

for (const c of dodOffen) {
  const marker = `${markerBase}-${c.key}`;
  if (fs.existsSync(marker)) continue;
  pendingMarkers.push(marker);
  dodMissing.push(c.label);
}

// Mobile-Anliegen: eigener Marker, nur wenn Layout geändert und in dieser
// Session noch nicht gemeldet.
const mobileMarker = `${markerBase}-mobile`;
const mobileFiles =
  triggers.has('layout') && !fs.existsSync(mobileMarker)
    ? [...new Set(touched.filter((f) => dod.TRIGGERS.layout.test(f)))].sort()
    : [];

// Nichts NEUES anzumerken → durchlassen (alles schon gemeldet oder nichts offen).
if (!dodMissing.length && !mobileFiles.length) bail();

// Ab hier wird blockiert — Marker der jetzt gemeldeten Anliegen setzen, damit
// genau diese Kriterien beim nächsten Stop still bleiben.
const markers = [...pendingMarkers, ...(mobileFiles.length ? [mobileMarker] : [])];
for (const m of markers) {
  try {
    fs.writeFileSync(m, '');
  } catch {
    /* Marker sind Komfort — ein nicht schreibbares tmp darf nichts kippen. */
  }
}

// ── Meldung ─────────────────────────────────────────────────────────────────

let reason = 'Definition of Done (CLAUDE.md → „Definition of Done") – bitte im selben Schritt nachziehen.';

if (dodMissing.length) {
  reason
    += '\n\nDoku/Tests: App-Code geändert, aber folgende DoD-Teile fehlen im Änderungssatz:\n'
    + `  • ${dodMissing.join(' + ')}\n`
    + '→ ergänzen und grün laufen lassen: `npm run test:unit`, `npm run test:integration`, '
    + 'und die BETROFFENEN Playwright-Specs gezielt (`npx playwright test <spec>`).'
    + (migrationChanged
      ? '\n→ Dev-Seed: lib/dev-seed.js so erweitern, dass die neue Tabelle lokal Daten hat '
        + '(über die Facade, nur in leere Tabellen).'
      : '');
}

if (mobileFiles.length) {
  // Nicht fragen, sondern benennen: welche Specs prüfen diese Stelle bei
  // Telefonbreite? Wo keine existiert, ist genau DAS der Befund.
  const coverage = dod.phoneCoverage(dirabs, mobileFiles);
  const lines = [];
  for (const c of coverage) {
    lines.push(`  • ${c.files.join(', ')}`);
    if (c.phone.length) {
      lines.push(`      Phone-Viewport-Specs: ${c.phone.join(' ')}`
        + (c.dropped ? ` (+${c.dropped} weitere nicht gelistet)` : ''));
    } else if (c.any.length) {
      lines.push(`      KEIN Spec prüft „${c.stem}" bei Telefonbreite — vorhanden sind nur `
        + `${c.any.join(' ')} (Desktop). Ein test.use({ viewport: { width: 360, height: 780 } })`
        + '-Block fehlt.');
    } else {
      lines.push(`      KEIN Spec berührt „${c.stem}" — weder Desktop noch Telefon.`);
    }
  }
  reason
    += '\n\nMobile-Prüfung (Konvention): Layout geändert. Gemessen wird sie von den Specs, '
    + 'die ihren Viewport auf Telefonbreite stellen:\n'
    + lines.join('\n')
    + '\n\n→ Die gelisteten Specs gezielt fahren: '
    + '`npx playwright test <spec>` (Harness) bzw. '
    + '`npx playwright test --config=playwright.app.config.js <spec>` (echte App). '
    + 'Steht dort „KEIN Spec", ist das der Befund — dann entweder einen Phone-Viewport-Block '
    + 'ergänzen oder bewusst als desktop-only stehen lassen.\n'
    + '  Woran es scheitert (DESIGN.md → Mobile (Pflicht)): fixe px-Breiten, die bei 360–480 px '
    + 'überlaufen; breite Inhalte ohne scrollbaren Container; zu kleine Tap-Ziele.';
}

reason
  += '\n\nWar die Änderung bewusst ohne Doku/Test-/Responsive-Bedarf (z. B. reines Refactoring / '
  + 'desktop-only), kannst du hier stoppen – jedes Kriterium erscheint pro Session nur einmal.';

process.stdout.write(JSON.stringify({ decision: 'block', reason }));
