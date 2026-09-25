# Migrations

Numbered, forward-only files in [db/migrations/](../db/migrations/)
(`000N_<name>.js`, exporting `{ version, name, up(db) }`). The workflow for a new
one is the `/migration` command ([.claude/commands/migration.md](../.claude/commands/migration.md)).

## Two install paths, one schema

| DB state at boot | What [db/schema.js](../db/schema.js) does |
| --- | --- |
| fresh (no `schema_version`) | runs the **squashed schema** ([db/squashed-schema/](../db/squashed-schema/)) in one batch, stamps `SQUASHED_VERSION` |
| existing | replays only migrations with `version > MAX(schema_version)` |

Every step runs in a transaction followed by `PRAGMA foreign_key_check`
([db/migrations.js](../db/migrations.js)); a dangling FK fails loudly.
Migrations run at every server start — `npm run db:migrate` runs the same path
standalone.

## The gates

| Gate | Catches |
| --- | --- |
| [squash-drift.test.mjs](../tests/unit/squash-drift.test.mjs) (`npm run squash:check`) | squash and chain produce different schemas; `SQUASHED_VERSION` ≠ highest migration |
| [migration-chain-boot.test.mjs](../tests/unit/migration-chain-boot.test.mjs) | chain fails with `foreign_keys = ON` (FK ordering, bad CREATE) |
| [migration-lock.test.mjs](../tests/unit/migration-lock.test.mjs) + [db/migrations.lock.json](../db/migrations.lock.json) | a frozen migration renumbered/renamed/rewritten, a new one inserted at or below the frozen watermark, duplicate numbers, an unfrozen new migration |

Not caught by the fresh-chain tests: `ADD COLUMN … REFERENCES` with a non-NULL
default on a **populated** table. Write a seed-based
`tests/unit/migration-000N-<name>.test.mjs` for such a migration.

## The lock

`npm run migrations:lock` freezes the chain: version → sha256 of the
whitespace-normalized `up()` source plus the name. Commit it with the migration.
The lock diff must only ever **add** lines — a changed line means a released
migration was edited, which crash-loops a prod DB that already applied the old
meaning. (Never deployed yet? Then re-freezing is legitimate — check the diff
consciously.)

## Parallel work: renumbering

Two branches picking the same number usually do **not** conflict in git
(`0007_a.js` next to `0007_b.js`); the lock test flags it. `npm run
migration:renumber` moves only **your** migrations (those not in `origin/main`)
to `max(origin/main) + 1`, rewrites their `version:` field, regenerates the lock
and bumps `SQUASHED_VERSION`. Folding the DDL stays manual. `--dry-run`,
`--ref <ref>`, `--no-fetch`.

## Deploy and rollback

The deploy counts pending migrations on a copy of the live DB
([scripts/pending-migrations.js](../scripts/pending-migrations.js)) and runs the
new chain against that copy before touching anything. On a failed deploy the
DB is restored from the pre-deploy backup **only** if that count was not `0`
(`-1` = unknown counts as "ran"). Details: [deployment.md](deployment.md).

## Tests and the repo DB

`npm run test:unit`/`test:integration` run with `NODE_ENV=test`
([scripts/with-env.js](../scripts/with-env.js)). Under it,
[db/connection.js](../db/connection.js) refuses to open anything without an
explicit `DB_PATH` — every test sets its own temp DB before its first `require`.
