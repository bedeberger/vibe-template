# Tests

Four suites, sequential via `npm test`. First-time setup: `npx playwright install chromium`.

| Suite | Runner | Path | Command | Character |
| --- | --- | --- | --- | --- |
| Unit | `node --test` | [tests/unit/](../tests/unit/) | `npm run test:unit` | pure logic, facades against a temp DB, **static guards**; parallel (concurrency 4), no browser |
| Integration | `node --test` | [tests/integration/](../tests/integration/) | `npm run test:integration` | the HTTP API end to end against a temp DB, real job queue |
| E2E | Playwright | [tests/e2e/](../tests/e2e/) | `npm run test:e2e` | **fixture harnesses** (real partial + real component) against the mock server [tests/server.js](../tests/server.js) |
| E2E-App | Playwright | [tests/e2e-app/](../tests/e2e-app/) | `npm run test:e2e-app` (`test:smoke` = only the smoke spec) | the **real** app (`node server.js`, `LOCAL_DEV_MODE`, fresh seeded DB) |

Unit and integration run under `NODE_ENV=test` ([scripts/with-env.js](../scripts/with-env.js)):
[db/connection.js](../db/connection.js) then refuses to open anything without an
explicit `DB_PATH`, so no test can touch the repo `app.db`.

## Which suite when?

**Unit** — pure functions, validators, the domain facade (own temp DB, see
[note-store.test.js](../tests/unit/note-store.test.js)), and the **static
guards**: migration lock/drift/chain, deploy contract, vendor integrity,
harness CSS parity, LOC limits, CSS/i18n/icon/markup rules. A guard is a test
that reads the source tree and fails on a rule violation — cheap, runs on every
push, and it is where a hard rule from CLAUDE.md becomes mechanical.

**Integration** — the API and job pipeline end to end: HTTP → route → facade →
DB → queue. Bootstrap via [tests/integration/_helpers/setup.js](../tests/integration/_helpers/setup.js):

```js
const { bootstrap } = require('./_helpers/setup');
const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });   // BEFORE any app require
test.before(ctx.start);
test.after(ctx.stop);
const res = await fetch(ctx.url('/api/notebooks'));
```

It puts the throwaway DB on `/dev/shm` when available (`TEST_TMPDIR` overrides)
and sets `LOCAL_DEV_MODE=0` unless you pass it — the auth guard is armed by
default ([healthz.test.js](../tests/integration/healthz.test.js) relies on that).

**E2E (fixture harness)** — DOM/module logic of one feature in isolation:
load on open, rendering, escape invariant of `x-html` sinks, add/edit/delete
round trips, job polling, events. One harness per feature
(`tests/fixtures/<id>-harness.html`, created by `npm run feature:new`) calls
`mountFeature('<id>')` from [tests/fixtures/_harness.js](../tests/fixtures/_harness.js):
the **real** card inventory, the **real** lazy partial loader and i18n, under a
minimal stub root instead of the app shell. [tests/server.js](../tests/server.js)
serves `public/` at `/`, `tests/` at `/tests/`, and deterministic API mocks with
seed data (inspect `GET /__mock/state`, reset `POST /__mock/reset` in
`beforeEach`). Reference: [notes-harness.html](../tests/fixtures/notes-harness.html) +
[notes-card.spec.js](../tests/e2e/notes-card.spec.js).

- A harness links **the same stylesheets in the same order** as
  [public/index.html](../public/index.html) — gated by
  [harness-css-parity.test.mjs](../tests/unit/harness-css-parity.test.mjs).
  New CSS file → both places.
- A harness needs thinner data than production? Make the **harness**
  production-like, don't ignore the resulting error.

**E2E-App (real app)**:

- [smoke.spec.js](../tests/e2e-app/smoke.spec.js) boots the SPA and opens
  **every feature from the registry** ([features.js](../public/js/app/features.js),
  read at runtime — a new feature is in the smoke automatically): nav click →
  host visible → the lazily loaded partial mounted its card → hash route; plus a
  deep link. A phone-viewport pass (360 px) asserts no horizontal overflow per
  feature — the spec the DoD hook names as mobile coverage. Pure "renders without an error" — no behaviour assertions there.
- Behaviour specs whose assertion depends on the **real backend, the complete
  template tree or the full CSS** (layout heights, overlay geometry) go next to
  it — e.g. [notes.spec.js](../tests/e2e-app/notes.spec.js).
- **Decision rule:** does the assertion hang on the complete CSS or on
  template + store + backend together? → `tests/e2e-app/`. Pure DOM/module
  logic? → harness in `tests/e2e/` (faster, isolated).
- The boot sequence is SSoT in [tests/e2e-app/_helpers/app.js](../tests/e2e-app/_helpers/app.js)
  (`bootApp`, `waitBooted`) — never copied per spec.

## Console-error guard

Every Playwright spec imports `test`/`expect` from
[tests/e2e/_helpers/fixtures.js](../tests/e2e/_helpers/fixtures.js) instead of
`@playwright/test`. An auto fixture attaches
[console-guard.js](../tests/e2e/_helpers/console-guard.js): `pageerror`,
`console.error` and Alpine warnings (`Alpine Expression Error`/`Alpine Warn`)
collected during the test turn it red.

**Why:** Alpine does not throw template expression errors — it logs them and
re-throws asynchronously. Without the guard a typo in a template is a green
test with a broken UI.

- Negative test that provokes an error on purpose: `consoleGuard.skip()`.
- Known, expected message: `consoleGuard.ignore(/regex/)`. The default allowlist
  covers network noise (401/403/404, missing mock route, ResizeObserver loop).

## Rules

- **New UI feature ⇒ `npm run test:smoke`** — only this layer catches swallowed
  Alpine errors and a forgotten registration.
- **New geometry/layout test: mutation-check it once.** Break the behaviour on
  purpose (no-op the function, kill the CSS property), run the suite, see it
  red, revert. A test that was never red is no safety net. Same for a new guard:
  violate the rule once, see it fail.
- **Fix the bug, not the test.** A red test after a UI change: find the cause,
  don't weaken the assertion.
- `node --test` without `--test-concurrency` is **not** sequential (default:
  cores − 1). The scripts pin 4. Each file has its own temp DB, so files don't
  lock each other; the cap protects the runner from I/O overload. Race in a set
  of files? `node --test --test-concurrency=1 "tests/integration/*.test.js"`.

## Common traps

- **Playwright can't find Chromium:** `npx playwright install chromium`.
- **Test opens the repo DB** → `DB_PATH missing` error: set the temp DB before
  the first `require` (unit: like note-store.test.js; integration: `bootstrap()`).
- **Port in use:** e2e uses 3210, e2e-app 3211; locally an already running
  server on that port is reused (`reuseExistingServer`), in CI never.

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs audit + gitleaks →
migration gates → unit → integration → e2e → e2e-app in one job; the Playwright
report is uploaded on failure. Where it runs (GitHub-hosted or the LXC runner):
[deployment.md](deployment.md).
