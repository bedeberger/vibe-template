# Job-Regeln (`routes/jobs/`)

Gilt zusätzlich zu [routes/CLAUDE.md](../CLAUDE.md).

- **Lange Arbeit läuft nur hier** — alles, was einen Request spürbar blockieren
  würde (Import, Export, Batch, externer Aufruf, später AI). Nie synchron in
  einem Route-Handler.
- **Eine Datei pro Job-Typ** (Referenz [note-stats.js](note-stats.js)): ein
  stabiler `TYPE`-String, `registerRunner(TYPE, async (job) => result)`; der
  Runner liest und schreibt über Facades und gibt ein schlichtes Ergebnisobjekt
  zurück (gespeichert als `result_json`). Den Typ in `KNOWN_TYPES` in
  [index.js](index.js) eintragen, wenn er per API einreihbar sein soll; ein nur
  zeitgesteuerter Typ wird dort nur per `require` geladen.
- **Einreihen via `queue.createJob(type, entityId)`** ([shared/queue.js](shared/queue.js))
  — Dedup ist eingebaut: ein aktiver Job für dasselbe (type, entity) wird
  zurückgegeben statt eines zweiten, auch bei `entityId = null`.
- **Statustexte sind i18n-Keys** (`job.phase.xxx`), aufgelöst im Frontend.
- **Den Log-Kontext setzt die Queue** (`[job|…|entity|jobId]`) — im Runner nicht
  nachbauen.
- **Bei Fehler werfen** — die Queue markiert den Job als `error` und speichert
  die Meldung; nie Teildaten als Erfolg zurückgeben.

## Zeitgesteuerte Jobs (Cron)

- **Der Scheduler reiht nur ein, er arbeitet nicht** ([shared/scheduler.js](shared/scheduler.js)).
  Ein fälliger Zeitplan ruft `queue.createJob(type, null)` auf. Status, Dedup,
  Fehler und Log-Kontext kommen also aus der Queue; der Scheduler taggt nur das
  Einreihen mit `[cron|…]`.
- **Zeitplan in der Datei des Job-Typs:** `registerSchedule(TYPE, '15 3 * * *')`
  direkt neben `registerRunner` (Referenz [jobs-cleanup.js](jobs-cleanup.js)).
  Syntax: 5 Felder, `*` `5` `1-5` `1,15` `*/10` `8-18/2` sowie `@hourly`
  `@daily` `@weekly` `@monthly` `@yearly`, keine Namen wie `MON` und keine
  Sekunden ([lib/cron.js](../../lib/cron.js)). Ein ungültiger Ausdruck wirft
  schon beim Boot.
- **Die Zeit ist `app.timezone`, nicht die Prozess-Zeitzone.** Eine Wandzeit-Minute,
  die beim Wechsel auf Sommerzeit entfällt, feuert nie. Eine, die beim Wechsel
  auf Winterzeit doppelt vorkommt, feuert einmal.
- **Kein Nachholen:** Minuten, in denen der Prozess nicht lief (Deploy, Neustart),
  werden nicht nachgeholt. Ein Lauf, der nicht ausfallen darf, muss idempotent
  sein und darf dann häufiger laufen.
- **Überlappung:** Ist der vorige Lauf noch `queued`/`running`, greift die Dedup,
  und es gibt keinen zweiten Lauf.
- **Nur im laufenden Server:** `server.js start()` startet den Scheduler, ein
  blosser Import (Tests) nicht. `SCHEDULER=off` schaltet ihn ab. Tests rufen
  `scheduler.tick(date, tz)` mit festen Zeitpunkten auf und warten nie auf einen
  Timer.
- **Scheduler-Jobs haben keine Entität** (`note_id NULL`) und tauchen daher nicht
  in `GET /api/jobs?note_id=…` auf; ihr Ergebnis steht in `jobs.result_json` und
  im Log.
