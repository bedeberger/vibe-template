# Test-Regeln (`tests/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md). Gesamtkonzept, welche Suite
wann, Helfer und Fallen: [docs/testing.md](../docs/testing.md).

| Ordner | Was | Server |
| --- | --- | --- |
| [unit/](unit/) | reine Logik, Facades auf einer Temp-DB, **statische Guards** | keiner |
| [integration/](integration/) | HTTP-API + Job-Queue end to end — `_helpers/setup.js#bootstrap()` | In-Process-App |
| [e2e/](e2e/) | ein Harness pro Feature ([fixtures/](fixtures/)`<id>-harness.html` → `mountFeature('<id>')`, [_harness.js](fixtures/_harness.js)): echte Karte + Partial, gemockte API | [server.js](server.js) |
| [e2e-app/](e2e-app/) | die echte App: registry-getriebene [smoke.spec.js](e2e-app/smoke.spec.js) + Verhalten, das das echte Backend/volle CSS braucht | `node server.js` |

- **Temp-DB vor dem ersten require.** Unter `NODE_ENV=test` verweigert die
  Verbindung das Öffnen ohne `DB_PATH`.
- **Playwright-Specs importieren `test`/`expect` aus `e2e/_helpers/fixtures.js`**
  (Console-Error-Guard), nie direkt aus `@playwright/test`.
- **Harness vs. App:** hängt die Assertion vom vollen CSS oder von Template +
  Store + Backend zusammen ab → `e2e-app/`; reine DOM-/Modullogik → Harness in
  `e2e/`.
- **Jeden neuen Guard-/Geometrie-Test einmal mutationsprüfen** — die Regel
  absichtlich brechen, Rot sehen, zurücknehmen.
- **Den Bug fixen, nicht den Test.**
