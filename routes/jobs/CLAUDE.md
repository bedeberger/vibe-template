# Job rules (`routes/jobs/`)

Applies in addition to [routes/CLAUDE.md](../CLAUDE.md).

- **Long work runs only here** — anything that would noticeably block a request
  (import, export, batch, external call, later AI). Never synchronously in a
  route handler.
- **One file per job type** (reference [note-stats.js](note-stats.js)): a stable
  `TYPE` string, `registerRunner(TYPE, async (job) => result)`; the runner reads
  and writes through facades and returns a plain result object (stored as
  `result_json`). Add the type to `KNOWN_TYPES` in [index.js](index.js).
- **Enqueue via `queue.createJob(type, entityId)`** ([shared/queue.js](shared/queue.js))
  — dedup is built in: an active job for the same (type, entity) is returned
  instead of a second one.
- **Status texts are i18n keys** (`job.phase.xxx`), resolved in the frontend.
- **Log context is set by the queue** (`[job|…|entity|jobId]`) — don't rebuild it
  in the runner.
- **Throw on failure** — the queue marks the job `error` and stores the message;
  never return partial data as success.
