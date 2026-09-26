# lib-Regeln (`lib/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md).

- **Eine Facade pro Domäne** (`lib/<domain>-store.js`, Referenz
  [note-store.js](note-store.js)) ist der einzige Eintrittspunkt zu den Daten
  dieser Domäne: Validierung, Invarianten und (später) Caching leben hier — nicht
  in Routen, nicht in Jobs. Routen/Jobs importieren die Facade, nie
  `db/<domain>.js`, nie Roh-SQL.
- **Facade-Fehler sind Domänenfehler** aus [errors.js](errors.js):
  `throw invalid('note title required')`, `throw notFound()`,
  `throw conflict('user exists')` — nie `new Error(…)` für eine Ablehnung. Die
  Facade nennt nur die **Art**, die Route bildet sie auf HTTP ab
  ([routes/_http.js](../routes/_http.js)); die Facade weiss nichts von HTTP.
- **Eine Regel pro Feld, geteilt von create und update** (Referenz
  `requiredText` in [note-store.js](note-store.js)) — sonst lehnt `create` einen
  leeren Titel ab und `update` speichert ihn.
- **Log-Kontext** ([log-context.js](log-context.js)): `runWithContext` öffnet einen
  Scope (das tun die HTTP-Middleware und die Job-Queue), `setContext` füllt Slots.
  Keinen zweiten Kontext-Mechanismus bauen.
- **Laufzeit-Konfiguration** nur über [app-settings.js](app-settings.js):
  `appSettings.get('<key>')` liefert den typisierten Wert oder den Default aus
  dem `SETTINGS`-Register. Nie `process.env` für etwas, das der Admin ändern
  können soll (Root-CLAUDE.md „`.env` nur minimal"); pro Aufruf lesen, nicht
  beim Import cachen — sonst greift eine Änderung in der Konsole erst nach dem
  Neustart.
- **Datum auf dem Server** nur über [local-date.js](local-date.js) (liest
  `app.timezone`), nie über die Prozess-Zeitzone.
- **Dev-Seed** ([dev-seed.js](dev-seed.js)) schreibt über die Facade, nur unter
  `LOCAL_DEV_MODE=1`, nur in leere Tabellen — und seedet die *Unterschiede*
  (z. B. eine Notiz mit HTML im Body, um das Escaping zu prüfen) statt fünf
  identischer Zeilen.
