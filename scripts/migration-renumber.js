'use strict';
// npm run migration:renumber  [--dry-run] [--no-fetch] [--ref <git-ref>]
//
// Lifts your OWN, not-yet-pushed migration(s) to `max(<ref>) + 1` (default ref:
// origin/main) and updates the two follow-up artefacts: the `version:` field,
// db/migrations.lock.json and SQUASHED_VERSION.
//
// Why: two people writing a migration on the same day pick the same number.
// git usually does NOT show that as a conflict — if the files are named
// differently (`0007_a.js` / `0007_b.js`) a rebase puts them side by side
// silently and only the lock test notices. Fixing it by hand touches four
// places (file name, `version:` field, lock, SQUASHED_VERSION) — enough to
// forget one under time pressure.
//
// Only files that do NOT exist in <ref> are touched. A migration that is in
// <ref> may already be deployed; renumbering it is exactly the forward-only
// violation db/migrations.lock.json exists to prevent. Selection is therefore
// the set difference against the remote tree — not a date, not git status.
//
// Not done (and reported as remaining work): folding the DDL into
// db/squashed-schema/ — only the author knows which segment it belongs in.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_REL = 'db/migrations';
const MIGRATIONS_DIR = path.join(ROOT, MIGRATIONS_REL);
const SQUASH_INDEX = path.join(ROOT, 'db/squashed-schema/index.js');
const DEFAULT_REF = 'origin/main';
const FILE_RE = /^(\d+)_(.*)\.js$/;

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

// "0007_foo.js" → { version: 7, slug: 'foo' }; anything else → null.
function parseName(file) {
  const m = FILE_RE.exec(file);
  return m ? { version: Number(m[1]), slug: m[2] } : null;
}

function fileName(version, slug) {
  return `${String(version).padStart(4, '0')}_${slug}.js`;
}

// The plan: which of the own (= unknown to remote) files move where? Pure, so
// the unit test can check it without git.
//
// As soon as ONE own file collides (number <= the highest number in `remote`),
// ALL own files are renumbered from remoteMax + 1 on — ascending, so their
// relative order is kept (they may build on each other). Moving only the
// colliding ones would land 0005_mine on 0006 next to an own 0006_mine2.
function planRenumber(local, remote) {
  const remoteSet = new Set(remote);
  const remoteMax = remote.reduce((max, f) => {
    const p = parseName(f);
    return p ? Math.max(max, p.version) : max;
  }, 0);

  const own = local
    .filter((f) => FILE_RE.test(f) && !remoteSet.has(f))
    .map((f) => ({ file: f, ...parseName(f) }))
    .sort((a, b) => a.version - b.version);

  const moves = [];
  if (own.some((m) => m.version <= remoteMax)) {
    let next = remoteMax + 1;
    for (const m of own) {
      const to = next++;
      if (to !== m.version) moves.push({ from: m.version, to, oldName: m.file, newName: fileName(to, m.slug) });
    }
  }
  return { remoteMax, own: own.map((m) => m.file), moves };
}

// Rewrites the `version:` field. Deliberately narrow: exactly one line of the
// form "  version: 7," — the rest (including comments naming the old number)
// stays untouched and is reported instead.
function rewriteVersion(source, from, to) {
  const re = new RegExp(`^(\\s*version:\\s*)${from}(\\s*,)`, 'm');
  if (!re.test(source)) return null;
  return source.replace(re, `$1${to}$2`);
}

function isTracked(rel) {
  try {
    git(['ls-files', '--error-unmatch', rel], { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function currentSquashedVersion() {
  const src = fs.readFileSync(SQUASH_INDEX, 'utf8');
  const m = /^const SQUASHED_VERSION = (\d+);/m.exec(src);
  return m ? { value: Number(m[1]), src } : null;
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const ref = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : DEFAULT_REF;

  if (!argv.includes('--no-fetch') && ref.startsWith('origin/')) {
    try {
      git(['fetch', '--quiet', 'origin', ref.slice('origin/'.length)]);
    } catch {
      console.warn(`! origin nicht erreichbar — es zählt der zuletzt geholte Stand von ${ref}.`);
    }
  }
  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.error(`✗ ${ref} ist lokal nicht bekannt — erst „git fetch" laufen lassen.`);
    return 1;
  }

  const remote = git(['ls-tree', '-r', '--name-only', ref, '--', MIGRATIONS_REL])
    .split('\n')
    .filter(Boolean)
    .map((p) => path.basename(p));
  const local = fs.readdirSync(MIGRATIONS_DIR).filter((f) => FILE_RE.test(f));

  const { remoteMax, own, moves } = planRenumber(local, remote);

  console.log(`› ${ref}: höchste Migration ${remoteMax}`);
  console.log(`› lokal noch nicht in ${ref}: ${own.length ? own.join(', ') : '(keine)'}`);

  if (!moves.length) {
    console.log('✓ Keine Kollision — jede eigene Migration liegt bereits über dem Remote-Stand.');
    return 0;
  }

  for (const mv of moves) console.log(`  ${mv.oldName}  →  ${mv.newName}`);
  if (dryRun) {
    console.log('\n(--dry-run: nichts geändert)');
    return 0;
  }

  // Rewrite content first (if that fails nothing has been moved yet).
  const staleComments = [];
  for (const mv of moves) {
    const abs = path.join(MIGRATIONS_DIR, mv.oldName);
    const src = fs.readFileSync(abs, 'utf8');
    const next = rewriteVersion(src, mv.from, mv.to);
    if (next == null) {
      console.error(`✗ ${mv.oldName}: kein Feld „version: ${mv.from}," gefunden — von Hand prüfen.`);
      return 1;
    }
    fs.writeFileSync(abs, next);
    const relOld = `${MIGRATIONS_REL}/${mv.oldName}`;
    const relNew = `${MIGRATIONS_REL}/${mv.newName}`;
    if (isTracked(relOld)) git(['mv', relOld, relNew]);
    else fs.renameSync(abs, path.join(MIGRATIONS_DIR, mv.newName));
    // The header comment nearly always names the number in prose ("Migration
    // 0007 — …"). Rewriting that automatically would mean guessing in text.
    if (new RegExp(`\\b0*${mv.from}\\b`).test(next.split('\n').slice(0, 40).join('\n'))) {
      staleComments.push(mv.newName);
    }
  }

  // Regenerate the lock in a SEPARATE process — loadMigrations() already has the
  // old file names in Node's require cache. --force: the moved files are your
  // own, unpushed ones, so their (local) lock entries may change.
  execFileSync(process.execPath, [path.join(__dirname, 'migrations-lock.js'), '--write', '--force'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // Bump SQUASHED_VERSION — but only if it was exactly at the old maximum.
  // Anything else means someone intervened by hand; then don't guess, say so.
  const oldMax = local.reduce((max, f) => Math.max(max, parseName(f).version), 0);
  const movedAway = new Set(moves.map((mv) => mv.oldName));
  const newMax = Math.max(
    ...local.filter((f) => !movedAway.has(f)).map((f) => parseName(f).version),
    ...moves.map((mv) => mv.to)
  );
  const squash = currentSquashedVersion();
  let squashNote;
  if (!squash) {
    squashNote = `! SQUASHED_VERSION in ${path.relative(ROOT, SQUASH_INDEX)} nicht gefunden — von Hand auf ${newMax} setzen.`;
  } else if (squash.value === oldMax) {
    fs.writeFileSync(
      SQUASH_INDEX,
      squash.src.replace(/^const SQUASHED_VERSION = \d+;/m, `const SQUASHED_VERSION = ${newMax};`)
    );
    squashNote = `✓ SQUASHED_VERSION ${oldMax} → ${newMax}`;
  } else {
    squashNote = `! SQUASHED_VERSION steht auf ${squash.value} (erwartet ${oldMax}) — nicht angefasst, von Hand auf ${newMax} setzen.`;
  }

  console.log('');
  console.log(squashNote);
  if (staleComments.length) {
    console.log(`! Kopfkommentar nennt noch die alte Nummer: ${staleComments.join(', ')}`);
  }
  console.log('');
  console.log('Noch zu tun (kann das Skript nicht wissen):');
  console.log('  1. DDL in das passende Segment unter db/squashed-schema/ folden');
  console.log('  2. npm run squash:check');
  console.log('  3. npm run test:unit');
  return 0;
}

module.exports = { parseName, fileName, planRenumber, rewriteVersion };

if (require.main === module) process.exit(main(process.argv.slice(2)));
