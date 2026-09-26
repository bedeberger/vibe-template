# Routen-Regeln (`routes/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md). Jobs: [jobs/CLAUDE.md](jobs/CLAUDE.md).

- **Routen sind dünn:** Input parsen + validieren, die **Facade** (`lib/`)
  aufrufen, das Ergebnis auf HTTP abbilden. Kein SQL, keine Domänenlogik, keine
  lange Arbeit (→ Job-Queue).
- **Ids zuerst validieren** (`toIntId`) und bei ungültigem Input mit
  `400 { error }` antworten, mit `404 { error }`, wenn die Facade nichts findet.
  `401` kommt vom Auth-Guard in [server.js](../server.js) — nie ein zweiter
  Login-Check in einem Handler.
- **Log-Kontext:** nach der Validierung der Entity-Id `setContext({ entity: id })`
  ([lib/log-context.js](../lib/log-context.js)) — jede Request-Zeile ist dann
  nach Entity auffindbar, zusammen mit dem Job, den sie auslöst.
- **Mounten in [server.js](../server.js)** — die gesamte HTTP-Verdrahtung lebt
  dort. Ein Pfad, der ohne Session funktionieren muss, kommt bewusst und eng
  gefasst in `isPublicPath` in [lib/auth.js](../lib/auth.js).
