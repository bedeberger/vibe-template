# Route rules (`routes/`)

Applies in addition to the root [CLAUDE.md](../CLAUDE.md). Jobs: [jobs/CLAUDE.md](jobs/CLAUDE.md).

- **Routes are thin:** parse + validate input, call the **facade** (`lib/`),
  map the result to HTTP. No SQL, no domain logic, no long work (→ job queue).
- **Validate ids first** (`toIntId`) and answer `400 { error }` on bad input,
  `404 { error }` when the facade finds nothing. `401` comes from the auth guard
  in [server.js](../server.js) — never a second login check in a handler.
- **Log context:** after validating the entity id, `setContext({ entity: id })`
  ([lib/log-context.js](../lib/log-context.js)) — every request line is then
  findable by entity, together with the job it spawns.
- **Mount in [server.js](../server.js)** — all HTTP wiring lives there. A path
  that must work without a session goes into `isPublicPath` in
  [lib/auth.js](../lib/auth.js), deliberately and narrowly.
