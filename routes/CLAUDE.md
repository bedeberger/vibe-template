# Routen-Regeln (`routes/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md). Jobs: [jobs/CLAUDE.md](jobs/CLAUDE.md).

- **Routen sind dünn:** Input parsen + validieren, die **Facade** (`lib/`)
  aufrufen, das Ergebnis auf HTTP abbilden. Kein SQL, keine Domänenlogik, keine
  lange Arbeit (→ Job-Queue).
- **Jeder Handler läuft durch `handle()`** aus [_http.js](_http.js) (Referenz
  [notes.js](notes.js)): der Handler **gibt das Ergebnis zurück**, `handle()`
  sendet es als JSON (`{ status: 201 }` beim Anlegen, `202` beim Einreihen).
  Kein eigenes `try/catch` + Statuscode-Mapping pro Route.
- **Ids zuerst validieren** mit `requireId(req.params.id)` (wirft 400
  `invalid id`); fehlt etwas, wirft die Facade oder der Handler `notFound()`
  (404). Die Zuordnung Fehlerart → Status steht **nur** in `_http.js`:
  `invalid` 400 · `not_found` 404 · `conflict` 409. Alles andere (Bug,
  DB-Fehler) geht an den zentralen Error-Handler in [server.js](../server.js):
  geloggt, `500 { error: 'internal error' }`, ohne Interna. `401` kommt vom
  Auth-Guard — nie ein zweiter Login-Check in einem Handler.
- **Fehlertexte sind API-Vertrag** (`not found`, `user exists` …): das Frontend
  mappt darauf, [tests/integration/api-errors.test.js](../tests/integration/api-errors.test.js)
  hält sie fest. Nur bewusst ändern.
- **Log-Kontext:** nach der Validierung der Entity-Id `setContext({ entity: id })`
  ([lib/log-context.js](../lib/log-context.js)) — jede Request-Zeile ist dann
  nach Entity auffindbar, zusammen mit dem Job, den sie auslöst.
- **Mounten in [server.js](../server.js)** — die gesamte HTTP-Verdrahtung lebt
  dort. Ein Pfad, der ohne Session funktionieren muss, kommt bewusst und eng
  gefasst in `isPublicPath` in [lib/auth.js](../lib/auth.js).
