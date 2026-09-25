# Test rules (`tests/`)

Applies in addition to the root [CLAUDE.md](../CLAUDE.md). Full concept, which
suite when, helpers and traps: [docs/testing.md](../docs/testing.md).

| Folder | What | Server |
| --- | --- | --- |
| [unit/](unit/) | pure logic, facades on a temp DB, **static guards** | none |
| [integration/](integration/) | HTTP API + job queue end to end — `_helpers/setup.js#bootstrap()` | in-process app |
| [e2e/](e2e/) | fixture harnesses ([fixtures/](fixtures/)*-harness.html): real partial + real component, mocked API | [server.js](server.js) |
| [e2e-app/](e2e-app/) | the real app: registry-driven [smoke.spec.js](e2e-app/smoke.spec.js) + behaviour needing the real backend/full CSS | `node server.js` |

- **Temp DB before the first require.** Under `NODE_ENV=test` the connection
  refuses to open without `DB_PATH`.
- **Playwright specs import `test`/`expect` from `e2e/_helpers/fixtures.js`**
  (console-error guard), never from `@playwright/test` directly.
- **Harness vs. app:** assertion depends on the full CSS or template + store +
  backend together → `e2e-app/`; pure DOM/module logic → harness in `e2e/`.
- **Mutation-check every new guard/geometry test once** — break the rule on
  purpose, see red, revert.
- **Fix the bug, not the test.**
