# lib rules (`lib/`)

Applies in addition to the root [CLAUDE.md](../CLAUDE.md).

- **A facade per domain** (`lib/<domain>-store.js`, reference
  [note-store.js](note-store.js)) is the only entry point to that domain's data:
  validation, invariants and (later) caching live here — not in routes, not in
  jobs. Routes/jobs import the facade, never `db/<domain>.js`, never raw SQL.
- **Facade errors are domain errors** (`name required`, `not found`) — the route
  maps them to HTTP status codes; the facade knows nothing about HTTP.
- **Log context** ([log-context.js](log-context.js)): `runWithContext` opens a
  scope (the HTTP middleware and the job queue do it), `setContext` fills slots.
  Don't create a second context mechanism.
- **Dates on the server** only via [local-date.js](local-date.js) (reads
  `app.timezone`), never the process timezone.
- **Dev seed** ([dev-seed.js](dev-seed.js)) writes through the facade, only
  under `LOCAL_DEV_MODE=1`, only into empty tables — and seeds the
  *differences* (e.g. one note with HTML in its body to exercise the escape)
  rather than five identical rows.
