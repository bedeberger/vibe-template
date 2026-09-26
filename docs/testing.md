# Tests

Vier Suites, nacheinander via `npm test`. Einmalige Einrichtung: `npx playwright install chromium`.

| Suite | Runner | Pfad | Befehl | Charakter |
| --- | --- | --- | --- | --- |
| Unit | `node --test` | [tests/unit/](../tests/unit/) | `npm run test:unit` | reine Logik, Facades gegen eine Temp-DB, **statische Guards**; parallel (Concurrency 4), kein Browser |
| Integration | `node --test` | [tests/integration/](../tests/integration/) | `npm run test:integration` | die HTTP-API durchgehend gegen eine Temp-DB, echte Job-Queue |
| E2E | Playwright | [tests/e2e/](../tests/e2e/) | `npm run test:e2e` | **Fixture-Harnesses** (echtes Partial + echte Komponente) gegen den Mock-Server [tests/server.js](../tests/server.js) |
| E2E-App | Playwright | [tests/e2e-app/](../tests/e2e-app/) | `npm run test:e2e-app` (`test:smoke` = nur die Smoke-Spec) | die **echte** App (`node server.js`, `LOCAL_DEV_MODE`, frische geseedete DB) |

Unit und Integration laufen unter `NODE_ENV=test` ([scripts/with-env.js](../scripts/with-env.js)):
[db/connection.js](../db/connection.js) verweigert dann, irgendetwas ohne
explizites `DB_PATH` zu öffnen, also kann kein Test die Repo-`app.db` berühren.

## Welche Suite wann?

**Unit** — reine Funktionen, Validatoren, die Domänen-Facade (eigene Temp-DB
via [tests/_helpers/temp-db.js](../tests/_helpers/temp-db.js), Muster
[note-store.test.js](../tests/unit/note-store.test.js)) und die
**statischen Guards**: Migrations-Lock/-Drift/-Kette, Deploy-Vertrag,
Vendor-Integrität, Harness-CSS-Parität, LOC-Limits, CSS-/i18n-/Icon-/Markup-Regeln.
Ein Guard ist ein Test, der den Quellbaum liest und bei einer Regelverletzung
fehlschlägt — billig, läuft bei jedem Push, und dort wird eine harte Regel aus
CLAUDE.md mechanisch.

**Integration** — API und Job-Pipeline durchgehend: HTTP → Route → Facade →
DB → Queue. Bootstrap via [tests/integration/_helpers/setup.js](../tests/integration/_helpers/setup.js):

```js
const { bootstrap } = require('./_helpers/setup');
const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });   // VOR jedem App-require
test.before(ctx.start);
test.after(ctx.stop);
const { get, send } = ctx;                        // fetch-Responses
const res = await send('/api/notes', 'POST', { notebook_id: 1, title: 'x' });
const eva = ctx.client();                         // eigener Cookie-Jar = ein „Browser“
const { status, json } = await eva.call('/auth/login', { method: 'POST', body: { email, password } });
```

Auf einen Hintergrund-Job wartet jeder Test mit derselben Schleife,
[tests/_helpers/jobs.js](../tests/_helpers/jobs.js):
``await waitForJob(async () => (await get(`/api/jobs/${id}`)).json())`` — mit
Timeout und Meldung statt stillem Hängen. Keine eigene Poll-, Cookie- oder
Temp-DB-Logik pro Testdatei: fehlt ein Helfer, gehört er dorthin.

Die Wegwerf-DB liegt auf `/dev/shm`, wenn vorhanden (`TEST_TMPDIR` übersteuert),
und `LOCAL_DEV_MODE=0` wird gesetzt, sofern nicht übergeben — der Auth-Guard ist
standardmässig scharf ([healthz.test.js](../tests/integration/healthz.test.js)
verlässt sich darauf).

**E2E (Fixture-Harness)** — DOM-/Modul-Logik eines Features isoliert: Laden beim
Öffnen, Rendering, Escape-Invariante der `x-html`-Senken, Hinzufügen-/Bearbeiten-/
Löschen-Roundtrips, Job-Polling, Events. Ein Harness je Feature
(`tests/fixtures/<id>-harness.html`, erzeugt von `npm run feature:new`) ruft
`mountFeature('<id>')` aus [tests/fixtures/_harness.js](../tests/fixtures/_harness.js):
das **echte** Karten-Inventar, der **echte** Lazy-Partial-Loader und i18n, unter
einem minimalen Stub-Root statt der App-Shell. [tests/server.js](../tests/server.js)
liefert `public/` unter `/`, `tests/` unter `/tests/` und deterministische
API-Mocks mit Seed-Daten (ansehen `GET /__mock/state`, zurücksetzen
`POST /__mock/reset` in `beforeEach`). Referenz: [notes-harness.html](../tests/fixtures/notes-harness.html) +
[notes-card.spec.js](../tests/e2e/notes-card.spec.js).

- Ein Harness bindet **dieselben Stylesheets in derselben Reihenfolge** ein wie
  [public/index.html](../public/index.html) — gegatet durch
  [harness-css-parity.test.mjs](../tests/unit/harness-css-parity.test.mjs).
  Neue CSS-Datei → beide Orte.
- Braucht ein Harness dünnere Daten als die Produktion? Den **Harness**
  produktionsnah machen, den entstehenden Fehler nicht ignorieren.

**E2E-App (echte App)**:

- [smoke.spec.js](../tests/e2e-app/smoke.spec.js) bootet die SPA und öffnet
  **jedes Feature aus der Registry** ([features.js](../public/js/app/features.js),
  zur Laufzeit gelesen — ein neues Feature ist automatisch im Smoke): Nav-Klick →
  Host sichtbar → das lazy geladene Partial hat seine Karte gemountet →
  Hash-Route; dazu ein Deep-Link. Ein Durchgang im Phone-Viewport (360 px, als Touch-Gerät)
  prüft je Feature, dass nichts horizontal überläuft und Icon-only-Buttons ≥ 40 px
  gross sind ([DESIGN.md → Mobile (Pflicht)](../DESIGN.md#mobile-pflicht)) — die Spec, die der DoD-Hook als
  Mobile-Abdeckung nennt. Reines "rendert ohne Fehler" — dort keine
  Verhaltens-Assertions.
- Verhaltens-Specs, deren Assertion am **echten Backend, am vollständigen
  Template-Baum oder am vollen CSS** hängt (Layout-Höhen, Overlay-Geometrie),
  gehören daneben — z. B. [notes.spec.js](../tests/e2e-app/notes.spec.js).
- **Entscheidungsregel:** hängt die Assertion am vollständigen CSS oder an
  Template + Store + Backend zusammen? → `tests/e2e-app/`. Reine DOM-/Modul-Logik?
  → Harness in `tests/e2e/` (schneller, isoliert).
- Die Boot-Sequenz ist SSoT in [tests/e2e-app/_helpers/app.js](../tests/e2e-app/_helpers/app.js)
  (`bootApp`, `waitBooted`) — nie je Spec kopiert.

## Console-Error-Guard

Jede Playwright-Spec importiert `test`/`expect` aus
[tests/e2e/_helpers/fixtures.js](../tests/e2e/_helpers/fixtures.js) statt aus
`@playwright/test`. Eine Auto-Fixture hängt
[console-guard.js](../tests/e2e/_helpers/console-guard.js) an: `pageerror`,
`console.error` und Alpine-Warnungen (`Alpine Expression Error`/`Alpine Warn`),
die während des Tests anfallen, färben ihn rot.

**Warum:** Alpine wirft bei Fehlern in Template-Ausdrücken nicht — es loggt sie
und wirft asynchron erneut. Ohne den Guard ist ein Tippfehler im Template ein
grüner Test mit kaputter UI.

- Negativtest, der absichtlich einen Fehler provoziert: `consoleGuard.skip()`.
- Bekannte, erwartete Meldung: `consoleGuard.ignore(/regex/)`. Die
  Standard-Allowlist deckt Netzwerkrauschen ab (401/403/404, fehlende Mock-Route,
  ResizeObserver-Loop).

## Regeln

- **Neues UI-Feature ⇒ `npm run test:smoke`** — nur diese Schicht fängt
  verschluckte Alpine-Fehler und eine vergessene Registrierung.
- **Neuer Geometrie-/Layout-Test: einmal mutationsprüfen.** Das Verhalten
  absichtlich brechen (Funktion zum No-op machen, CSS-Property entfernen), die
  Suite laufen lassen, rot sehen, zurücknehmen. Ein Test, der nie rot war, ist
  kein Sicherheitsnetz. Dasselbe für einen neuen Guard: die Regel einmal
  verletzen, scheitern sehen.
- **Den Bug fixen, nicht den Test.** Ein roter Test nach einer UI-Änderung: die
  Ursache finden, die Assertion nicht aufweichen.
- `node --test` ohne `--test-concurrency` ist **nicht** sequenziell (Standard:
  Kerne − 1). Die Skripte fixieren 4. Jede Datei hat ihre eigene Temp-DB, Dateien
  sperren sich also nicht gegenseitig; die Obergrenze schützt den Runner vor
  I/O-Überlast. Race in einer Gruppe von Dateien?
  `node --test --test-concurrency=1 "tests/integration/*.test.js"`.

## Häufige Fallen

- **Playwright findet Chromium nicht:** `npx playwright install chromium`.
- **Test öffnet die Repo-DB** → Fehler `DB_PATH missing`: die Temp-DB vor dem
  ersten `require` setzen (Unit: `useTempDb()` aus tests/_helpers/temp-db.js;
  Integration: `bootstrap()`).
- **Port belegt:** e2e nutzt 3210, e2e-app 3211; lokal wird ein bereits laufender
  Server auf diesem Port wiederverwendet (`reuseExistingServer`), in CI nie.

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) führt audit + gitleaks →
Migrations-Gates → Unit → Integration → E2E → E2E-App in einem Job aus; der
Playwright-Report wird bei Fehler hochgeladen. Wo es läuft (GitHub-hosted oder
der LXC-Runner): [deployment.md](deployment.md).
