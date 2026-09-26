'use strict';
// Shared rule definitions for the Claude Code hooks (scripts/hooks/*.js) AND
// the unit guard tests (tests/unit/*.test.mjs). One module, so the early
// warning at edit time and the CI gate can never disagree about a rule — the
// hook says exactly what the test will later say.
//
// Pure functions + constants only, no side effects on require. CommonJS so the
// hooks can `require()` it; the .mjs tests load it via createRequire().

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// Never our code: third-party libs, generated output, git internals.
const SKIP_DIRS = new Set(['node_modules', 'vendor', '.git', 'test-results', 'playwright-report', 'coverage']);

// Recursive file list under `dir` (absolute or ROOT-relative) with one of `exts`.
function walk(dir, exts, out = []) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, exts, out);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

// ROOT-relative POSIX path.
const toRel = (abs) => path.relative(ROOT, path.resolve(ROOT, abs)).split(path.sep).join('/');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ─── LOC limits (CLAUDE.md "File-Limits / Modularität") ─────────────────────
// LOC == physical lines, identical to `wc -l` for a file with a final newline.
function loc(src) {
  if (src === '') return 0;
  const n = src.split('\n').length;
  return src.endsWith('\n') ? n - 1 : n;
}

// One category = roots (+ single files) + extensions + cap + grandfathered
// offenders. `allow` maps a ROOT-relative path to its pinned ceiling (ratchet:
// may only shrink). The template starts clean — keep it empty; a file that has
// to exceed its cap for a documented reason goes here with a comment, and is
// removed again once it is split.
const LOC_CATEGORIES = [
  {
    label: 'Browser-JS',
    roots: ['public/js'],
    exts: ['.js', '.mjs'],
    cap: 600,
    allow: {},
  },
  {
    label: 'Server-/Script-JS',
    roots: ['lib', 'routes', 'db', 'scripts'],
    files: ['server.js', 'logger.js'],
    exts: ['.js', '.mjs', '.cjs'],
    cap: 600,
    allow: {},
  },
  {
    label: 'HTML-Partial',
    roots: ['public/partials'],
    exts: ['.html'],
    cap: 250,
    allow: {},
  },
  {
    label: 'CSS-File',
    roots: ['public/css'],
    exts: ['.css'],
    cap: 600,
    allow: {},
  },
];

// The category a ROOT-relative path falls into, or null.
function locCategoryFor(rel) {
  if (rel.split('/').some((seg) => SKIP_DIRS.has(seg))) return null;
  return LOC_CATEGORIES.find((c) =>
    c.exts.some((e) => rel.endsWith(e))
    && ((c.files || []).includes(rel) || c.roots.some((r) => rel.startsWith(`${r}/`)))) || null;
}

function locFiles(cat) {
  const files = [];
  for (const r of cat.roots) walk(r, cat.exts, files);
  for (const f of cat.files || []) if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  return files.map(toRel);
}

// ─── Comment stripping (keeps line numbers) ─────────────────────────────────
const blank = (s) => s.replace(/[^\n]/g, ' ');
const stripCssComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, blank);
const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, blank);
// JS: block comments + `//` comments that start a line or follow whitespace
// (so `'https://…'` inside a string survives). Heuristic, errs toward keeping code.
const stripJsComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[\s;{}(),])\/\/[^\n]*/gm, (m, lead) => lead + blank(m.slice(lead.length)));

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// ─── Styles only in public/css/ (no inline style, no <style>) ───────────────
// Allowed exception: an Alpine OBJECT-form binding that only sets custom
// properties, e.g. :style="{ '--progress': pct + '%' }" — the value lives in
// the component, the styling in CSS.
// `\\?` before the quote: a Bash heredoc/sed payload carries it shell-escaped.
const STATIC_STYLE_ATTR_RE = /(?<![:\w.-])style\s*=\s*\\?["']/g;
const STYLE_BLOCK_RE = /<style[\s>]/gi;
const DYNAMIC_STYLE_RE = /(?<![\w-])(?::|x-bind:)style\s*=\s*(["'])([\s\S]*?)\1/g;

// Keys of an object literal, top level only (heuristic: a key follows `{` or `,`).
function objectKeys(expr) {
  const keys = [];
  for (const m of expr.matchAll(/(?:^|[{,])\s*(['"`]?)([\w-]+)\1\s*:/g)) keys.push(m[2]);
  return keys;
}

// Why a dynamic :style value is not allowed, or null when it is.
function dynamicStyleProblem(value) {
  const v = value.trim();
  if (!v.startsWith('{') || !v.endsWith('}')) {
    return `:style="${v.slice(0, 40)}" — nur Objekt-Form { '--x': … } erlaubt (kein String/Array)`;
  }
  const keys = objectKeys(v);
  if (!keys.length) return `:style="${v.slice(0, 40)}" — keine Custom-Property-Keys erkennbar`;
  const bad = keys.filter((k) => !k.startsWith('--'));
  return bad.length ? `:style setzt echte Properties (${bad.join(', ')}) — nur '--custom-props' erlaubt` : null;
}

// Violations in HTML/SVG markup (comments stripped). Returns [{ line, msg }].
function markupStyleViolations(src) {
  const code = stripHtmlComments(src);
  const out = [];
  for (const m of code.matchAll(STATIC_STYLE_ATTR_RE)) out.push({ line: lineOf(code, m.index), msg: 'statisches style="…"-Attribut' });
  for (const m of code.matchAll(STYLE_BLOCK_RE)) out.push({ line: lineOf(code, m.index), msg: '<style>-Block' });
  for (const m of code.matchAll(DYNAMIC_STYLE_RE)) {
    const problem = dynamicStyleProblem(m[2]);
    if (problem) out.push({ line: lineOf(code, m.index), msg: problem });
  }
  return out;
}

// Violations in browser JS: markup in template strings + imperative inline
// styles. `el.style.setProperty('--x', …)` is the allowed runtime path.
function jsStyleViolations(src) {
  const code = stripJsComments(src);
  const out = markupStyleViolations(code);
  const rules = [
    [/\.style\.cssText\b/g, '.style.cssText'],
    [/\.style\s*=(?!=)/g, '.style = …'],
    [/setAttribute\(\s*['"`]style['"`]/g, "setAttribute('style', …)"],
    [/\.style\.(?!setProperty\b|removeProperty\b|getPropertyValue\b|cssText\b)[a-zA-Z]+\s*=(?!=)/g, '.style.<prop> = … (nur setProperty(\'--x\') erlaubt)'],
    [/\.style\.setProperty\(\s*['"`](?!--)/g, "style.setProperty('<echte-property>') (nur '--x' erlaubt)"],
  ];
  for (const [re, msg] of rules) {
    for (const m of code.matchAll(re)) out.push({ line: lineOf(code, m.index), msg });
  }
  return out;
}

// ─── DB timestamps: ISO+Z via NOW_ISO_SQL, never datetime('now') ───────────
const DATETIME_NOW_RE = /datetime\(\s*['"]now['"]\s*\)/gi;

// ─── Domain facades: a domain's tables + DB module only via its facade ─────
// ONE entry per domain. A new domain (CLAUDE.md "Feature hinzufügen" §3) is one
// line here — the style-guard hook and architecture-tripwire.test pick it up.
// Forgotten, the new tables are open to raw SQL from any route or job.
const DOMAINS = [
  { name: 'notes', tables: ['notes', 'notebooks'], dbModule: 'db/notes', facade: 'lib/note-store.js' },
  { name: 'users', tables: ['app_users', 'user_credentials'], dbModule: 'db/users', facade: 'lib/user-store.js' },
];
// Uppercase SQL keywords only — lowercase English prose ("load from notes")
// stays out; every SQL statement in this codebase is uppercase.
const rawSqlRe = (tables) => new RegExp(
  String.raw`\b(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+["'\x60\[]?(?:${tables.join('|')})\b`, 'g');
// Direct import of the domain DB module (e.g. db/notes.js) instead of the facade.
const dbImportRe = (dbModule) => new RegExp(
  String.raw`(?:require\(\s*|from\s+|import\(\s*)['"\x60][^'"\x60]*\b${dbModule.replace('/', '\\/')}(?:\.js)?['"\x60]`, 'g');
for (const d of DOMAINS) { d.sqlRe = rawSqlRe(d.tables); d.importRe = dbImportRe(d.dbModule); }

// Facade-rule violations in one file (code already comment-stripped):
// [{ domain, kind: 'sql' | 'import', index, match }]. db/ and tests/ may touch
// every domain directly; a facade only its own.
function domainAccessViolations(rel, code) {
  if (rel.startsWith('db/') || rel.startsWith('tests/')) return [];
  const out = [];
  for (const domain of DOMAINS) {
    if (rel === domain.facade) continue;
    for (const [kind, re] of [['sql', domain.sqlRe], ['import', domain.importRe]]) {
      for (const m of code.matchAll(re)) out.push({ domain, kind, index: m.index, match: m[0] });
    }
  }
  return out;
}

// The hint for one violation — the alternative, not just the prohibition.
function domainAccessMessage({ domain, kind }) {
  return kind === 'sql'
    ? `Roh-SQL gegen ${domain.tables.join('/')} ausserhalb db/ + ${domain.facade}: Zugriff nur ueber die Facade `
      + '(CLAUDE.md "Domänen-Facade als einziger Eintrittspunkt") — sonst wird architecture-tripwire.test rot.'
    : `Direkter Import von ${domain.dbModule}.js: Routen/Jobs importieren nur die Facade ${domain.facade}.`;
}

// ─── i18n ────────────────────────────────────────────────────────────────────
const LOCALES = ['de', 'en'];
const localeFile = (loc) => `public/js/i18n/${loc}.json`;

// Nested JSON → Map(dotted key → leaf value).
function flattenKeys(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const placeholders = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

// Parity report for two flattened locales: { onlyA, onlyB, placeholderDrift }.
function localeParity(a, b) {
  const onlyA = [...a.keys()].filter((k) => !b.has(k)).sort();
  const onlyB = [...b.keys()].filter((k) => !a.has(k)).sort();
  const placeholderDrift = [];
  for (const [k, v] of a) {
    if (!b.has(k)) continue;
    const pa = placeholders(v).join(',');
    const pb = placeholders(b.get(k)).join(',');
    if (pa !== pb) placeholderDrift.push(`${k}: {${pa}} ≠ {${pb}}`);
  }
  return { onlyA, onlyB, placeholderDrift };
}

module.exports = {
  ROOT,
  SKIP_DIRS,
  walk,
  toRel,
  read,
  loc,
  LOC_CATEGORIES,
  locCategoryFor,
  locFiles,
  stripCssComments,
  stripHtmlComments,
  stripJsComments,
  lineOf,
  markupStyleViolations,
  jsStyleViolations,
  dynamicStyleProblem,
  DATETIME_NOW_RE,
  DOMAINS,
  domainAccessViolations,
  domainAccessMessage,
  LOCALES,
  localeFile,
  flattenKeys,
  placeholders,
  localeParity,
};
