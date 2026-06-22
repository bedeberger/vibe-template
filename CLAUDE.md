# vibe-template

Self-hosted SPA template: **Node + Express**, **better-sqlite3** (local-first),
**Alpine.js** frontend with **no build step** (native ESM), PWA. The example
domain entity is **`note`** (owned by a **`notebook`**) — replace it with your
real entity, keeping the patterns below.

This file describes the **current** state only. No history, no "used to be" —
`git log` is the history. Keep it lean; deeper topics live in `docs/` and are
linked from here.

## Stack

- **Server:** Express, one fixed port. All HTTP wiring (setup, auth guard, route
  mounting, cron hook) lives in [server.js](server.js).
- **DB:** SQLite via better-sqlite3, `PRAGMA foreign_keys = ON`. Code in
  [db/](db/), split by theme (connection, now, migrations, schema, squashed
  schema, + one file per domain).
- **Frontend:** Vanilla SPA + Alpine.js, no bundler. Alpine is vendored from
  node_modules at boot ([lib/vendor.js](lib/vendor.js)) and imported as ESM.
- **Styling:** plain CSS in [public/css/](public/css/), token system in
  [public/css/tokens/](public/css/tokens/), `@layer base, components, utilities`.
- **Auth:** session guard on every route except the public ones. OIDC
  (provider-agnostic) + `LOCAL_DEV_MODE` bypass with seed data.
- **Logging:** Winston with a per-request/job context tag.
- **i18n:** all UI strings in `public/js/i18n/{de,en}.json`, via `t('area.field')`.
- **Tests:** Node built-in runner (unit + integration), Playwright (e2e + smoke).
- **No AI** in this template. The job queue is generic — that is where AI calls
  would live if you add them (never synchronously in a request).

## Harte Regeln (Architektur-Invarianten — jede Änderung hält sie ein)

- **Domänen-Facade als einziger Eintrittspunkt.** The notes domain is reached
  only through [lib/note-store.js](lib/note-store.js). No raw SQL against
  `notes`/`notebooks` from routes or jobs. **Why:** one place for invariants,
  validation and future caching; no scattered SQL.
- **Langläufer nur via Job-Queue.** Long-running work runs in
  [lib/jobs/queue.js](lib/jobs/queue.js) (register a runner, enqueue with dedup,
  poll status). No synchronous long operations in a request handler. **Why:**
  requests stay fast; status/dedup/lifecycle are centralized.
- **UI-Strings nur in `public/js/i18n/{de,en}.json`.** No hardcoded German/English
  text in HTML/JS/Alpine templates. Use `t('area.field')`. A new string is added
  to **both** locales in the same commit (de = fallback, en = translation).
  **Why:** no language drift, no orphaned strings.
- **Styles nur in `public/css/`.** No inline `style` attributes, no `<style>`
  blocks. New tokens go into a module in [public/css/tokens/](public/css/tokens/)
  (the facade `<link>` covers them). **Why:** one token system, predictable
  `@layer` cascade.
- **`x-html` nur mit vorab-escaptem Content.** Anything flowing into an `x-html`
  sink is run through `escHtml()` ([public/js/utils.js](public/js/utils.js))
  first. No runtime sanitizer (DOMPurify et al.). **Why:** one auditable escape
  invariant beats scattered sanitizing. Example: `bodyHtml` getter in
  [public/js/cards/note-card.js](public/js/cards/note-card.js).
- **Relationale Integrität.** Every `*_id` is a real FOREIGN KEY (no loose ids);
  every FK column is indexed; `ON DELETE` is deliberate (CASCADE for owned/derived
  rows, SET NULL for curated data); no snapshot columns (derive display values via
  JOIN). Migrations are numbered and forward-only; each ends with
  `foreign_key_check`. [tests/unit/squash-drift.test.mjs](tests/unit/squash-drift.test.mjs)
  gates that the squashed schema equals the migration chain. **Why:** integrity
  cannot be retrofitted.
- **DB-Timestamps: ISO+Z via `NOW_ISO_SQL`.** All `*_at` columns store ISO-8601
  with Z. In INSERT/UPDATE interpolate `${NOW_ISO_SQL}` ([db/now.js](db/now.js)),
  never inline `datetime('now')`. Frontend display only via `tzOpts()`
  ([public/js/utils.js](public/js/utils.js)); server via
  [lib/local-date.js](lib/local-date.js). **Why:** `datetime('now')` lacks the Z
  marker and shows the UTC clock under the local label.
- **Feature-Registry ist SSoT.** [public/js/app/features.js](public/js/app/features.js)
  is the single source for navigation (and a future command palette / usage
  tracking). No hand-maintained parallel nav lists. **Why:** one source, no drift.
- **DESIGN.md-Pattern-Katalog vor neuer UI prüfen.** Before building a new UI
  component, check [DESIGN.md](DESIGN.md). Reuse; if the pattern is missing,
  document it there first, then build. **Why:** prevents parallel reinventions.
- **State explizit deklariert.** Component state is declared up front (root in
  [public/js/app/app-state.js](public/js/app/app-state.js), cards as initial
  fields). No lazy `this._x` that only appears inside methods. **Why:** state must
  be inventoriable by lookup.
- **File-Limits / Modularität.** JS > 600 LOC, HTML partials > 250 LOC, CSS > 600
  LOC get split into a `<name>/` subfolder with a facade re-export. Prefer many
  small thematic files. **Why:** keeps modules navigable.
- **`SHELL_CACHE` bumpen.** On any JS/CSS/HTML change, bump the constant in
  [public/sw.js](public/sw.js) (and add new shell assets there). **Why:** PWA
  clients otherwise hold a stale bundle.
- **Logging-Kontext.** Every route/job fills the context tag
  `[scope|user|entity|jobId]` via [lib/log-context.js](lib/log-context.js)
  (`setContext`). **Why:** an end-to-end searchable trace per request and the job
  it spawns.

## Add a feature

1. **Registry:** add an entry to [public/js/app/features.js](public/js/app/features.js)
   (`id`, `icon`, `labelKey`, `view`). The nav renders it automatically.
2. **i18n:** add the new keys to both `de.json` and `en.json`.
3. **Backend (data):** add a domain DB module under `db/`, expose it through a
   **facade** in `lib/`; routes import the facade only.
4. **Backend (long op):** register a runner in `lib/jobs/` and enqueue via
   `queue.createJob(type, entityId)` (dedup is built in).
5. **Migration:** add `db/migrations/000N_*.js`, fold its DDL into
   `db/squashed-schema.js`, bump `SQUASHED_VERSION`. Run `npm run squash:check`.
6. **Frontend:** new view as a partial in `public/partials/`, cards as
   `Alpine.data` sub-components in `public/js/cards/`.
7. **Tests:** unit (facade), integration (API), e2e/smoke if it has UI.

## Commands

```bash
npm start            # run the server (LOCAL_DEV_MODE=1 → zero-config local start)
npm test             # unit + integration + e2e + smoke
npm run test:unit
npm run test:integration
npm run squash:check # schema-drift gate only
```
