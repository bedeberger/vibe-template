# lib-Regeln (`lib/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md).

- **Eine Facade pro Domäne** (`lib/<domain>-store.js`, Referenz
  [note-store.js](note-store.js)) ist der einzige Eintrittspunkt zu den Daten
  dieser Domäne: Validierung, Invarianten und (später) Caching leben hier — nicht
  in Routen, nicht in Jobs. Routen/Jobs importieren die Facade, nie
  `db/<domain>.js`, nie Roh-SQL.
- **Facade-Fehler sind Domänenfehler** (`name required`, `not found`) — die Route
  bildet sie auf HTTP-Statuscodes ab; die Facade weiss nichts von HTTP.
- **Log-Kontext** ([log-context.js](log-context.js)): `runWithContext` öffnet einen
  Scope (das tun die HTTP-Middleware und die Job-Queue), `setContext` füllt Slots.
  Keinen zweiten Kontext-Mechanismus bauen.
- **Datum auf dem Server** nur über [local-date.js](local-date.js) (liest
  `app.timezone`), nie über die Prozess-Zeitzone.
- **Dev-Seed** ([dev-seed.js](dev-seed.js)) schreibt über die Facade, nur unter
  `LOCAL_DEV_MODE=1`, nur in leere Tabellen — und seedet die *Unterschiede*
  (z. B. eine Notiz mit HTML im Body, um das Escaping zu prüfen) statt fünf
  identischer Zeilen.
