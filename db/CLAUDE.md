# DB rules (`db/`)

Applies in addition to the root [CLAUDE.md](../CLAUDE.md). Mechanism (fresh vs.
upgrade, squash, lock, renumber, rollback): [docs/migrations.md](../docs/migrations.md).
New migration: `/migration`.

- **One domain per file.** [connection.js](connection.js) (the one connection,
  `PRAGMA foreign_keys = ON`, refuses the repo DB under `NODE_ENV=test`),
  [now.js](now.js), [migrations.js](migrations.js) (runner),
  [schema.js](schema.js) (boot: squash or chain), [squashed-schema/](squashed-schema/)
  (one segment per domain), [migrations/](migrations/) (`000N_<name>.js`), then
  one module per domain ([notes.js](notes.js)). Domain modules are reached only
  through their facade in `lib/` — routes and jobs never import `db/<domain>.js`.
- **Timestamps: ISO+Z.** Every `*_at` column stores ISO-8601 with `Z`. Defaults
  `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`; in INSERT/UPDATE interpolate
  `${NOW_ISO_SQL}` and list the column **explicitly** (don't rely on the default).
  Never `datetime('now')`. **Why:** it has no Z — the browser parses it as local
  time and shows the UTC clock under the app-timezone label.

## Relationale Integrität

- **Every `*_id` is a real FK** (`REFERENCES`); loose ids are forbidden.
- **Every FK column is indexed** (`CREATE INDEX idx_<table>_<col>`).
- **`ON DELETE` is a decision:** `CASCADE` for owned/derived rows (caches,
  aggregates, children that are unreachable without their parent), `SET NULL`
  for curated data that should survive its parent. **Never `SET NULL` on a
  column a CHECK requires to be set** — the delete then aborts on every path
  that touches the chain, and only at delete time.
- **No snapshot columns** (`notebook_name` next to `notebook_id`): derive display
  values by JOIN at read time. Exception: an audit name in a deletion log whose
  referenced row is hard-deleted.
- **Sentinel-free:** no `x_id = 0` / `'__all__'` as discriminator. Use an explicit
  `kind TEXT NOT NULL CHECK(kind IN (…))` + NULL refs + a CHECK tying them together.
- **Forward-only.** A migration that ever left your machine is never renumbered
  or edited (the lock test fails, and prod would crash-loop). Fix forward with a
  new migration.
- **Recreate pattern** for adding an FK to an existing table (SQLite has no
  `ADD CONSTRAINT`): clean orphans → `xxx_new` with final FKs + indexes →
  `INSERT … SELECT` → `DROP` + `RENAME` → recreate indexes. `PRAGMA foreign_keys`
  is a no-op inside the runner's transaction: check who points at the table by
  FK first — a `CASCADE` child loses its rows on `DROP TABLE`.
