'use strict';
// Migrations lock: an append-only register of the migrations that have been
// released (deployed). It enforces the forward-only invariant mechanically
// (CLAUDE.md → Harte Regeln: Relationale Integrität): a frozen migration may
// never be renumbered, renamed or changed in content, and no new migration may
// be slipped in at or below the highest frozen version (the watermark).
//
// Why: the classic crash-loop. Migration 0030 "surrogate_pk" is later rewritten
// as 0030 "admin_disabled" and the original moves to 0031. Prod is already at
// schema_version 30 with the OLD meaning — the new chain skips 30, runs 31 on a
// schema it doesn't expect, and the service dies at boot. The register plus its
// unit test catch that before the merge.
//
// Fingerprint = sha256 over the (whitespace-normalized) source of `up()` plus
// the migration name. Re-indenting a frozen migration therefore raises NO false
// alarm; real logic or name changes do.
//
//   node scripts/migrations-lock.js                    # verify (exit != 0 on drift)
//   node scripts/migrations-lock.js --write            # freeze NEW migrations (append)
//   node scripts/migrations-lock.js --write --force    # also re-freeze changed ones
//
// --write refuses when a frozen entry would change: running it just to turn the
// test green would silently bless an edited, possibly deployed migration.
// --force is for exactly one case — the migration was never deployed (still
// unpushed); migration:renumber passes it after moving your own files.
//
// After adding a migration run `npm run migrations:lock` and commit the updated
// db/migrations.lock.json in the same commit. The diff must show ONLY new
// entries; a changed existing entry is the warning sign of a broken
// forward-only rule.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadMigrations } = require('../db/migrations');

const LOCK_PATH = path.join(__dirname, '..', 'db', 'migrations.lock.json');

function fingerprint(migration) {
  const src = String(migration.up).replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(`${migration.name}\n${src}`).digest('hex');
}

// Current chain as [{ version, name, fingerprint }], sorted by version.
function computeEntries() {
  return loadMigrations()
    .map((m) => ({ version: m.version, name: m.name, fingerprint: fingerprint(m) }))
    .sort((a, b) => a.version - b.version);
}

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
}

function writeLock(entries) {
  fs.writeFileSync(LOCK_PATH, `${JSON.stringify(entries, null, 2)}\n`);
}

// Returns the list of violations (empty = all good). The unit test is the
// authoritative gate; the CLI verify mode uses the same logic.
function verify(lock = readLock(), current = computeEntries()) {
  const violations = [];

  // (1) Duplicate version numbers among the files (two 0026_* etc.).
  const seen = new Map();
  for (const m of current) {
    if (seen.has(m.version)) {
      violations.push(`Doppelte Migrations-Version ${m.version}: „${seen.get(m.version)}" und „${m.name}".`);
    }
    seen.set(m.version, m.name);
  }

  const currentByVersion = new Map(current.map((m) => [m.version, m]));
  const lockByVersion = new Map(lock.map((m) => [m.version, m]));

  // (2) Every frozen migration must still exist, unchanged.
  for (const frozen of lock) {
    const cur = currentByVersion.get(frozen.version);
    if (!cur) {
      violations.push(
        `Eingefrorene Migration ${frozen.version} („${frozen.name}") fehlt — forward-only verletzt (entfernt/umnummeriert).`
      );
    } else if (cur.fingerprint !== frozen.fingerprint) {
      violations.push(
        `Eingefrorene Migration ${frozen.version} wurde nachträglich geändert (eingefroren: „${frozen.name}", jetzt: „${cur.name}") — forward-only verletzt. `
          + 'Wurde sie noch NIE deployt (nicht gepusht): „npm run migrations:lock -- --force" und den Lock-Diff bewusst prüfen. '
          + 'Sonst: Änderung zurücknehmen und als NEUE Migration schreiben.'
      );
    }
  }

  // (3) No NEW migration at or below the frozen watermark — that is the actual
  //     renumber bug: it would never run on an already-deployed DB.
  const watermark = lock.reduce((max, m) => Math.max(max, m.version), 0);
  for (const cur of current) {
    if (cur.version <= watermark && !lockByVersion.has(cur.version)) {
      violations.push(
        `Neue Migration ${cur.version} („${cur.name}") liegt auf/unter dem eingefrorenen Wasserzeichen ${watermark} — sie käme auf bereits deployten DBs nie zur Ausführung.`
      );
    }
  }

  return violations;
}

module.exports = { LOCK_PATH, fingerprint, computeEntries, readLock, writeLock, verify };

if (require.main === module) {
  if (process.argv.includes('--write')) {
    const violations = verify();
    if (violations.length && !process.argv.includes('--force')) {
      console.error('Lock NICHT geschrieben — eingefrorene Einträge würden sich ändern:\n'
        + violations.map((v) => ` - ${v}`).join('\n'));
      process.exit(1);
    }
    writeLock(computeEntries());
    console.log(`Lock aktualisiert: ${path.relative(process.cwd(), LOCK_PATH)}`);
  } else {
    const violations = verify();
    if (violations.length) {
      console.error('Migrations-Lock-Verstöße:\n' + violations.map((v) => ` - ${v}`).join('\n'));
      process.exit(1);
    }
    console.log('Migrations-Lock OK.');
  }
}
