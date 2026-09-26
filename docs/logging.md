# Logging und Log-Viewer

## Format

[logger.js](../logger.js) (Winston) schreibt jede Zeile auf die Konsole und in
`LOG_PATH` (Standard `./app.log`):

```
2026-01-01T09:30:00.123Z INFO [scope|user|entity|jobId] Meldung
```

- **Zeitstempel ISO+Z (UTC)**, wie jeder DB-Zeitstempel. Angezeigt wird er erst
  im Log-Viewer, in `app.timezone`.
- **Tag** aus dem Log-Kontext ([lib/log-context.js](../lib/log-context.js)):
  `scope` (`http`, `admin`, `job` …), der angemeldete Benutzer, die Entity (die
  Route setzt sie via `setContext`, sonst `METHOD /pfad`) und die Job-Id. Fehlt
  ein Slot, steht `-`. Ausserhalb eines Kontexts (Boot) fehlt das Tag.
- **Folgezeilen ohne Zeitstempel** (Stacktraces) gehören zur Zeile davor.
- **Rotation:** 5 MB × 5 Dateien, `tailable`. Die neuesten Zeilen stehen immer
  in `app.log`, die älteren in `app1.log` → … → `app4.log`. Ein logrotate auf
  dem LXC braucht es nicht.

Logs bleiben deutsch, sie sind nicht nutzerseitig (Ausnahme von der i18n-Regel).

## Log-Viewer (Admin-Konsole → Logs)

Das Admin-Feature `logs` ([partials/logs.html](../public/partials/logs.html),
[js/logs/](../public/js/logs/)) liest die Datei-Kette über
[routes/admin-logs.js](../routes/admin-logs.js) → [lib/log-reader.js](../lib/log-reader.js).
Die Parser- und Rotationslogik gibt es nur in `log-reader.js`. Wer das Format
in `logger.js` ändert, passt dort `LINE_RE` an.

| Endpoint (hinter `requireAdmin`) | Zweck |
|---|---|
| `GET /api/admin/logs?level&scope&user&entity&q&before&limit` | Seite, neueste zuerst: `{ entries, hasMore }`. `before` = `ts` des ältesten angezeigten Eintrags (Cursor), `limit` ≤ 1000 |
| `GET /api/admin/logs/files` | `app.log` + rotierte Dateien mit Grösse und mtime |
| `GET /api/admin/logs/download?file=current\|1\|…` | eine Datei als `text/plain`. Der Download wird selbst geloggt (Audit) |
| `GET /api/admin/logs/stream` | Server-Sent Events: jede neu angehängte Zeile, `event: rotated` bei einer Rotation |

- **Lesen rückwärts in 64-KB-Blöcken.** Keine Datei landet ganz im Speicher,
  und eine Suche bricht ab, sobald `limit` Treffer da sind.
- **Filter:** Level exakt, Scope exakt, Benutzer ohne Gross-/Kleinschreibung,
  Entity als Teilstring, Freitext in Meldung und Stacktrace.
- **Cursor-Grenze:** Einträge mit exakt derselben Millisekunde wie der Cursor
  fallen beim Nachladen weg. Für einen Viewer ist das akzeptiert.
- **Live-Tail** (SSE) läuft nur, solange der Schalter an ist, das Feature
  offen ist und kein Filter gilt. Sonst würde eine Live-Zeile am Filter
  vorbeigehen. Die Karte schliesst den Stream beim Verlassen des Features.
- **Proxy:** Der Stream setzt `Cache-Control: no-transform` (dann puffert
  `compression()` nicht) und `X-Accel-Buffering: no` (dann puffert Nginx Proxy
  Manager nicht), dazu alle 15 s einen Heartbeat-Kommentar.
- **Keine Privacy-Grenze:** Der Admin sieht alles, was der Server loggt. Darum
  kommen **keine Secrets, Passwörter oder Tokens in Logzeilen**.
- **Log-Text ist untrusted:** Die Karte rendert ihn nur per `x-text`, nie per
  `x-html` (gegated durch `tests/e2e/logs-card.spec.js`).

Tests: [tests/unit/log-reader.test.js](../tests/unit/log-reader.test.js)
(Parser, Rückwärtslesen über Blockgrenzen, Rotation, Filter, Follow),
[tests/integration/admin-logs-api.test.js](../tests/integration/admin-logs-api.test.js)
(API + SSE), [tests/e2e/logs-card.spec.js](../tests/e2e/logs-card.spec.js)
(Karte gegen die Mocks in [tests/mocks/logs.js](../tests/mocks/logs.js)).
