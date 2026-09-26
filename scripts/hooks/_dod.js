#!/usr/bin/env node
'use strict';
// Die DoD-Erkennung — geteilt von session-stop-check.js und ihrem Gate-Test
// tests/unit/dod-triggers.test.mjs.
//
// Warum als eigenes Modul und nicht im Hook: die Trigger sind eine TABELLE
// (welches Verzeichnis verlangt was). Als Regex-Literal im Hook fallen Löcher
// lautlos aus — ein fehlendes Verzeichnis (etwa `routes/`) lässt den Hook
// `bail()`en, und ein Hook, der nichts sagt, ist von einem grünen nicht zu
// unterscheiden. Als Modul ist die Tabelle prüfbar (tests/unit/dod-triggers.test.mjs).
//
// `_`-Präfix = geteilter Helfer, KEIN Hook (wie _rules.js, _touched.js).

const fs = require('node:fs');
const path = require('node:path');

/** Repo-relativer Pfad mit Vorwärts-Schrägstrichen, wie git ihn ausgibt. */
function normalize(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '');
}

// ── Trigger: welche Änderung verlangt was ───────────────────────────────────
// `backend`  → Unit- + Integration-Tests + Doku
// `frontend` → Smoke/E2E + Doku
// `layout`   → Mobile-Prüfung
//
// Eine Datei kann mehrere Trigger auslösen (ein Partial ist frontend UND layout).
const TRIGGERS = {
  // routes/ gehört hierher, nicht bloss db/ und lib/: eine geänderte Route IST
  // die API-Naht, und genau sie prüft tests/integration/.
  backend: /^(?:db|lib|routes)\/.+\.js$|^(?:server|logger)\.js$/,
  // JEDE .html/.js unter public/ — index.html, eigenständige Seiten (login.html)
  // und alles in Unterordnern. EINSCHLIESSEND statt aufzählend: eine Liste
  // bekannter Ordner liesse die nächste Seite in einem neuen Ordner stumm
  // herausfallen. Ausgenommen nur, was wir nicht schreiben bzw. was eigene
  // Gates hat (vendor, i18n — s. NOT_APP in dod-triggers.test.mjs).
  frontend: /^public\/(?!vendor\/|js\/i18n\/).+\.(?:html|js)$/,
  layout: /^public\/(?!vendor\/|js\/i18n\/).+\.(?:html|js|css)$/,
};

/** Welche Trigger löst dieser repo-relative Pfad aus? */
function classify(rel) {
  const p = normalize(rel);
  return Object.keys(TRIGGERS).filter((k) => TRIGGERS[k].test(p));
}

// ── Kriterien: was im Änderungssatz liegen muss ─────────────────────────────
// `by` nennt die Trigger, die das Kriterium fordern; `re` erkennt, ob es
// bereits erfüllt ist. Die Reihenfolge ist die der Meldung.
const CRITERIA = [
  {
    key: 'unit',
    by: ['backend'],
    label: 'Unit-Tests (tests/unit/)',
    re: /^tests\/unit\/.+\.(?:test|spec)\.(?:js|mjs)$/,
  },
  {
    key: 'integration',
    by: ['backend'],
    label: 'Integration-Tests (tests/integration/)',
    re: /^tests\/integration\/.+\.test\.js$/,
  },
  {
    key: 'smoke',
    by: ['frontend'],
    label: 'E2E/Smoke (tests/e2e/ bzw. tests/e2e-app/)',
    re: /^tests\/(?:e2e|e2e-app)\/.+\.spec\.js$/,
  },
  {
    // Eine Migration legt fast immer eine Tabelle an — und eine leere Tabelle
    // sieht lokal aus wie eine funktionierende Ansicht ohne Daten.
    key: 'seed',
    by: ['migration'],
    label: 'Dev-Seed (lib/dev-seed.js)',
    re: /^lib\/dev-seed(?:\.js|\/)/,
  },
  {
    key: 'docs',
    by: ['backend', 'frontend'],
    label: 'Doku (docs/ bzw. README/CLAUDE/DESIGN)',
    // CLAUDE.md in ANY directory: the directory-local rules (routes/CLAUDE.md …)
    // are exactly where a routes/ or lib/ change is documented.
    re: /^(?:docs\/|README\.md|DESIGN\.md|(?:.+\/)?CLAUDE\.md$)/,
  },
];

/** Zusatz-Trigger, die nicht aus TRIGGERS folgen (eine Migration ist backend + dies). */
const MIGRATION = /^db\/migrations\/\d+.*\.js$/;

/**
 * Welche Kriterien fehlen? `touched` sind die in dieser Session angefassten,
 * repo-relativen Pfade.
 */
function missingCriteria(touched) {
  const files = touched.map(normalize);
  const has = (re) => files.some((f) => re.test(f));

  const active = new Set();
  for (const f of files) for (const k of classify(f)) active.add(k);
  if (has(MIGRATION)) active.add('migration');

  return CRITERIA
    .filter((c) => c.by.some((t) => active.has(t)) && !has(c.re))
    .map((c) => ({ key: c.key, label: c.label }));
}

// ── Was diese Session wirklich geschrieben hat ──────────────────────────────
// Die Werkzeuge mit einem `file_path` sind der eindeutige Teil. Der andere ist
// **Bash**: ein `sed -i`, ein Heredoc, ein `tee`, ein kurzes `python3 -` trägt
// kein `file_path` — genau die Lücke, für die scripts/hooks/_touched.js gebaut
// wurde und die hier lange offen blieb. Eine Session, die per Bash schreibt,
// bekam KEINE DoD-Prüfung, und zwar stumm.
//
// Anders als _touched.js kann das hier nicht grosszügig jeden genannten Pfad
// nehmen: der Baum ist geteilt (mehrere Sessions/Personen), ein
// `grep muster lib/x.js` auf einer fremd geänderten Datei löste sonst eine
// DoD-Mahnung aus.
//
// Der erste Anlauf war „Schreib-Merkmal gefunden → ALLE Pfade im Kommando", und
// er ist im Feld sofort umgefallen: ein `node -e "… ['public/index.html', …] …"`
// (eine Sonde, die Pfade als DATEN nennt) und der INHALT eines Heredocs
// (`cat > tmp.jsonl <<EOF` mit Pfaden in den JSON-Zeilen) galten beide als
// geschrieben — gemeldet wurden dann fremde Dateien aus einer parallelen
// Session, und eine Meldung, die Fremdes nennt, wird als ganze überlesen.
//
// Deshalb wird jetzt das ZIEL des Schreibens bestimmt, nicht die Erwähnung: je
// Kommando-Segment ein Extraktor, der weiss, wo bei DIESER Schreibart die
// Zieldatei steht. Kein Extraktor passt → kein Pfad.
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const EXT = 'js|mjs|cjs|json|html|css|md';
const PATH_IN_COMMAND = new RegExp(`[\\w@.\\-/]+\\.(?:${EXT})\\b`, 'g');
// Nur die Umleitung, nicht `2>&1`, nicht `>>` in einem Vergleich.
const REDIRECT_TARGET = new RegExp(
  `(?:^|[^0-9<>&|])>{1,2}\\s*['"]?([\\w@.\\-/]+\\.(?:${EXT}))\\b`, 'g');

// Ein Segment ist ein durch `&&`, `||`, `;`, `|` oder Zeilenwechsel getrennter
// Teil. Die Trennung hält den Heredoc-Rumpf (eigene Zeilen) vom `cat >`-Kopf
// fern und `foo.js | tee bar.js` auseinander.
const SEGMENT = /\|\||&&|;|\n|\|/;

const WRITE_FORMS = [
  {
    // `cat > x.js`, `printf … >> y.md` — das Ziel steht hinter dem Pfeil.
    name: 'redirect',
    when: (seg) => REDIRECT_TARGET.test(seg),
    targets: (seg) => [...seg.matchAll(REDIRECT_TARGET)].map((m) => m[1]),
  },
  {
    // In-place-Bearbeitung und `tee`: die genannten Pfade SIND die Ziele.
    name: 'inplace',
    when: (seg) => /\bsed\s+(?:-[a-zA-Z]*i|--in-place)/.test(seg) || /\btee\b/.test(seg),
    targets: (seg) => seg.match(PATH_IN_COMMAND) || [],
  },
  {
    // Kopieren/Verschieben: geschrieben wird das LETZTE Argument, die Quelle nicht.
    name: 'copy',
    when: (seg) => /\b(?:cp|mv|install|rsync|truncate)\s/.test(seg),
    targets: (seg) => (seg.match(PATH_IN_COMMAND) || []).slice(-1),
  },
  {
    // Interpreter-Einzeiler — aber nur mit einer echten Schreib-API darin.
    // Ohne diese Bedingung galt jede Lese-Sonde als Schreibvorgang.
    name: 'interpreter',
    when: (seg) => /\b(?:node|python3?|perl|ruby)\s+-[ec]\b/.test(seg)
      && /write(?:File|Sync)|appendFile|createWriteStream|rename|unlink|rmSync|mkdir|copyFile|['"]w\+?['"]/.test(seg),
    targets: (seg) => seg.match(PATH_IN_COMMAND) || [],
  },
];

/** Die Ziele aller Schreibvorgänge in diesem Bash-Kommando. */
function writeTargets(cmd) {
  const out = [];
  for (const seg of String(cmd).split(SEGMENT)) {
    for (const form of WRITE_FORMS) {
      // `when` benutzt bei redirect eine globale Regex — Zustand zurücksetzen.
      REDIRECT_TARGET.lastIndex = 0;
      if (!form.when(seg)) continue;
      REDIRECT_TARGET.lastIndex = 0;
      out.push(...form.targets(seg));
      break; // die erste passende Schreibart gewinnt je Segment
    }
  }
  return out.filter((p) => !p.includes('node_modules/') && !p.includes('/vendor/'));
}

/** Schreibt dieses Bash-Kommando plausibel eine Datei? */
function isWriteCommand(cmd) {
  return writeTargets(cmd).length > 0;
}

/**
 * Die in DIESER Session geschriebenen Pfade, repo-relativ. `transcript` ist der
 * rohe JSONL-Text, `repoAbs` das Repo-Wurzelverzeichnis (absolut, POSIX).
 */
function editedPaths(transcript, repoAbs, { win = process.platform === 'win32' } = {}) {
  const prefix = `${normalize(repoAbs).replace(/\/$/, '')}/`;
  const out = new Set();

  const add = (file) => {
    const norm = normalize(file);
    const hit = win
      ? norm.toLowerCase().startsWith(prefix.toLowerCase())
      : norm.startsWith(prefix);
    out.add(hit ? norm.slice(prefix.length) : norm);
  };

  for (const line of String(transcript).split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // eine kaputte Zeile darf den Hook nicht kippen
    }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || part.type !== 'tool_use') continue;
      if (WRITE_TOOLS.has(part.name)) {
        const file = part.input?.file_path || part.input?.notebook_path;
        if (file) add(file);
        continue;
      }
      const cmd = part.name === 'Bash' ? part.input?.command : null;
      if (typeof cmd !== 'string') continue;
      for (const target of writeTargets(cmd)) add(target);
    }
  }
  return out;
}

// ── Mobile: die Specs benennen, nicht danach fragen ─────────────────────────
// Die Mobile-Hälfte war fünf Punkte Prosa, an denen nichts gemessen wurde — in
// einem Repo, dessen eigene Regel „die Wirkung, gemessen" heisst. Gemessen wird
// sie von den Specs, die ihren Viewport auf Telefonbreite stellen; der Hook
// nennt deshalb die konkreten Specs zur berührten Stelle und sagt, wo es KEINE
// gibt. Ausgeführt wird hier nichts: ein Playwright-Lauf dauert, der Hook meldet nur.
// Beide Schreibweisen zählen: `test.use({ viewport: … })` stellt die ganze
// Datei auf Telefonbreite, `page.setViewportSize(…)` einen Abschnitt darin — und
// die zweite ist im Baum die häufigere. Die Breitenschranke (unter 480) trennt
// den Phone- vom Desktop-Fall, den dieselben zwei Aufrufe tragen.
const PHONE_VIEWPORT = /(?:viewport:|setViewportSize\()\s*\{\s*width:\s*(?:3\d\d|4[0-7]\d)\b/;
const MAX_SPECS = 6;

/** Der Stamm, unter dem eine Datei in den Specs auftaucht (Ansicht/Baustein). */
function viewStem(rel) {
  const p = normalize(rel);
  const m = p.match(/^public\/(?:partials|js\/cards)\/([a-z0-9-]+?)(?:-item-card|-card)?(?:\.(?:html|js)|\/)/)
    || p.match(/^public\/js\/([a-z0-9-]+)\/[a-z0-9-]+\.js$/)
    || p.match(/^public\/css\/entities\/([a-z0-9-]+?)(?:\.css|\/)/)
    || p.match(/^public\/css\/components\/([a-z0-9-]+?)(?:\.css|\/)/)
    || p.match(/^public\/(?:js\/app|css\/(?:layout|tokens))\/([a-z0-9-]+?)(?:\.(?:js|css)|\/)/);
  if (m) return m[1];
  const top = p.match(/^public\/([a-z0-9-]+)\.html$/);
  if (top) return top[1] === 'index' ? 'app' : top[1];
  return path.basename(p).replace(/\.[a-z]+$/, '').replace(/-view$/, '');
}

/**
 * Der Stamm im Spec-TEXT — aber nur in Bezeichner-Form. Ein blosses
 * `text.includes(stem)` war unbrauchbar: ein Stamm wie „heute" oder „termine" ist
 * auch ein deutsches Wort und traf zwölf Specs, die die Ansicht nie anfassen.
 * Gesucht wird deshalb der Ansichts-Name (`termine-view`), der Route-Hash
 * (`#termine`), ein zitierter
 * Bezeichner oder ein Klassen-Selektor (`.check`, `.table__handle`).
 * `null` = zu kurz für eine verlässliche Aussage.
 */
function contentProbe(stem) {
  if (stem.length < 3) return null;
  const s = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:${s}-card|#${s}\\b|['"\`]${s}['"\`]|\\.${s}(?:__|--|\\b))`);
}

function readSpecs(root) {
  const out = [];
  for (const layer of ['e2e', 'e2e-app']) {
    const dir = path.join(root, 'tests', layer);
    let names;
    try {
      names = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js'));
    } catch {
      continue; // Layer nicht vorhanden → nichts zu lesen
    }
    for (const name of names) {
      let text;
      try {
        text = fs.readFileSync(path.join(dir, name), 'utf8');
      } catch {
        continue;
      }
      out.push({ rel: `tests/${layer}/${name}`, name, text, phone: PHONE_VIEWPORT.test(text) });
    }
  }
  return out;
}

/**
 * Je Stamm: die Specs, die ihn bei Telefonbreite prüfen — und ob es überhaupt
 * welche gibt. `[{ stem, files, phone: [rel…], dropped, any: [rel…] }]`
 */
function phoneCoverage(root, files) {
  const specs = readSpecs(root);
  const byStem = new Map();
  for (const f of files.map(normalize)) {
    const stem = viewStem(f);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(f);
  }

  const out = [];
  for (const [stem, group] of [...byStem].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Der Dateiname ist das verlässlichere Signal; der Inhalt ist der Rückfall,
    // weil ein Baustein (`table`, `check`) in fremd benannten Specs geprüft wird.
    const byName = specs.filter((s) => s.name.includes(stem));
    const probe = contentProbe(stem);
    const hits = byName.length || !probe ? byName : specs.filter((s) => probe.test(s.text));
    const phone = hits.filter((s) => s.phone).map((s) => s.rel);
    out.push({
      stem,
      files: group.sort(),
      phone: phone.slice(0, MAX_SPECS),
      dropped: Math.max(0, phone.length - MAX_SPECS),
      any: hits.slice(0, MAX_SPECS).map((s) => s.rel),
    });
  }
  return out;
}

module.exports = {
  TRIGGERS,
  CRITERIA,
  MIGRATION,
  WRITE_FORMS,
  writeTargets,
  classify,
  missingCriteria,
  editedPaths,
  isWriteCommand,
  normalize,
  viewStem,
  phoneCoverage,
};
